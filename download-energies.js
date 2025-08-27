import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create energy directory if it doesn't exist
const energyDir = path.join(__dirname, 'client', 'public', 'assets', 'energy');
if (!fs.existsSync(energyDir)) {
  fs.mkdirSync(energyDir, { recursive: true });
  console.log('Created energy directory:', energyDir);
}

// Energy types and their corresponding image URLs
const energyTypes = [
  { id: 'grass', url: 'https://archives.bulbagarden.net/media/upload/8/87/GrassEnergy.png' },
  { id: 'fire', url: 'https://archives.bulbagarden.net/media/upload/3/3c/FireEnergy.png' },
  { id: 'water', url: 'https://archives.bulbagarden.net/media/upload/8/80/WaterEnergy.png' },
  { id: 'lightning', url: 'https://archives.bulbagarden.net/media/upload/7/7b/LightningEnergy.png' },
  { id: 'psychic', url: 'https://archives.bulbagarden.net/media/upload/8/87/PsychicEnergy.png' },
  { id: 'fighting', url: 'https://archives.bulbagarden.net/media/upload/9/9b/FightingEnergy.png' },
  { id: 'darkness', url: 'https://archives.bulbagarden.net/media/upload/0/0f/DarknessEnergy.png' },
  { id: 'metal', url: 'https://archives.bulbagarden.net/media/upload/2/2c/MetalEnergy.png' },
  { id: 'colorless', url: 'https://archives.bulbagarden.net/media/upload/0/0f/ColorlessEnergy.png' },
  { id: 'fairy', url: 'https://archives.bulbagarden.net/media/upload/3/3c/FairyEnergy.png' },
  { id: 'dragon', url: 'https://archives.bulbagarden.net/media/upload/7/70/DragonEnergy.png' }
];

// Function to download a file
function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', error => {
      fs.unlink(filepath, () => {}); // Delete the file if there's an error
      reject(error);
    });
  });
}

// Download all energy icons
async function downloadAllEnergies() {
  console.log('Starting energy icon downloads...');
  
  for (const energy of energyTypes) {
    const filename = `${energy.id}.png`;
    const filepath = path.join(energyDir, filename);
    
    try {
      console.log(`Downloading ${energy.id} energy...`);
      await downloadFile(energy.url, filepath);
      console.log(`✅ Downloaded ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to download ${energy.id}:`, error.message);
    }
  }
  
  console.log('\nAll downloads completed!');
  console.log(`Energy icons saved to: ${energyDir}`);
}

// Run the download process
downloadAllEnergies().catch(console.error);
