# Pokémon TCG Pack Opening - Backend (Express + SQLite)

## Requirements
- Node.js 18+

## Setup
1. Install deps:
```bash
npm install
```
2. Create `.env` (optional) by copying `.env.example` and filling values:
```bash
cp .env.example .env
```
3. Start the server:
```bash
npm start
```
Server runs at `http://localhost:3001` by default.

## Environment Variables
- `PORT` (default: 3001)
- `PACK_COST` (default: 100)
- `POKEMON_TCG_API_KEY` (optional; get at https://dev.pokemontcg.io/)

## API
- `POST /api/users/register` { username }
- `GET /api/users/:username`
- `GET /api/collections/:username`
- `POST /api/packs/open` { username }

## Notes
- Uses SQLite at `server/db.sqlite`.
- On first run, creates tables `users` and `user_collections`.
- Caches card pool from set `swsh1` in-memory to reduce API calls.
