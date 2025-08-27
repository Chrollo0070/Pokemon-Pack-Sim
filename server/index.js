import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB, getDB, getUserByUsername, createUser, getCollectionByUserId, addCardsToCollection, setPokeCoins } from './database.js';
import { fetchAllPokemonCards } from './fetch-all-cards.js';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const PACK_COST = parseInt(process.env.PACK_COST || '100', 10);

// API Configuration
const API_BASE = 'https://api.pokemontcg.io/v2';

// Configure CORS to allow requests from your frontend
// Set FRONTEND_URL environment variable to your frontend's URL in production
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  optionsSuccessStatus: 200
};

// Global middleware (must be before routes)
app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint for Render
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_PACKS_PATH = path.join(__dirname, 'packs.local.json');
const CACHE_PACKS_PATH = path.join(__dirname, 'packs.cache.json');
const CARD_POOL_TTL_MS = parseInt(process.env.CARD_POOL_TTL_MS || '43200000', 10); // Default 12h

// Global state
let PACKS_LIST = [];
let PACKS_READY = false;
const CARD_POOL_CACHE = new Map();
// In-memory game state for Guess the Silhouette (ephemeral)
const SILHOUETTE_GAMES = new Map(); // token -> { answer, image, setId, setName, createdAt }

// In-memory cache for energy assets
const ENERGY_ASSETS_CACHE = { data: null, expiry: 0 };

// Axios instance with longer timeout for API reliability
const api = axios.create({ timeout: 30000 });

