import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, 'cache');
const ALL_CARDS_FILE = path.join(CACHE_DIR, 'all-pokemon-cards.json');

// Create cache directory if it doesn't exist
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

export async function fetchAllPokemonCards() {
  console.log('🚀 Starting complete Pokemon card database fetch...');
  await ensureCacheDir();
  
  const allCards = [];
  let page = 1;
  let totalFetched = 0;
  const apiKey = process.env.POKEMON_TCG_API_KEY;
  
  if (!apiKey) {
    throw new Error('POKEMON_TCG_API_KEY environment variable is not set');
  }

  while (true) {
    try {
      console.log(`📄 Fetching page ${page}...`);
      
      const cards = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.pokemontcg.io',
          path: `/v2/cards?page=${page}&pageSize=250`,
          method: 'GET',
          headers: {
            'X-Api-Key': apiKey,
            'User-Agent': 'Pokemon-Pack-App/1.0'
          },
          timeout: 30000 // 30 second timeout
        };

        const req = https.request(options, (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`API request failed with status ${res.statusCode}`));
          }
          
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              resolve(response.data || []);
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timed out'));
        });
        
        req.end();
      });

      if (!cards || cards.length === 0) {
        console.log('✅ No more cards found. Fetch complete!');
        break;
      }

      // Clean and format cards
      const cleanCards = cards.map(card => ({
        id: card.id,
        name: card.name,
        images: card.images,
        set: card.set,
        rarity: card.rarity,
        number: card.number,
        tcgplayer: card.tcgplayer,
        cardmarket: card.cardmarket
      }));

      allCards.push(...cleanCards);
      totalFetched += cards.length;
      console.log(`📊 Fetched ${cards.length} cards (total: ${totalFetched})`);
      
      // Save progress after each page
      await fs.writeFile(
        ALL_CARDS_FILE + '.tmp',
        JSON.stringify(allCards, null, 2),
        'utf-8'
      );
      
      // Rename temp file to final file
      await fs.rename(ALL_CARDS_FILE + '.tmp', ALL_CARDS_FILE);
      
      // Rate limiting: be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      page++;
      
    } catch (error) {
      console.error(`❌ Error fetching page ${page}:`, error.message);
      
      // If we have some cards, save what we have before failing
      if (allCards.length > 0) {
        console.log('💾 Saving partial results...');
        await fs.writeFile(
          ALL_CARDS_FILE + '.partial',
          JSON.stringify(allCards, null, 2),
          'utf-8'
        );
        console.log(`💾 Partial results saved to ${ALL_CARDS_FILE}.partial`);
      }
      
      throw error;
    }
  }
  
  console.log(`🎉 Successfully fetched ${allCards.length} cards!`);
  
  // Group cards by set and save individual set caches
  const cardsBySet = {};
  allCards.forEach(card => {
    if (!card.set || !card.set.id) return;
    if (!cardsBySet[card.set.id]) {
      cardsBySet[card.set.id] = [];
    }
    cardsBySet[card.set.id].push(card);
  });
  
  // Save individual set caches
  await Promise.all(
    Object.entries(cardsBySet).map(async ([setId, cards]) => {
      const setCacheFile = path.join(CACHE_DIR, `${setId}-cards-cache.json`);
      await fs.writeFile(setCacheFile, JSON.stringify(cards, null, 2), 'utf-8');
      console.log(`💾 Saved ${cards.length} cards for set ${setId}`);
    })
  );
  
  return {
    totalCards: allCards.length,
    totalSets: Object.keys(cardsBySet).length,
    lastUpdated: new Date().toISOString()
  };
}

// If this file is run directly, execute the fetch
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchAllPokemonCards()
    .then(result => {
      console.log('✅ Fetch completed successfully!', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Fetch failed:', error);
      process.exit(1);
    });
}
