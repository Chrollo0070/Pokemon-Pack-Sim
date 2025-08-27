import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export async function initDB() {
  if (db) return db;
  db = await open({
    filename: path.join(__dirname, 'db.sqlite'),
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      poke_coins INTEGER DEFAULT 1000
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      card_id TEXT,
      card_image_url TEXT,
      card_rarity TEXT,
      set_id TEXT,
      set_name TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Lightweight migration for existing DBs: add missing columns if not present
  const cols = await db.all("PRAGMA table_info('user_collections')");
  const names = new Set(cols.map(c => c.name));
  if (!names.has('set_id')) {
    try { await db.exec('ALTER TABLE user_collections ADD COLUMN set_id TEXT'); } catch (e) { /* ignore if fails */ }
  }
  if (!names.has('set_name')) {
    try { await db.exec('ALTER TABLE user_collections ADD COLUMN set_name TEXT'); } catch (e) { /* ignore if fails */ }
  }

  return db;
}

export async function getDB() {
  return initDB();
}

export async function getUserByUsername(username) {
  const dbi = await initDB();
  return dbi.get('SELECT * FROM users WHERE username = ?', username);
}

export async function createUser(username) {
  const dbi = await initDB();
  await dbi.run('INSERT INTO users (username, poke_coins) VALUES (?, ?)', [username, 1000]);
  return getUserByUsername(username);
}

export async function updatePokeCoins(userId, delta) {
  const dbi = await initDB();
  await dbi.run('UPDATE users SET poke_coins = poke_coins + ? WHERE id = ?', [delta, userId]);
  return dbi.get('SELECT * FROM users WHERE id = ?', userId);
}

export async function setPokeCoins(userId, amount) {
  const dbi = await initDB();
  await dbi.run('UPDATE users SET poke_coins = ? WHERE id = ?', [amount, userId]);
  return dbi.get('SELECT * FROM users WHERE id = ?', userId);
}

export async function addCardsToCollection(userId, cards) {
  const dbi = await initDB();
  const stmt = await dbi.prepare(
    'INSERT INTO user_collections (user_id, card_id, card_image_url, card_rarity, set_id, set_name) VALUES (?, ?, ?, ?, ?, ?)'
  );
  try {
    for (const c of cards) {
      const setId = c.set?.id || null;
      const setName = c.set?.name || null;
      await stmt.run(userId, c.id, c.images?.large || c.images?.small || c.imageUrl || '', c.rarity || 'Unknown', setId, setName);
    }
  } finally {
    await stmt.finalize();
  }
}

export async function getCollectionByUserId(userId) {
  const dbi = await initDB();
  return dbi.all('SELECT * FROM user_collections WHERE user_id = ? ORDER BY id DESC', userId);
}