// Assets: Latest Basic Energy card images
app.get('/api/assets/energies', async (_req, res) => {
  try {
    const now = Date.now();
    if (ENERGY_ASSETS_CACHE.data && ENERGY_ASSETS_CACHE.expiry > now) {
      return res.json(ENERGY_ASSETS_CACHE.data);
    }

    const headers = {};
    if (process.env.POKEMON_TCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;

    // Energy types to resolve
    const TYPES = [
      { id: 'grass', name: 'Grass Energy' },
      { id: 'fire', name: 'Fire Energy' },
      { id: 'water', name: 'Water Energy' },
      { id: 'lightning', name: 'Lightning Energy' },
      { id: 'psychic', name: 'Psychic Energy' },
      { id: 'fighting', name: 'Fighting Energy' },
      { id: 'darkness', name: 'Darkness Energy' },
      { id: 'metal', name: 'Metal Energy' },
      { id: 'dragon', name: 'Dragon Energy' },
    ];

    const out = {};
    for (const t of TYPES) {
      try {
        // Query latest basic energy by release date
        const params = {
          q: `subtypes:Basic supertype:Energy name:"${t.name}"`,
          orderBy: '-set.releaseDate',
          page: 1,
          pageSize: 1,
          select: 'id,images,set',
        };
        const { data } = await requestWithRetry(`${API_BASE}/cards`, { headers, params });
        const card = data?.data?.[0];
        const image = card?.images?.large || card?.images?.small || null;
        if (image) out[t.id] = { id: card.id, image, set: card.set?.id, setName: card.set?.name };
      } catch (e) {
        // Skip on failure; client will fallback
      }
    }

    // Cache for 12 hours
    ENERGY_ASSETS_CACHE.data = out;
    ENERGY_ASSETS_CACHE.expiry = now + 12 * 60 * 60 * 1000;
    return res.json(out);
  } catch (e) {
    console.error('Error in /api/assets/energies:', e?.message || e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Games: Poké Memory Flip — submit result and award coins
// Client sends stats; server computes reward and updates balance securely
app.post('/api/games/memory/finish', async (req, res) => {
  const db = await getDB();
  let tx = false;
  try {
    const { username, difficulty, pairsTotal, pairsMatched, mismatches, timeLeft, streakMax } = req.body || {};
    if (!username || typeof username !== 'string') return res.status(400).json({ error: 'username is required' });
    const user = await getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dif = String(difficulty || 'easy').toLowerCase();
    const totalsByDiff = { easy: 3, medium: 6, hard: 9 };
    const expectedPairs = totalsByDiff[dif] ?? 3;
    const totalPairs = Number.isFinite(pairsTotal) ? pairsTotal : expectedPairs;
    const matched = Math.max(0, Math.min(Number(pairsMatched || 0), totalPairs));
    const mm = Math.max(0, Number(mismatches || 0));
    const tLeft = Math.max(0, Math.floor(Number(timeLeft || 0)));

    // Determine win
    const won = matched >= totalPairs && tLeft > 0;

    // Reward rules
    let basePerPair = 5, timeMult = 1, perfectBonus = 10, comboStep = 0.0, comboCap = 1.0;
    if (dif === 'easy') {
      basePerPair = 5; timeMult = 1; perfectBonus = 10; comboStep = 0; comboCap = 1;
    } else if (dif === 'medium') {
      basePerPair = 8; timeMult = 1.5; perfectBonus = 25; comboStep = 0.1; comboCap = 1.5;
    } else if (dif === 'hard') {
      basePerPair = 12; timeMult = 2; perfectBonus = 50; comboStep = 0.2; comboCap = 2.0;
    }

    // Combo multiplier from max streak (approximation of per-match multiplier)
    const sMax = Math.max(1, Math.floor(Number(streakMax || 1)));
    const comboMult = Math.min(1 + comboStep * (sMax - 1), comboCap);

    // Compute coins
    let base = basePerPair * matched;
    base = Math.floor(base * comboMult);
    let timeBonus = (dif === 'medium') ? Math.floor(timeMult * tLeft) : Math.round(timeMult * tLeft);
    if (dif === 'hard') timeBonus = 2 * tLeft; // explicit as per spec
    const perfect = (mm === 0 && won);
    const bonus = perfect ? perfectBonus : 0;
    const coins = won ? Math.max(0, base + timeBonus + bonus) : 0;

    await db.exec('BEGIN');
    tx = true;
    if (coins > 0) {
      await db.run('UPDATE users SET poke_coins = poke_coins + ? WHERE id = ?', [coins, user.id]);
    }
    await db.exec('COMMIT');
    tx = false;

    const updated = await db.get('SELECT * FROM users WHERE id = ?', user.id);
    return res.json({
      won,
      coins,
      breakdown: { base, timeBonus, bonus, comboMult },
      user: updated,
    });
  } catch (e) {
    console.error('Error in /api/games/memory/finish:', e);
    if (tx) { try { await db.exec('ROLLBACK'); } catch (e2) { console.error('Rollback failed', e2); } }
    return res.status(500).json({ error: 'Server error' });
  }
});


// Ensure DB initializes on server start
initDB().catch((e) => {
  console.error('Failed to init DB', e);
  process.exit(1);
});

// Admin: Test which packs have at least one retrievable card image
// Admin: Fetch all cards from Pokemon TCG API
app.post('/api/admin/fetch-all-cards', async (req, res) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const token = req.headers['x-admin-token'];
    if (!adminToken) return res.status(500).json({ error: 'Admin token not configured on server' });
    if (!token || token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    // Start the fetch process in the background
    fetchAllPokemonCards()
      .then(() => console.log('✅ Card database update completed successfully'))
      .catch(err => console.error('❌ Error updating card database:', err));

    return res.json({ message: 'Card database update started in the background' });
  } catch (e) {
    console.error('Error in fetch-all-cards:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Warm per-set caches by building card pools without spending coins
app.post('/api/admin/warm-set-cache', async (req, res) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const token = req.headers['x-admin-token'] || req.body?.token;
    if (!adminToken) return res.status(500).json({ error: 'Admin token not configured on server' });
    if (!token || token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const { setId, all, force } = req.body || {};

    // Resolve target sets
    let targets = [];
    if (all === true || setId === 'all' || (!setId && all !== false)) {
      // Warm all currently loaded packs
      targets = PACKS_LIST.map(p => p.id);
    } else if (typeof setId === 'string' && setId.trim()) {
      targets = [setId.trim()];
    } else {
      return res.status(400).json({ error: 'Provide setId or all=true' });
    }

    const results = [];
    const cacheDir = path.join(__dirname, 'cache');

    for (const sid of targets) {
      try {
        if (force) {
          // Remove both new-path and legacy cache files to force a rebuild
          const setCacheFile = path.join(cacheDir, `${sid}-cards-cache.json`);
          const legacySetCacheFile = path.join(__dirname, `${sid}-cards-cache.json`);
          try { await fs.unlink(setCacheFile); } catch (_) {}
          try { await fs.unlink(legacySetCacheFile); } catch (_) {}
        }

        const pools = await getCardPools(sid);
        results.push({
          setId: sid,
          ok: true,
          counts: {
            Common: (pools.Common || []).length,
            Uncommon: (pools.Uncommon || []).length,
            RareOrHigher: (pools.RareOrHigher || []).length,
          },
        });
      } catch (e) {
        results.push({ setId: sid, ok: false, error: e?.message || 'failed' });
      }
    }

    return res.json({ warmed: results.length, results });
  } catch (e) {
    console.error('Error in /api/admin/warm-set-cache:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/test-packs', async (req, res) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const token = req.headers['x-admin-token'];
    if (!adminToken) return res.status(500).json({ error: 'Admin token not configured on server' });
    if (!token || token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const headers = {};
    if (process.env.POKEMON_TCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;

    const results = [];
    for (const p of PACKS_LIST) {
      const setId = p.id;
      try {
        const { data } = await requestWithRetry(`${API_BASE}/cards`, {
          headers,
          params: { q: `set.id:${setId}`, page: 1, pageSize: 1, select: 'id,images' },
        });
        const card = data?.data?.[0];
        const img = card?.images?.large || card?.images?.small || null;
        results.push({ setId, ok: !!img, sampleCardId: card?.id || null, image: img || null });
      } catch (e) {
        results.push({ setId, ok: false, error: e?.response?.status || e?.message });
      }
    }
    return res.json({ results });
  } catch (e) {
    console.error('Error in /api/admin/test-packs:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// In-memory cache for card pools by set to speed up openings and survive transient API issues

async function requestWithRetry(url, options, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await api.get(url, options);
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      // Retry on 429/502/503/504 and network errors
      if (![429, 502, 503, 504].includes(status)) {
        // If there's no HTTP status (network/DNS/timeout), also retry
        if (!status) {
          // proceed to backoff
        } else {
          break;
        }
      }
      // Backoff: ~300ms, 700ms, 1200ms, 2000ms
      const delays = [300, 700, 1200, 2000];
      const delay = delays[Math.min(i, delays.length - 1)];
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function partitionByRarity(cards) {
  const buckets = {
    Common: [],
    Uncommon: [],
    RareOrHigher: [],
  };
  for (const c of cards) {
    const r = c.rarity || 'Unknown';
    if (r === 'Common') buckets.Common.push(c);
    else if (r === 'Uncommon') buckets.Uncommon.push(c);
    else if (r.startsWith('Rare')) buckets.RareOrHigher.push(c);
    else if (['Amazing Rare', 'Promo', 'Rare Holo VSTAR', 'Rare Secret', 'Rare Ultra'].some((k) => r.includes(k))) buckets.RareOrHigher.push(c);
    else {
      // Unknown or Trainer rarities: treat as Uncommon fallback
      buckets.Uncommon.push(c);
    }
  }
  return buckets;
}

async function fetchSetCards(setId) {
  // Paginate through all cards in the set
  const headers = {};
  if (process.env.POKEMON_TCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;
  const pageSize = 250;
  let page = 1;
  let totalCount = Infinity;
  const all = [];
  try {
    while ((page - 1) * pageSize < totalCount) {
      const { data } = await requestWithRetry(`${API_BASE}/cards`, {
        headers,
        params: {
          q: `set.id:${setId}`,
          page,
          pageSize,
          // fetch only fields we need to build packs and show cards
          select: 'id,name,rarity,images,number,set',
        },
      });
      totalCount = data.totalCount ?? data.count ?? (page * pageSize);
      all.push(...(data.data || []));
      page += 1;
    }
  } catch (err) {
    console.error('Error fetching cards from Pokemon TCG API:', err?.response?.status, err?.message);
    throw new Error('CARD_POOL_FETCH_FAILED');
  }
  return all;
}

async function getCardPools(setId) {
  const now = Date.now();
  const cached = CARD_POOL_CACHE.get(setId);
  if (cached && cached.expiry > now) {
    return cached.pools;
  }
  
  const cacheDir = path.join(__dirname, 'cache');
  const setCacheFile = path.join(cacheDir, `${setId}-cards-cache.json`);
  const allCardsFile = path.join(cacheDir, 'all-pokemon-cards.json');
  // Legacy locations (prior caches saved at server root)
  const legacySetCacheFile = path.join(__dirname, `${setId}-cards-cache.json`);
  const legacyAllCardsFile = path.join(__dirname, 'all-pokemon-cards.json');
  
  // Try to get cards from cache first if available
  try {
    let cards = [];
    let usingCache = false;
    
    // First try the individual set cache (new path), then legacy path
    try {
      const cacheText = await fs.readFile(setCacheFile, 'utf-8');
      cards = JSON.parse(cacheText);
      console.log(`Using individual set cache for ${setId} (${cards.length} cards).`);
      usingCache = true;
    } catch (e1) {
      try {
        const legacyText = await fs.readFile(legacySetCacheFile, 'utf-8');
        cards = JSON.parse(legacyText);
        console.log(`Using LEGACY set cache at server root for ${setId} (${cards.length} cards).`);
        usingCache = true;
      } catch (e2) {
        // If no individual cache, try the all-cards cache (new then legacy)
        try {
          const allCardsText = await fs.readFile(allCardsFile, 'utf-8');
          const allCards = JSON.parse(allCardsText);
          cards = allCards.filter(card => card.set?.id === setId);
          
          if (cards.length > 0) {
            console.log(`Using all-cards cache for set ${setId} (${cards.length} cards).`);
            // Save to individual cache for faster access next time
            await fs.mkdir(cacheDir, { recursive: true });
            await fs.writeFile(setCacheFile, JSON.stringify(cards, null, 2));
            usingCache = true;
          } else {
            console.log(`No cards found for set ${setId} in all-cards cache.`);
          }
        } catch (e3) {
          try {
            const legacyAllText = await fs.readFile(legacyAllCardsFile, 'utf-8');
            const allCards = JSON.parse(legacyAllText);
            cards = allCards.filter(card => card.set?.id === setId);
            if (cards.length > 0) {
              console.log(`Using LEGACY all-cards cache for set ${setId} (${cards.length} cards).`);
              await fs.mkdir(cacheDir, { recursive: true });
              await fs.writeFile(setCacheFile, JSON.stringify(cards, null, 2));
              usingCache = true;
            } else {
              console.log(`No cards found for set ${setId} in LEGACY all-cards cache.`);
            }
          } catch (e4) {
            console.log(`No cache found for set ${setId}, will try API`);
          }
        }
      }
    }
    
    // If we have cards from cache, use them
    if (cards.length > 0 && usingCache) {
      const pools = partitionByRarity(cards);
      CARD_POOL_CACHE.set(setId, { expiry: now + CARD_POOL_TTL_MS, pools });
      return pools;
    }
  } catch (e) {
    console.warn(`Cache read failed for ${setId}:`, e.message);
  }
  
  // If we get here, we need to fetch from the API
  console.log(`Fetching cards for set ${setId} from API...`);
  
  try {
    const cards = await fetchSetCards(setId);
    const pools = partitionByRarity(cards);
    
    // Cache the API result for future use
    CARD_POOL_CACHE.set(setId, { expiry: now + CARD_POOL_TTL_MS, pools });
    
    // Also save to the cache file for persistence
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(setCacheFile, JSON.stringify(cards, null, 2));
    } catch (e) {
      console.warn(`Failed to save cache for ${setId}:`, e.message);
    }
    
    return pools;
  } catch (e) {
    // If we have stale cache, serve it instead of placeholder
    if (cached && cached.pools) {
      console.warn(`Using cached card pool for set ${setId} due to fetch failure.`);
      return cached.pools;
    }
    // Build a small fallback pool so users can still try the app offline or if rate-limited
    const placeholder = 'https://images.pokemontcg.io/sv1/1_small.jpg';
    const mk = (id, rarity) => ({ id: `${setId}-${id}`, name: `Sample ${rarity} ${id}`, rarity, images: { small: placeholder, large: placeholder }, set: { id: setId, name: setId } });
    const fallback = {
      Common: Array.from({ length: 20 }, (_, i) => mk(`common-${i + 1}`, 'Common')),
      Uncommon: Array.from({ length: 10 }, (_, i) => mk(`uncommon-${i + 1}`, 'Uncommon')),
      RareOrHigher: Array.from({ length: 10 }, (_, i) => mk(`rare-${i + 1}`, 'Rare')),
    };
    console.warn(`Using fallback local card pool for set ${setId} due to fetch failure.`);
    return fallback;
  }
}

function pickN(arr, n) {
  // Random without replacement
  if (n <= 0) return [];
  const copy = arr.slice();
  const res = [];
  const max = Math.min(n, copy.length);
  for (let i = 0; i < max; i += 1) {
    const idx = Math.floor(Math.random() * copy.length);
    res.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return res;
}

// Routes
app.post('/api/users/register', async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }
    let user = await getUserByUsername(username);
    if (!user) {
      user = await createUser(username);
    }
    return res.json(user);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Rehydrate collection images for a user for entries that have placeholder/missing images
app.post('/api/admin/rehydrate-images', async (req, res) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const token = req.headers['x-admin-token'] || req.body?.token;
    if (!adminToken) return res.status(500).json({ error: 'Admin token not configured on server' });
    if (!token || token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const { username } = req.body || {};
    if (!username || typeof username !== 'string') return res.status(400).json({ error: 'username is required' });

    const db = await getDB();
    const user = await getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Find entries with missing/placeholder images
    const rows = await db.all(
      `SELECT id, card_id, card_image_url FROM user_collections
       WHERE user_id = ? AND (card_image_url IS NULL OR card_image_url = '' OR card_image_url LIKE '%poke-ball.png%')`,
      user.id
    );

    if (!rows.length) return res.json({ updated: 0 });

    // Rehydrate by computing CDN URL from card_id to avoid API timeouts.
    const uniqueIds = Array.from(new Set(rows.map(r => r.card_id))).filter(Boolean);
    const headers = {};
    if (process.env.POKEMON_TCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;

    let updated = 0;
    for (const cid of uniqueIds) {
      // Accept ids like "swsh1-1" or with an extra rarity chunk like "swsh1-common-14"
      const m = typeof cid === 'string' ? cid.match(/^([a-z0-9\.]+)-(?:[a-z\-]+-)?([a-z0-9]+)$/i) : null;
      if (m) {
        const setId = m[1];
        const num = m[2];
        // Pad number to 3 digits for swsh series
        const paddedNum = setId.startsWith('swsh') ? num.padStart(3, '0') : num;
        const directUrlLarge = `https://images.pokemontcg.io/${setId}/${paddedNum}_large.jpg`;
        try {
          await db.run('UPDATE user_collections SET card_image_url = ? WHERE user_id = ? AND card_id = ?', directUrlLarge, user.id, cid);
          updated += await db.get('SELECT changes() AS c').then(r => r.c || 0);
          continue;
        } catch (e) {
          console.warn('Failed to set direct CDN URL for', cid, e?.message);
        }
      }
      // Fallback to API lookup if pattern didn't match
      try {
        const { data } = await requestWithRetry(`${API_BASE}/cards/${cid}`, { headers });
        const card = data?.data;
        const url = card?.images?.large || card?.images?.small || null;
        if (url) {
          await db.run('UPDATE user_collections SET card_image_url = ? WHERE user_id = ? AND card_id = ?', url, user.id, cid);
          updated += await db.get('SELECT changes() AS c').then(r => r.c || 0);
        }
      } catch (e) {
        console.warn('Failed to rehydrate card via API', cid, e?.response?.status || e?.message);
      }
    }

    return res.json({ updated });
  } catch (e) {
    console.error('Error in /api/admin/rehydrate-images:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/users/:username', async (req, res) => {
  try {
    const user = await getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/collections/:username', async (req, res) => {
  try {
    const user = await getUserByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const cards = await getCollectionByUserId(user.id);
    return res.json(cards);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Return fixed packs list captured at server start
app.get('/api/packs', async (_req, res) => {
  if (!PACKS_READY) {
    return res.json([]);
  }
  return res.json(PACKS_LIST);
});

app.post('/api/packs/open', async (req, res) => {
  const db = await getDB();
  let txStarted = false;
  try {
    const { username, setId } = req.body || {};
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }
    const chosenSetId = (typeof setId === 'string' && setId.trim()) ? setId.trim() : 'swsh1';

    // Load user
    const user = await getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.poke_coins < PACK_COST) {
      return res.status(400).json({ error: 'Not enough PokéCoins' });
    }

    // Build pulls from the chosen set BEFORE opening DB transaction (faster and avoids nested tx on failure)
    let pools;
    try {
      pools = await getCardPools(chosenSetId);
    } catch (poolErr) {
      console.error('Failed to obtain card pools:', poolErr);
      return res.status(502).json({ error: 'Failed to fetch card pool. Please try again later.' });
    }

    // Start transaction
    await db.exec('BEGIN');
    txStarted = true;

    // Deduct coins
    await db.run('UPDATE users SET poke_coins = poke_coins - ? WHERE id = ?', [PACK_COST, user.id]);
    const pulled = [];

    // Prepare buckets with graceful degradation if some are empty
    const commonsPool = Array.isArray(pools.Common) ? pools.Common : [];
    const uncommonsPool = Array.isArray(pools.Uncommon) ? pools.Uncommon : commonsPool;
    const rarePool = Array.isArray(pools.RareOrHigher) && pools.RareOrHigher.length > 0
      ? pools.RareOrHigher
      : (uncommonsPool.length > 0 ? uncommonsPool : commonsPool);

    // 1 guaranteed Rare or higher (fallback to next available pool)
    const rare = pickN(rarePool, 1);
    pulled.push(...rare);

    // 3 Uncommons (fallback to commons)
    const uncommons = pickN(uncommonsPool.length > 0 ? uncommonsPool : commonsPool, 3);
    pulled.push(...uncommons);

    // 6 Commons (fallback to uncommons then rares)
    const commons = pickN(
      commonsPool.length > 0 ? commonsPool : (uncommonsPool.length > 0 ? uncommonsPool : rarePool),
      6
    );
    pulled.push(...commons);

    // Top-up to ensure exactly 10 cards if any bucket was short
    if (pulled.length < 10) {
      const anyPool = (pools.Common || []).concat(pools.Uncommon || []).concat(pools.RareOrHigher || []);
      if (anyPool.length > 0) {
        const needed = 10 - pulled.length;
        pulled.push(...pickN(anyPool, needed));
      }
    }

    // Persist the pulls (includes set info per card)
    await addCardsToCollection(user.id, pulled);

    // Commit
    await db.exec('COMMIT');
    txStarted = false;

    // Return updated user balance and pulled cards
    const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', user.id);
    // Attempt to get set name from first card (falls back to setId)
    const setName = pulled[0]?.set?.name || chosenSetId;
    return res.json({ user: updatedUser, cards: pulled, set: { id: chosenSetId, name: setName } });
  } catch (e) {
    console.error('Error in /api/packs/open:', e);
    if (txStarted) {
      try { await db.exec('ROLLBACK'); } catch (e2) { console.error('Rollback failed', e2); }
    }
    return res.status(500).json({ error: 'Server error opening pack' });
  }
});

// Enhanced health check endpoint for Render
app.get('/health', (_req, res) => {
  // Return detailed health status
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Admin: Set coins (protected by ADMIN_TOKEN)
app.post('/api/admin/set-coins', async (req, res) => {
  try {
    const adminToken = process.env.ADMIN_TOKEN;
    const token = req.headers['x-admin-token'] || req.body?.token;
    if (!adminToken) return res.status(500).json({ error: 'Admin token not configured on server' });
    if (!token || token !== adminToken) return res.status(401).json({ error: 'Unauthorized' });

    const { username, amount } = req.body || {};
    if (!username || typeof username !== 'string') return res.status(400).json({ error: 'username is required' });
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed < 0) return res.status(400).json({ error: 'amount must be a non-negative number' });

    const user = await getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const updated = await setPokeCoins(user.id, Math.floor(parsed));
    return res.json(updated);
  } catch (e) {
    console.error('Error in /api/admin/set-coins:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Start server with error handling
try {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}

// Simple image proxy to avoid client-side CORS/referrer blocking issues
app.get('/api/proxy-image', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return res.status(400).send('Invalid url');
    }
    const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'pokemon-tcg-pack-app/1.0' } });
    const ct = r.headers['content-type'] || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    // cache for 1 day
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    return res.send(Buffer.from(r.data));
  } catch (e) {
    console.error('proxy-image error:', e?.message || e);
    return res.status(502).send('Bad gateway');
  }
});

// Games: Guess the Silhouette
// Start a new challenge: pick a random card from a random available set and return a token + image URL
app.post('/api/games/silhouette/start', async (_req, res) => {
  try {
    // Use PokeAPI official artwork for a clean silhouette
    // Try up to 10 random ids in range [1, 1025] to find an entry with artwork
    const maxId = 1025;
    let picked = null;
    for (let i = 0; i < 10; i += 1) {
      const id = 1 + Math.floor(Math.random() * maxId);
      try {
        const { data } = await api.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const img = data?.sprites?.other?.['official-artwork']?.front_default
          || data?.sprites?.other?.dream_world?.front_default
          || data?.sprites?.front_default
          || null;
        const name = data?.name;
        if (img && name) {
          picked = { name, image: img };
          break;
        }
      } catch (e) {
        // try another id on 404/network errors
      }
    }
    if (!picked) return res.status(503).json({ error: 'No suitable Pokémon found. Try again.' });

    const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const payload = {
      answer: String(picked.name).toLowerCase(),
      image: picked.image,
      createdAt: Date.now(),
    };
    SILHOUETTE_GAMES.set(token, payload);
    setTimeout(() => SILHOUETTE_GAMES.delete(token), 10 * 60 * 1000).unref?.();

    return res.json({ token, image: payload.image });
  } catch (e) {
    console.error('Error in /api/games/silhouette/start:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Submit a guess. If correct (normalized), award +200 coins and return updated user
app.post('/api/games/silhouette/guess', async (req, res) => {
  const db = await getDB();
  let tx = false;
  try {
    const { username, token, guess } = req.body || {};
    if (!username || typeof username !== 'string') return res.status(400).json({ error: 'username is required' });
    if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token is required' });
    const game = SILHOUETTE_GAMES.get(token);
    if (!game) return res.status(400).json({ error: 'Invalid or expired challenge' });

    const user = await getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const norm = (s) => String(s || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[-'\.]/g, '')
      .trim();
    const correct = norm(guess) && norm(guess) === norm(game.answer);
    const toTitle = (s) => String(s || '').split(/[-\s]+/g).map(w => w ? (w[0].toUpperCase() + w.slice(1)) : '').join(' ');
    const pokemonName = toTitle(game.answer);

    let updated = user;
    await db.exec('BEGIN');
    tx = true;
    if (correct) {
      await db.run('UPDATE users SET poke_coins = poke_coins + 200 WHERE id = ?', user.id);
    }
    await db.exec('COMMIT');
    tx = false;
    updated = await db.get('SELECT * FROM users WHERE id = ?', user.id);

    // One-shot token: remove whether correct or not to prevent brute-force
    SILHOUETTE_GAMES.delete(token);

    return res.json({ correct, user: updated, answer: correct ? undefined : game.answer, pokemonName, image: game.image, set: { id: game.setId, name: game.setName } });
  } catch (e) {
    console.error('Error in /api/games/silhouette/guess:', e);
    if (tx) {
      try { await db.exec('ROLLBACK'); } catch (e2) { console.error('Rollback failed', e2); }
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// Games: Spin the Wheel
// Outcomes (approx weights):
// - Lose 50 coins (10%)
// - +50 coins (35%)
// - +100 coins (25%)
// - +250 coins (10%)
// - Free random pack (20%)
app.post('/api/games/spin', async (req, res) => {
  const db = await getDB();
  let tx = false;
  try {
    const { username } = req.body || {};
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }
    const user = await getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Determine outcome
    const r = Math.random();
    let outcome = { type: 'coins', delta: 50, label: '+50 coins' };
    if (r < 0.10) outcome = { type: 'coins', delta: -50, label: 'Lose 50 coins' };
    else if (r < 0.45) outcome = { type: 'coins', delta: 50, label: '+50 coins' };
    else if (r < 0.70) outcome = { type: 'coins', delta: 100, label: '+100 coins' };
    else if (r < 0.80) outcome = { type: 'coins', delta: 250, label: '+250 coins' };
    else outcome = { type: 'free_pack', label: 'Free random pack' };

    await db.exec('BEGIN');
    tx = true;

    let packResult = null;
    if (outcome.type === 'coins') {
      // Clamp at 0 using MAX()
      await db.run('UPDATE users SET poke_coins = MAX(poke_coins + ?, 0) WHERE id = ?', [outcome.delta, user.id]);
    } else if (outcome.type === 'free_pack') {
      // Choose a random available set from PACKS_LIST
      const chosen = Array.isArray(PACKS_LIST) && PACKS_LIST.length > 0
        ? PACKS_LIST[Math.floor(Math.random() * PACKS_LIST.length)].id
        : 'sv1';
      // Build pulls (same logic as /api/packs/open but without coin deduction)
      let pools;
      try {
        pools = await getCardPools(chosen);
      } catch (poolErr) {
        console.error('Spin: failed to get pools', poolErr);
        await db.exec('ROLLBACK');
        tx = false;
        return res.status(502).json({ error: 'Failed to fetch card pool. Try again.' });
      }
      const commonsPool = Array.isArray(pools.Common) ? pools.Common : [];
      const uncommonsPool = Array.isArray(pools.Uncommon) ? pools.Uncommon : commonsPool;
      const rarePool = Array.isArray(pools.RareOrHigher) && pools.RareOrHigher.length > 0
        ? pools.RareOrHigher
        : (uncommonsPool.length > 0 ? uncommonsPool : commonsPool);

      const pulled = [];
      pulled.push(...pickN(rarePool, 1));
      pulled.push(...pickN(uncommonsPool.length > 0 ? uncommonsPool : commonsPool, 3));
      pulled.push(...pickN(commonsPool.length > 0 ? commonsPool : (uncommonsPool.length > 0 ? uncommonsPool : rarePool), 6));
      if (pulled.length < 10) {
        const anyPool = (pools.Common || []).concat(pools.Uncommon || []).concat(pools.RareOrHigher || []);
        if (anyPool.length > 0) pulled.push(...pickN(anyPool, 10 - pulled.length));
      }

      await addCardsToCollection(user.id, pulled);
      const setName = pulled[0]?.set?.name || chosen;
      packResult = { set: { id: chosen, name: setName }, cards: pulled };
    }

    await db.exec('COMMIT');
    tx = false;

    const updated = await db.get('SELECT * FROM users WHERE id = ?', user.id);
    return res.json({ outcome, user: updated, pack: packResult });
  } catch (e) {
    console.error('Error in /api/games/spin:', e);
    if (tx) {
      try { await db.exec('ROLLBACK'); } catch (e2) { console.error('Rollback failed', e2); }
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

// On startup: fetch latest 16 sets once and keep them static until restart
(async function preloadLatestSets() {
  try {
    // 1) Try local override first
    try {
      const text = await fs.readFile(LOCAL_PACKS_PATH, 'utf-8');
      const data = JSON.parse(text);
      PACKS_LIST = data;
      PACKS_READY = true;
      console.log(`Loaded ${PACKS_LIST.length} packs from local packs.local.json`);
      return;
    } catch (e) {
      console.log('No local packs file found, trying cache...');
    }
    
    // 2) Try cache
    try {
      const text = await fs.readFile(CACHE_PACKS_PATH, 'utf-8');
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        PACKS_LIST = data;
        PACKS_READY = true;
        console.log(`Loaded ${PACKS_LIST.length} packs from cache`);
        return;
      }
      throw new Error('Cache file is empty');
    } catch (e) {
      console.log('No valid cache found, fetching from API...');
    }
    
    // 3) Fall back to API
    try {
      const headers = {};
      if (process.env.POKEMON_TCG_API_KEY) {
        headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY;
      }
      
      const { data } = await axios.get(`${API_BASE}/sets`, {
        headers,
        params: { orderBy: '-releaseDate', pageSize: 16 },
      });
      
      PACKS_LIST = (data.data || []).map(s => ({
        id: s.id,
        name: s.name,
        images: s.images,
        cost: PACK_COST,
      }));
      
      // Write cache for next time
      try { 
        await fs.writeFile(CACHE_PACKS_PATH, JSON.stringify(PACKS_LIST, null, 2), 'utf-8');
      } catch (e) {
        console.warn('Failed to write cache file:', e.message);
      }
      
      PACKS_READY = true;
      console.log(`Loaded ${PACKS_LIST.length} packs from API (cached to packs.cache.json).`);
      return;
    } catch (e) {
      console.warn('Could not fetch from API, using fallback packs...', e?.message);
    }
    
    // 4) Final fallback - use built-in packs if everything else fails
    PACKS_LIST = [
      { id: 'sv1', name: 'Scarlet & Violet', series: 'Scarlet & Violet', releaseDate: '2023/03/31', images: {}, cost: PACK_COST },
      { id: 'sv2', name: 'Paldea Evolved', series: 'Scarlet & Violet', releaseDate: '2023/06/09', images: {}, cost: PACK_COST },
      { id: 'swsh12pt5', name: 'Crown Zenith', series: 'Sword & Shield', releaseDate: '2023/01/20', images: {}, cost: PACK_COST },
      { id: 'swsh12', name: 'Silver Tempest', series: 'Sword & Shield', releaseDate: '2022/11/11', images: {}, cost: PACK_COST }
    ];
    PACKS_READY = true;
    console.warn('Using fallback pack list with', PACKS_LIST.length, 'packs');
  } catch (e) {
    console.error('Unexpected error in preloadLatestSets:', e);
    // Ensure we always have at least one pack available
    PACKS_LIST = [{ id: 'sv1', name: 'Scarlet & Violet', series: 'Scarlet & Violet', releaseDate: '2023/03/31', images: {}, cost: PACK_COST }];
    PACKS_READY = true;
  }
})();
