// constants/memoryModes.js

// Energy types for each difficulty level
export const DIFFICULTY_ENERGIES = {
  easy: ["grass", "fire", "water"],
  medium: ["grass", "fire", "water", "lightning", "psychic", "fighting"],
  hard: ["grass", "fire", "water", "lightning", "psychic", "fighting", "darkness", "metal", "colorless", "fairy"] // More energy types for 16 cards
};

// Game mode configurations
export const MODES = {
  easy: {
    name: 'Easy',
    pairs: 3, // 6 cards total (3 pairs)
    grid: { rows: 2, cols: 3 }, // 2x3 grid
    startRevealMs: 3000, // 3 seconds
    totalTime: 30, // 30 seconds
    mismatchPenalty: 0, // No time penalty
    flipBackMs: 600, // 600ms flip back delay
    hints: {
      peek: 1, // 1 free peek
      shuffle: 0
    },
    baseReward: 5, // per pair
    timeBonusMultiplier: 1, // +1 coin per second left
    perfectBonus: 10, // +10 coins for perfect game
    streakMultiplier: 1.0, // No streak bonus in easy mode
    maxStreakMultiplier: 1.0,
  },
  medium: {
    name: 'Medium',
    pairs: 6, // 12 cards total (6 pairs)
    grid: { rows: 3, cols: 4 }, // 3x4 grid
    startRevealMs: 2000, // 2 seconds
    totalTime: 45, // 45 seconds
    mismatchPenalty: 1, // -1s per mismatch
    flipBackMs: 600,
    hints: {
      peek: 1, // 1 peek or 1 shuffle
      shuffle: 1
    },
    baseReward: 8, // per pair
    timeBonusMultiplier: 1.5, // +1.5 coins per second left
    perfectBonus: 25,
    streakMultiplier: 1.1, // 10% increase per match
    maxStreakMultiplier: 1.5,
  },
  hard: {
    name: 'Hard',
    pairs: 8, // 16 cards total (8 pairs)
    grid: { rows: 4, cols: 4 }, // 4x4 grid
    startRevealMs: 2000, // Same as medium mode
    totalTime: 60, // 60 seconds
    mismatchPenalty: 2, // -2s per mismatch
    flipBackMs: 600, // Same as easy/medium
    hints: {
      peek: 0,
      shuffle: 1 // Cost 10 coins to use
    },
    baseReward: 10, // per pair
    timeBonusMultiplier: 2, // +2 coins per second left
    perfectBonus: 50,
    streakMultiplier: 1.2, // 20% increase per match
    maxStreakMultiplier: 2.0,
    suddenDeathThreshold: 10, // When time < 10s, speed up
    shuffleCost: 10 // Cost to use shuffle in coins
  }
};

// Energy type configurations
export const ENERGY_IMAGES = {
  grass: {
    name: "Grass",
    color: "bg-green-600",
    url: "/assets/energy/grass.png"
  },
  fire: {
    name: "Fire",
    color: "bg-red-600",
    url: "/assets/energy/fire.png"
  },
  water: {
    name: "Water",
    color: "bg-blue-600",
    url: "/assets/energy/water.png"
  },
  lightning: {
    name: "Lightning",
    color: "bg-yellow-500",
    url: "/assets/energy/lightning.png"
  },
  psychic: {
    name: "Psychic",
    color: "bg-purple-600",
    url: "/assets/energy/psychic.png"
  },
  fighting: {
    name: "Fighting",
    color: "bg-orange-600",
    url: "/assets/energy/fighting.png"
  },
  darkness: {
    name: "Darkness",
    color: "bg-gray-800 text-white",
    url: "/assets/energy/darkness.png"
  },
  metal: {
    name: "Metal",
    color: "bg-gray-400 text-black",
    url: "/assets/energy/metal.png"
  },
  colorless: {
    name: "Colorless",
    color: "bg-white text-black",
    url: "/assets/energy/colorless.png"
  }
};

