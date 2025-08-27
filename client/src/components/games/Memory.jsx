import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '../../state/UserContext.jsx'
import { api } from '../../utils/api.js'
import { MODES, ENERGY_IMAGES, DIFFICULTY_ENERGIES } from '../../constants/memoryModes'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Memory Game Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900/50 rounded-lg text-center">
          <h3 className="text-lg font-bold text-red-200">Something went wrong</h3>
          <p className="text-red-100">The memory game encountered an error. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
          >
            Reload Game
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Create energy pool based on difficulty
const getEnergyPool = (difficulty = 'easy') => {
  return DIFFICULTY_ENERGIES[difficulty].map(type => ({
    id: type,
    name: ENERGY_IMAGES[type]?.name || type,
    color: ENERGY_IMAGES[type]?.color || 'bg-gray-100',
    imageUrl: ENERGY_IMAGES[type]?.url || ''
  }));
};

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildDeck(mode) {
  const m = MODES[mode] || MODES.easy // Fallback to easy mode if invalid
  
  // Get available energy types from energy pool
  const energyPool = getEnergyPool(mode);
  const availableEnergies = energyPool.reduce((acc, energy) => {
    acc[energy.id] = energy;
    return acc;
  }, {});
  
  // Choose specified energies by mode, only including those that exist in availableEnergies
  const pickOrder = {
    easy: ['grass', 'fire', 'water'],
    medium: ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting'],
    hard: ['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'colorless', 'fairy'],
  }[mode] || ['grass', 'fire', 'water'];
  
  const chosen = pickOrder
    .filter(id => availableEnergies[id]) // Only include available energies
    .slice(0, m.pairs) // Take only as many as needed for the mode
    .map(id => availableEnergies[id]);
    
  // Create pairs
  const pairs = [];
  chosen.forEach(energy => {
    pairs.push({ ...energy });
    pairs.push({ ...energy });
  });
  
  // Shuffle and create deck
  return shuffle(pairs).map((energy, idx) => ({
    key: `${energy.id}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    energy,
    faceUp: false,
    matched: false,
  }));
}

function MemoryGame() {
  const { user, updateBalance } = useUser()
  const [mode, setMode] = useState('easy')
  const [deck, setDeck] = useState([])
  const [first, setFirst] = useState(null)
  const [second, setSecond] = useState(null)
  const [busy, setBusy] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [running, setRunning] = useState(false)
  const [mismatches, setMismatches] = useState(0)
  const [streak, setStreak] = useState(0)
  const [streakMax, setStreakMax] = useState(0)
  const [peekLeft, setPeekLeft] = useState(0)
  const [shuffleLeft, setShuffleLeft] = useState(0)
  const [summary, setSummary] = useState(null) // {won, coins, breakdown}
  const [initialReveal, setInitialReveal] = useState(false)
  const [peekedCards, setPeekedCards] = useState([])
  const timerRef = useRef(null)
  const gameStartTime = useRef(0)

  const cfg = MODES[mode] || MODES.easy // Fallback to easy mode if invalid
  const matchedCount = deck.filter(c => c.matched).length / 2
  const allMatched = matchedCount === (cfg?.pairs || 0)
  const timeBonus = Math.floor(timeLeft * (cfg.timeBonusMultiplier || 1))
  const perfectGame = mismatches === 0 && allMatched
  const finalScore = allMatched 
    ? (matchedCount * (cfg.baseReward || 5)) + timeBonus + (perfectGame ? (cfg.perfectBonus || 0) : 0)
    : 0

  const [viewportNarrow, setViewportNarrow] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 640 : false))
  useEffect(() => {
    const onResize = () => setViewportNarrow(window.innerWidth < 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const gridStyle = useMemo(() => {
    try {
      // Ensure we always have a valid grid configuration
      const gridConfig = cfg?.grid || { rows: 2, cols: 3 };
      const gridCols = gridConfig.cols || 3;
      
      // For hard mode on mobile, use a more compact layout
      const adjustedCols = (mode === 'hard' && viewportNarrow) 
        ? Math.min(4, gridCols) 
        : gridCols;
        
      return { 
        gridTemplateColumns: `repeat(${Math.max(1, adjustedCols)}, minmax(0, 1fr))`,
        gap: '0.75rem' // Consistent gap
      };
    } catch (error) {
      console.error('Error calculating grid style:', error);
      return { 
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '0.75rem'
      };
    }
  }, [cfg?.grid, mode, viewportNarrow])

  // Initialize the game
  const initGame = (difficulty) => {
    const modeCfg = MODES[difficulty] || MODES.easy
    const deck = buildDeck(difficulty)
    setDeck(deck)
    setFirst(null)
    setSecond(null)
    setBusy(false)
    setTimeLeft(modeCfg.totalTime)
    setMismatches(0)
    setStreak(0)
    setStreakMax(0)
    setPeekLeft(modeCfg.hints?.peek || 0)
    setShuffleLeft(modeCfg.hints?.shuffle || 0)
    setSummary(null)
    setPeekedCards([])
    setInitialReveal(false) // Reset initial reveal state
    gameStartTime.current = Date.now()
    
    // Initial reveal if configured
    if (modeCfg.startRevealMs > 0) {
      setInitialReveal(true)
      // Reveal all cards
      setDeck(prevDeck => 
        prevDeck.map(card => ({ ...card, faceUp: true }))
      )
      // Hide cards after reveal time
      setTimeout(() => {
        setInitialReveal(false)
        setDeck(prevDeck => 
          prevDeck.map(card => ({ ...card, faceUp: false }))
        )
        // Start the game timer after initial reveal
        setRunning(true)
      }, modeCfg.startRevealMs)
    } else {
      setInitialReveal(false)
      setRunning(true)
    }
  }
  
  // Start a new game
  const startGame = (difficulty) => {
    // Clear any existing timers
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    setMode(difficulty)
    initGame(difficulty)
  }
  
  // Peek at random cards
  const usePeek = () => {
    if (peekLeft <= 0 || busy || !running) return
    
    // Find all face-down, unmatched cards
    const faceDownIndices = deck
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !card.faceUp && !card.matched)
      .map(({ index }) => index)
    
    if (faceDownIndices.length < 2) return // Not enough cards to peek at
    
    // Shuffle and pick 2 random cards
    const shuffled = [...faceDownIndices].sort(() => Math.random() - 0.5)
    const cardsToPeek = shuffled.slice(0, 2)
    
    // Show the peeked cards
    setPeekedCards(cardsToPeek)
    setDeck(prevDeck => 
      prevDeck.map((card, i) => 
        cardsToPeek.includes(i) ? { ...card, faceUp: true } : card
      )
    )
    
    // Hide them after 1 second
    setTimeout(() => {
      setDeck(prevDeck => 
        prevDeck.map((card, i) => 
          cardsToPeek.includes(i) && !card.matched 
            ? { ...card, faceUp: false } 
            : card
        )
      )
      setPeekedCards([])
    }, 1000)
    
    // Decrement peek count
    setPeekLeft(prev => prev - 1)
  }
  
  // Shuffle the remaining face-down cards
  const useShuffle = () => {
    if ((shuffleLeft <= 0 && mode !== 'hard') || busy || !running) return
    
    // In hard mode, check if user has enough coins
    if (mode === 'hard' && user.coins < cfg.shuffleCost) {
      alert(`Not enough coins! Need ${cfg.shuffleCost} coins to shuffle.`)
      return
    }
    
    // Deduct coins in hard mode
    if (mode === 'hard') {
      updateBalance(-cfg.shuffleCost).catch(console.error)
    } else {
      // In other modes, just decrease the shuffle count
      setShuffleLeft(prev => prev - 1)
    }
    
    setBusy(true)
    
    // Get indices of face-down, unmatched cards
    const faceDownCards = deck
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !card.faceUp && !card.matched)
    
    if (faceDownCards.length <= 1) {
      setBusy(false)
      return // Not enough cards to shuffle
    }
    
    // Extract the values and shuffle them
    const values = faceDownCards.map(({ card }) => card.energy)
    const shuffledValues = shuffle([...values])
    
    // Create a new deck with shuffled values
    setDeck(prevDeck => {
      const newDeck = [...prevDeck]
      faceDownCards.forEach(({ index }, i) => {
        newDeck[index] = {
          ...newDeck[index],
          energy: shuffledValues[i]
        }
      })
      return newDeck
    })
    
    setTimeout(() => setBusy(false), 200)
  }

  // Game timer effect
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1
          
          // Check for sudden death mode (Hard mode only)
          if (mode === 'hard' && newTime <= cfg.suddenDeathThreshold) {
            // Speed up flip back time in sudden death
            if (cfg.flipBackMs > 350) {
              cfg.flipBackMs = 350
            }
          }
          
          // Check for game over
          if (newTime <= 0) {
            clearInterval(timerRef.current)
            endGame(false) // Time's up!
            return 0
          }
          
          return newTime
        })
      }, 1000)
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [running, mode])

  // Handle card flip - single implementation
  const onFlip = (index) => {
    // Don't allow flipping during initial reveal or if busy
    if (initialReveal || busy || !running) return
    
    const card = deck[index]
    // Don't allow flipping matched cards or already face-up cards
    if (card.matched || card.faceUp) return
    
    // If we already have two cards waiting to be checked, ignore new flips
    if (first !== null && second !== null) return
    
    // Flip the card
    const newDeck = [...deck]
    newDeck[index] = { ...card, faceUp: true }
    setDeck(newDeck)
    
    // If this is the first card of a pair
    if (first === null) {
      setFirst(index)
    } 
    // If this is the second card of a pair
    else if (second === null) {
      setSecond(index)
      setBusy(true)
      
      // Check for a match
      const firstCard = deck[first]
      const secondCard = newDeck[index]
      
      if (firstCard.energy.id === secondCard.energy.id) {
        // Match found
        const newStreak = streak + 1
        setStreak(newStreak)
        setStreakMax(Math.max(streakMax, newStreak))
        
        // Mark as matched
        setTimeout(() => {
          setDeck(prevDeck => 
            prevDeck.map((card, i) => 
              (i === first || i === index) 
                ? { ...card, matched: true, faceUp: true } 
                : card
            )
          )
          setFirst(null)
          setSecond(null)
          setBusy(false)
          
          // Check for game completion
          const matched = newDeck.filter(c => c.matched).length + 2 // +2 for current match
          if (matched === newDeck.length) {
            endGame(true)
          }
        }, 500)
      } else {
        // No match
        setMismatches(prev => {
          const newMismatches = prev + 1
          // Apply time penalty if configured
          if (cfg.mismatchPenalty > 0) {
            setTimeLeft(prevTime => Math.max(0, prevTime - cfg.mismatchPenalty))
          }
          return newMismatches
        })
        
        // Reset streak on mismatch if not in easy mode
        if (mode !== 'easy') {
          setStreak(0)
        }
        
        // Flip cards back after delay
        setTimeout(() => {
          setDeck(prevDeck => 
            prevDeck.map((card, i) => 
              (i === first || i === index) 
                ? { ...card, faceUp: false } 
                : card
            )
          )
          setFirst(null)
          setSecond(null)
          setBusy(false)
        }, cfg.flipBackMs || 1000)
      }
    }
  }
  
  // Handle game over
  const endGame = (won) => {
    setRunning(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    // Calculate score and rewards
    const gameTime = Math.floor((Date.now() - gameStartTime.current) / 1000)
    const timeBonus = Math.floor(timeLeft * (cfg.timeBonusMultiplier || 1))
    const perfectGame = mismatches === 0
    const coins = won 
      ? (matchedCount * (cfg.baseReward || 5)) + 
        timeBonus + 
        (perfectGame ? (cfg.perfectBonus || 0) : 0)
      : 0
    
    // Update user balance if they won
    if (won && coins > 0) {
      updateBalance(coins).catch(console.error)
    }
    
    // Show summary
    setSummary({
      won,
      coins,
      time: cfg.totalTime - timeLeft,
      timeBonus,
      perfectGame,
      streak: streakMax,
      breakdown: {
        matches: matchedCount,
        baseReward: matchedCount * (cfg.baseReward || 5),
        timeBonus,
        perfectBonus: perfectGame ? (cfg.perfectBonus || 0) : 0
      }
    })
  }

  const reset = (start = true) => {
    const d = buildDeck(mode)
    setDeck(d)
    setFirst(null)
    setSecond(null)
    setBusy(false)
    setMismatches(0)
    setStreak(0)
    setStreakMax(0)
    setPeekLeft(cfg.hints?.peek || 0)
    setShuffleLeft(cfg.hints?.shuffle || 0)
    setTimeLeft(cfg.totalTime)
    setRunning(false)
    setSummary(null)
    setInitialReveal(false)
    setPeekedCards([])

    // Start reveal phase
    if (start) {
      // Initial reveal if configured
      if (cfg.startRevealMs > 0) {
        setInitialReveal(true)
        // Reveal all cards
        setDeck(prevDeck => 
          prevDeck.map(card => ({ ...card, faceUp: true }))
        )
        // Hide cards after reveal time
        setTimeout(() => {
          setInitialReveal(false)
          setDeck(prevDeck => 
            prevDeck.map(card => ({ ...card, faceUp: false }))
          )
          // Start the game timer after initial reveal
          setRunning(true)
        }, cfg.startRevealMs)
      } else {
        setInitialReveal(false)
        setRunning(true)
      }
    }
  }

  useEffect(() => {
    reset(true)
    // cleanup
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Using local TCG energy icons only; no API fetch needed

    // Check for game completion or time up
  useEffect(() => {
    // Sudden death acceleration for hard
    if (mode === 'hard' && timeLeft > 0 && timeLeft < 10) {
      // shorten flipBackMs implicitly via busy delay below
    }
    if (allMatched && running) {
      clearInterval(timerRef.current)
      setRunning(false)
      finish(true)
    } else if (timeLeft === 0 && running) {
      setRunning(false)
      finish(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMatched, timeLeft, running])

  // Shuffle the remaining face-down cards (fixed version)
  const doShuffle = () => {
    if ((shuffleLeft <= 0 && mode !== 'hard') || busy || !running) return
    
    // In hard mode, check if user has enough coins
    if (mode === 'hard' && user.coins < cfg.shuffleCost) {
      alert(`Not enough coins! Need ${cfg.shuffleCost} coins to shuffle.`)
      return
    }
    
    // Deduct coins in hard mode
    if (mode === 'hard') {
      updateBalance(-cfg.shuffleCost).catch(console.error)
    } else {
      // In other modes, just decrease the shuffle count
      setShuffleLeft(prev => prev - 1)
    }
    
    setBusy(true)
    
    // Get indices of face-down, unmatched cards
    const faceDownCards = deck
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !card.faceUp && !card.matched)
    
    if (faceDownCards.length <= 1) {
      setBusy(false)
      return // Not enough cards to shuffle
    }
    
    // Extract the values and shuffle them
    const values = faceDownCards.map(({ card }) => card.energy)
    const shuffledValues = shuffle([...values])
    
    // Create a new deck with shuffled values
    setDeck(prevDeck => {
      const newDeck = [...prevDeck]
      faceDownCards.forEach(({ index }, i) => {
        newDeck[index] = {
          ...newDeck[index],
          energy: shuffledValues[i]
        }
      })
      return newDeck
    })
    
    setTimeout(() => setBusy(false), 200)
  }

  const finish = async (won) => {
    if (!user) return
    try {
      const res = await api.post('/api/games/memory/finish', {
        username: user.username,
        difficulty: mode,
        pairsTotal: cfg.pairs,
        pairsMatched: matchedCount,
        mismatches,
        timeLeft,
        streakMax,
      })
      const data = res.data
      if (data?.user?.poke_coins != null) updateBalance(data.user.poke_coins, false)
      setSummary({
        won: data.won,
        coins: data.coins,
        breakdown: data.breakdown,
      })
    } catch (e) {
      setSummary({ won, coins: 0, breakdown: null, error: e?.response?.data?.error || e.message })
    }
  }

  // Card component with improved sizing and styling
  const Card = ({ card, idx }) => {
    const [imageError, setImageError] = useState(false);
    const show = card.faceUp || card.matched;
    
    const handleImageError = (e) => {
      console.error(`Failed to load image for ${card.energy.name} Energy at ${card.energy.imageUrl}`);
      setImageError(true);
    };

    // Create a proper URL for the image
    const getImageUrl = (path) => {
      try {
        // For Vite, we can use the path directly as it's in the public directory
        return path.startsWith('/') ? path : `/${path}`;
      } catch (error) {
        console.error('Error getting image URL:', error);
        return '';
      }
    };

    return (
      <button
        key={card.key}
        className={`relative aspect-[2/3] rounded-lg border transition select-none ${show ? 'bg-slate-900 border-slate-600' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'} ${card.matched ? 'ring-2 ring-emerald-400' : ''}`}
        onClick={() => onFlip(idx)}
        disabled={!running || busy || card.matched}
        style={{ 
          scrollBehavior: 'auto',
          minHeight: '80px', // Minimum height for consistency
          minWidth: '60px'  // Minimum width for consistency
        }}
      >
        {show ? (
          <div className="w-full h-full p-1 flex items-center justify-center">
            {!imageError && card.energy.imageUrl ? (
              <img
                src={getImageUrl(card.energy.imageUrl)}
                alt={`${card.energy.name} Energy`}
                className="h-full w-auto object-contain max-h-[80%] max-w-[80%]"
                onError={handleImageError}
              />
            ) : (
              <div className={`text-white text-center p-1 rounded ${card.energy.color || 'bg-gray-700'}`}>
                <div className="text-xs font-medium">{card.energy.name}</div>
                <div className="text-[0.6rem] opacity-70">Energy</div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full grid place-items-center text-xl">🃏</div>
        )}
      </button>
    )
  }

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // Wrap the entire game in a container that prevents scrolling
  return (
    <main className="max-w-5xl mx-auto px-4 py-6" style={{ scrollBehavior: 'auto' }}>
      <h2 className="text-2xl font-bold mb-2">🃏 Poké Memory Flip</h2>
      <p className="text-slate-300 mb-4">Match energy pairs before time runs out. Better streaks and time left increase rewards.</p>
      
      {!running && !summary && (
        <div className="mb-6 p-4 bg-slate-800 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Select Difficulty</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => startGame('easy')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
            >
              Easy
            </button>
            <button
              onClick={() => startGame('medium')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white"
            >
              Medium
            </button>
            <button
              onClick={() => startGame('hard')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
            >
              Hard
            </button>
          </div>
        </div>
      )}
      
      {running && (
        <div className="mb-4 p-3 bg-slate-800 rounded-lg flex flex-wrap justify-between items-center">
          <div className="mb-2 sm:mb-0">
            <span className="font-medium">Time: </span>
            <span className={timeLeft <= 10 ? 'text-red-400 font-bold' : ''}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="mb-2 sm:mb-0">
            <span className="font-medium">Matches: </span>
            <span>{matchedCount} / {cfg.pairs}</span>
          </div>
          <div className="mb-2 sm:mb-0">
            <span className="font-medium">Streak: </span>
            <span>{streak} (Max: {streakMax})</span>
          </div>
          <div className="flex gap-2">
            {peekLeft > 0 && (
              <button
                onClick={usePeek}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                disabled={busy}
              >
                Peek ({peekLeft})
              </button>
            )}
            {(shuffleLeft > 0 || mode === 'hard') && (
              <button
                onClick={useShuffle}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                disabled={busy}
                title={mode === 'hard' ? `Costs ${cfg.shuffleCost} coins` : ''}
              >
                Shuffle {mode === 'hard' ? `(${cfg.shuffleCost} coins)` : `(${shuffleLeft})`}
              </button>
            )}
          </div>
        </div>
      )}
      
      {summary && (
        <div className={`mb-6 p-4 rounded-lg ${summary.won ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
          <h3 className="text-xl font-bold mb-2">
            {summary.won ? '🎉 You Won!' : '😢 Game Over'}
          </h3>
          <div className="mb-2">
            <p>Time: {formatTime(summary.time)}</p>
            <p>Matches: {matchedCount} / {cfg.pairs}</p>
            <p>Mismatches: {mismatches}</p>
            <p>Max Streak: {summary.streak}</p>
          </div>
          {summary.won && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="font-semibold">Rewards:</p>
              <ul className="list-disc pl-5">
                <li>Base: {summary.breakdown.matches} × {cfg.baseReward} = {summary.breakdown.baseReward} coins</li>
                <li>Time Bonus: +{summary.timeBonus} coins</li>
                {summary.perfectGame && (
                  <li>Perfect Game: +{cfg.perfectBonus} coins</li>
                )}
                <li className="font-bold mt-1">Total: {summary.coins} coins</li>
              </ul>
            </div>
          )}
          <button
            onClick={() => startGame(mode)}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
          >
            Play Again
          </button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-300">Mode:</label>
        {Object.keys(MODES).map(m => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded ${mode===m ? 'bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'}`}>{m[0].toUpperCase()+m.slice(1)}</button>
        ))}
        <button onClick={() => reset(true)} className="ml-2 px-3 py-1 rounded bg-slate-700 hover:bg-slate-600">Restart</button>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="px-2 py-1 rounded bg-slate-700">⏱️ {timeLeft}s</div>
          <div className="px-2 py-1 rounded bg-slate-700">Streak {streakMax > 1 ? `${streak}/${streakMax}` : streak}</div>
          <div className="px-2 py-1 rounded bg-slate-700">Mismatch {mismatches}</div>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <button disabled={peekLeft<=0 || busy || !running} onClick={usePeek} className={`px-3 py-1 rounded ${peekLeft>0 && running && !busy ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-700'}`}>Peek ({peekLeft})</button>
        <button disabled={shuffleLeft<=0 || busy || !running} onClick={useShuffle} className={`px-3 py-1 rounded ${shuffleLeft>0 && running && !busy ? 'bg-purple-600 hover:bg-purple-500' : 'bg-slate-700'}`}>Shuffle ({shuffleLeft})</button>
      </div>

      <div 
        className="grid" 
        style={gridStyle}
        onClick={(e) => e.preventDefault()} // Prevent default scrolling behavior
      >
        {deck.map((c, i) => (
          <Card key={c.key} card={c} idx={i} />
        ))}
      </div>

      {summary && (
        <div className="mt-6 border border-slate-700 rounded-lg p-4 bg-slate-800">
          {!summary.error ? (
            <>
              <div className="text-lg font-semibold mb-1">{summary.won ? 'You Win!' : 'Time’s up!'}</div>
              <div className="text-slate-300 mb-2">Coins awarded: <span className="text-green-300 font-bold">+{summary.coins}</span></div>
              {summary.breakdown && (
                <div className="text-xs text-slate-400">Base × combo: {summary.breakdown.comboMult?.toFixed?.(2) ?? '1.00'} | Time bonus: {summary.breakdown.timeBonus} | Perfect bonus: {summary.breakdown.bonus}</div>
              )}
              <div className="mt-3 flex gap-2">
                <button onClick={() => reset(true)} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500">Play Again</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-semibold mb-1">Result saved locally</div>
              <div className="text-red-300 text-sm">{summary.error}</div>
              <div className="mt-3"><button onClick={() => reset(true)} className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500">Retry</button></div>
            </>
          )}
        </div>
      )}
    </main>
  )
}

// Wrap the component with ErrorBoundary
export default function Memory() {
  return (
    <ErrorBoundary>
      <MemoryGame />
    </ErrorBoundary>
  )
}

