const https = require('https');
const fs = require('fs');

// Function to fetch all cards from Pokemon TCG API
async function fetchAllPokemonCards() {
  console.log('🚀 Starting complete Pokemon card database fetch...');
  
  const allCards = [];
  let page = 1;
  let totalFetched = 0;
  
  while (true) {
    try {
      console.log(`📄 Fetching page ${page}...`);
      
      const cards = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.pokemontcg.io',
          path: `/v2/cards?page=${page}&pageSize=250`,
          method: 'GET',
          headers: {
            'User-Agent': 'Pokemon-Pack-App/1.0'
          }
        };

        const req = https.request(options, (res) => {
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
        req.setTimeout(10000, () => reject(new Error('Timeout')));
        req.end();
      });

      if (cards.length === 0) {
        console.log('✅ No more cards found. Fetch complete!');
        break;
      }

      // Clean and format cards
      const cleanCards = cards.map(card => ({
        id: card.id,
        name: card.name,
        rarity: card.rarity || 'Common',
        images: {
          small: card.images?.small || '',
          large: card.images?.large || ''
        },
        set: { 
          id: card.set?.id || 'unknown', 
          name: card.set?.name || 'Unknown Set' 
        },
        number: card.number || '0',
        types: card.types || [],
        hp: card.hp || null,
        attacks: card.attacks || []
      }));

      allCards.push(...cleanCards);
      totalFetched += cleanCards.length;
      
      console.log(`   ✓ Fetched ${cleanCards.length} cards (Total: ${totalFetched})`);
      
      // Save progress every 10 pages
      if (page % 10 === 0) {
        fs.writeFileSync('server/all-pokemon-cards-backup.json', JSON.stringify(allCards, null, 2));
        console.log(`💾 Backup saved at page ${page}`);
      }
      
      page++;
      
      // Rate limiting - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Error on page ${page}:`, error.message);
      
      // Wait longer on error and retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }
  }

  // Save final complete database
  fs.writeFileSync('server/all-pokemon-cards.json', JSON.stringify(allCards, null, 2));
  
  console.log(`🎉 Complete! Fetched ${totalFetched} Pokemon cards total`);
  console.log(`📁 Saved to: server/all-pokemon-cards.json`);
  
  // Create set-specific caches
  const setGroups = {};
  allCards.forEach(card => {
    const setId = card.set.id;
    if (!setGroups[setId]) setGroups[setId] = [];
    setGroups[setId].push(card);
  });
  
  console.log(`📦 Found ${Object.keys(setGroups).length} different sets`);
  
  // Save individual set caches
  for (const [setId, cards] of Object.entries(setGroups)) {
    if (cards.length > 0) {
      fs.writeFileSync(`server/${setId}-cards-cache.json`, JSON.stringify(cards, null, 2));
      console.log(`   ✓ ${setId}: ${cards.length} cards`);
    }
  }
  
  return allCards;
}

// Run the fetch
fetchAllPokemonCards().catch(console.error);
