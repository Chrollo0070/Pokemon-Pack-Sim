// Local energy images from /public/assets/energy/
export const ENERGY_IMAGES = {
  grass: {
    name: 'Grass',
    url: '/assets/energy/grass.png',
    color: 'bg-green-100',
  },
  fire: {
    name: 'Fire',
    url: '/assets/energy/fire.png',
    color: 'bg-red-100',
  },
  water: {
    name: 'Water',
    url: '/assets/energy/water.png',
    color: 'bg-blue-100',
  },
  lightning: {
    name: 'Lightning',
    url: '/assets/energy/lightning.png',
    color: 'bg-yellow-100',
  },
  psychic: {
    name: 'Psychic',
    url: '/assets/energy/psychic.png',
    color: 'bg-purple-100',
  },
  fighting: {
    name: 'Fighting',
    url: '/assets/energy/fighting.png',
    color: 'bg-amber-800',
  },
  darkness: {
    name: 'Darkness',
    url: '/assets/energy/darkness.png',
    color: 'bg-gray-800',
  },
  metal: {
    name: 'Metal',
    url: '/assets/energy/metal.png',
    color: 'bg-gray-300',
  },
  dragon: {
    name: 'Dragon',
    url: '/assets/energy/dragon.png',
    color: 'bg-gradient-to-br from-purple-600 to-amber-400',
  },
  fairy: {
    name: 'Fairy',
    url: '/assets/energy/fairy.png',
    color: 'bg-pink-100',
  },
  colorless: {
    name: 'Colorless',
    url: '/assets/energy/colorless.png',
    color: 'bg-gray-100',
  },
}

// Export just the energy types for easy iteration
export const ENERGY_TYPES = Object.keys(ENERGY_IMAGES)
