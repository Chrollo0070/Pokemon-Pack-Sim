import React, { useState, useEffect, useRef } from 'react'
import { api } from '../../utils/api.js'
import { useUser } from '../../state/UserContext.jsx'

export default function Typing() {
  const { user, updateBalance } = useUser()
  const [gameState, setGameState] = useState('idle') // idle, playing, finished
  const [scrambledWord, setScrambledWord] = useState('')
  const [currentWord, setCurrentWord] = useState('')
  const [userInput, setUserInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [totalWords, setTotalWords] = useState(0)
  const [correctWords, setCorrectWords] = useState(0)
  const [skippedWords, setSkippedWords] = useState(0)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { coins, message }
  const [lastAnswer, setLastAnswer] = useState(null) // { correct, word, answer }
  const [hint, setHint] = useState('') // Hint for current Pokémon
  const timerRef = useRef(null)
  const inputRef = useRef(null)
  const processedWords = useRef(new Set()) // Track processed words to prevent duplicates

  // Pokémon names and hints for the game
  const pokemonData = {
    'bulbasaur': 'Seed Pokémon, Grass/Poison type',
    'ivysaur': 'Seed Pokémon, Grass/Poison type',
    'venusaur': 'Seed Pokémon, Grass/Poison type',
    'charmander': 'Lizard Pokémon, Fire type',
    'charmeleon': 'Flame Pokémon, Fire type',
    'charizard': 'Flame Pokémon, Fire/Flying type',
    'squirtle': 'Tiny Turtle Pokémon, Water type',
    'wartortle': 'Turtle Pokémon, Water type',
    'blastoise': 'Shellfish Pokémon, Water type',
    'caterpie': 'Worm Pokémon, Bug type',
    'metapod': 'Cocoon Pokémon, Bug type',
    'butterfree': 'Butterfly Pokémon, Bug/Flying type',
    'weedle': 'Hairy Bug Pokémon, Bug/Poison type',
    'kakuna': 'Cocoon Pokémon, Bug/Poison type',
    'beedrill': 'Poison Bee Pokémon, Bug/Poison type',
    'pidgey': 'Tiny Bird Pokémon, Normal/Flying type',
    'pidgeotto': 'Bird Pokémon, Normal/Flying type',
    'pidgeot': 'Bird Pokémon, Normal/Flying type',
    'rattata': 'Mouse Pokémon, Normal type',
    'raticate': 'Mouse Pokémon, Normal type',
    'spearow': 'Tiny Bird Pokémon, Normal/Flying type',
    'fearow': 'Beak Pokémon, Normal/Flying type',
    'ekans': 'Snake Pokémon, Poison type',
    'arbok': 'Cobra Pokémon, Poison type',
    'pikachu': 'Mouse Pokémon, Electric type',
    'raichu': 'Mouse Pokémon, Electric type',
    'sandshrew': 'Mouse Pokémon, Ground type',
    'sandslash': 'Mouse Pokémon, Ground type',
    'nidoran': 'Poison Pin Pokémon, Poison type',
    'nidorina': 'Poison Pin Pokémon, Poison type',
    'nidoqueen': 'Drill Pokémon, Poison/Ground type',
    'nidorino': 'Poison Pin Pokémon, Poison type',
    'nidoking': 'Drill Pokémon, Poison/Ground type',
    'clefairy': 'Fairy Pokémon, Fairy type',
    'clefable': 'Fairy Pokémon, Fairy type',
    'vulpix': 'Fox Pokémon, Fire type',
    'ninetales': 'Fox Pokémon, Fire type',
    'jigglypuff': 'Balloon Pokémon, Normal/Fairy type',
    'wigglytuff': 'Balloon Pokémon, Normal/Fairy type',
    'zubat': 'Bat Pokémon, Poison/Flying type',
    'golbat': 'Bat Pokémon, Poison/Flying type',
    'oddish': 'Weed Pokémon, Grass/Poison type',
    'gloom': 'Weed Pokémon, Grass/Poison type',
    'vileplume': 'Flower Pokémon, Grass/Poison type',
    'paras': 'Mushroom Pokémon, Bug/Grass type',
    'parasect': 'Mushroom Pokémon, Bug/Grass type',
    'venonat': 'Insect Pokémon, Bug/Poison type',
    'venomoth': 'Poison Moth Pokémon, Bug/Poison type',
    'diglett': 'Mole Pokémon, Ground type',
    'dugtrio': 'Mole Pokémon, Ground type',
    'meowth': 'Scratch Cat Pokémon, Normal type',
    'persian': 'Classy Cat Pokémon, Normal type',
    'psyduck': 'Duck Pokémon, Water type',
    'golduck': 'Duck Pokémon, Water type',
    'mankey': 'Pig Monkey Pokémon, Fighting type',
    'primeape': 'Pig Monkey Pokémon, Fighting type',
    'growlithe': 'Puppy Pokémon, Fire type',
    'arcanine': 'Legendary Pokémon, Fire type',
    'poliwag': 'Tadpole Pokémon, Water type',
    'poliwhirl': 'Tadpole Pokémon, Water type',
    'poliwrath': 'Tadpole Pokémon, Water/Fighting type',
    'abra': 'Psi Pokémon, Psychic type',
    'kadabra': 'Psi Pokémon, Psychic type',
    'alakazam': 'Psi Pokémon, Psychic type',
    'machop': 'Superpower Pokémon, Fighting type',
    'machoke': 'Superpower Pokémon, Fighting type',
    'machamp': 'Superpower Pokémon, Fighting type',
    'bellsprout': 'Flower Pokémon, Grass/Poison type',
    'weepinbell': 'Flycatcher Pokémon, Grass/Poison type',
    'victreebel': 'Flycatcher Pokémon, Grass/Poison type',
    'tentacool': 'Jellyfish Pokémon, Water/Poison type',
    'tentacruel': 'Jellyfish Pokémon, Water/Poison type',
    'geodude': 'Rock Pokémon, Rock/Ground type',
    'graveler': 'Rock Pokémon, Rock/Ground type',
    'golem': 'Megaton Pokémon, Rock/Ground type',
    'ponyta': 'Fire Horse Pokémon, Fire type',
    'rapidash': 'Fire Horse Pokémon, Fire type',
    'slowpoke': 'Dopey Pokémon, Water/Psychic type',
    'slowbro': 'Hermit Crab Pokémon, Water/Psychic type',
    'magnemite': 'Magnet Pokémon, Electric/Steel type',
    'magneton': 'Magnet Pokémon, Electric/Steel type',
    'farfetchd': 'Wild Duck Pokémon, Normal/Flying type',
    'doduo': 'Twin Bird Pokémon, Normal/Flying type',
    'dodrio': 'Triple Bird Pokémon, Normal/Flying type',
    'seel': 'Sea Lion Pokémon, Water type',
    'dewgong': 'Sea Lion Pokémon, Water/Ice type',
    'grimer': 'Sludge Pokémon, Poison type',
    'muk': 'Sludge Pokémon, Poison type',
    'shellder': 'Bivalve Pokémon, Water type',
    'cloyster': 'Bivalve Pokémon, Water/Ice type',
    'gastly': 'Gas Pokémon, Ghost/Poison type',
    'haunter': 'Gas Pokémon, Ghost/Poison type',
    'gengar': 'Shadow Pokémon, Ghost/Poison type',
    'onix': 'Rock Snake Pokémon, Rock/Ground type',
    'drowzee': 'Hypnosis Pokémon, Psychic type',
    'hypno': 'Hypnosis Pokémon, Psychic type',
    'krabby': 'River Crab Pokémon, Water type',
    'kingler': 'Pincer Pokémon, Water type',
    'voltorb': 'Ball Pokémon, Electric type',
    'electrode': 'Ball Pokémon, Electric type',
    'exeggcute': 'Egg Pokémon, Grass/Psychic type',
    'exeggutor': 'Coconut Pokémon, Grass/Psychic type',
    'cubone': 'Lonely Pokémon, Ground type',
    'marowak': 'Bone Keeper Pokémon, Ground type',
    'hitmonlee': 'Kicking Pokémon, Fighting type',
    'hitmonchan': 'Punching Pokémon, Fighting type',
    'lickitung': 'Licking Pokémon, Normal type',
    'koffing': 'Poison Gas Pokémon, Poison type',
    'weezing': 'Poison Gas Pokémon, Poison type',
    'rhyhorn': 'Spikes Pokémon, Ground/Rock type',
    'rhydon': 'Drill Pokémon, Ground/Rock type',
    'chansey': 'Egg Pokémon, Normal type',
    'tangela': 'Vine Pokémon, Grass type',
    'kangaskhan': 'Parent Pokémon, Normal type',
    'horsea': 'Dragon Pokémon, Water type',
    'seadra': 'Dragon Pokémon, Water type',
    'goldeen': 'Goldfish Pokémon, Water type',
    'seaking': 'Goldfish Pokémon, Water type',
    'staryu': 'Star Shape Pokémon, Water type',
    'starmie': 'Mysterious Pokémon, Water/Psychic type',
    'mr mime': 'Barrier Pokémon, Psychic/Fairy type',
    'scyther': 'Mantis Pokémon, Bug/Flying type',
    'jynx': 'Human Shape Pokémon, Ice/Psychic type',
    'electabuzz': 'Electric Pokémon, Electric type',
    'magmar': 'Spitfire Pokémon, Fire type',
    'pinsir': 'Stag Beetle Pokémon, Bug type',
    'tauros': 'Wild Bull Pokémon, Normal type',
    'magikarp': 'Fish Pokémon, Water type',
    'gyarados': 'Fierce Pokémon, Water/Flying type',
    'lapras': 'Transport Pokémon, Water/Ice type',
    'ditto': 'Transform Pokémon, Normal type',
    'eevee': 'Evolution Pokémon, Normal type',
    'vaporeon': 'Bubble Jet Pokémon, Water type',
    'jolteon': 'Lightning Pokémon, Electric type',
    'flareon': 'Flame Pokémon, Fire type',
    'porygon': 'Virtual Pokémon, Normal type',
    'omanyte': 'Spiral Pokémon, Rock/Water type',
    'omastar': 'Spiral Pokémon, Rock/Water type',
    'kabuto': 'Shellfish Pokémon, Rock/Water type',
    'kabutops': 'Shellfish Pokémon, Rock/Water type',
    'aerodactyl': 'Fossil Pokémon, Rock/Flying type',
    'snorlax': 'Sleeping Pokémon, Normal type',
    'articuno': 'Freeze Pokémon, Ice/Flying type',
    'zapdos': 'Electric Pokémon, Electric/Flying type',
    'moltres': 'Flame Pokémon, Fire/Flying type',
    'dratini': 'Dragon Pokémon, Dragon type',
    'dragonair': 'Dragon Pokémon, Dragon type',
    'dragonite': 'Dragon Pokémon, Dragon/Flying type',
    'mewtwo': 'Genetic Pokémon, Psychic type',
    'mew': 'New Species Pokémon, Psychic type'
  }

  // Get a random Pokémon name and hint
  const getRandomPokemon = () => {
    const pokemonNames = Object.keys(pokemonData)
    const randomIndex = Math.floor(Math.random() * pokemonNames.length)
    const pokemonName = pokemonNames[randomIndex]
    return {
      name: pokemonName,
      hint: pokemonData[pokemonName]
    }
  }

  // Scramble a word
  const scrambleWord = (word) => {
    if (!word) return ''
    const letters = word.split('')
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[letters[i], letters[j]] = [letters[j], letters[i]]
    }
    return letters.join('')
  }

  // Start a new word
  const startNewWord = () => {
    const pokemon = getRandomPokemon()
    const scrambled = scrambleWord(pokemon.name)
    setCurrentWord(pokemon.name)
    setScrambledWord(scrambled)
    setHint(pokemon.hint)
    setUserInput('')
    // Increment total words counter
    setTotalWords(prev => prev + 1)
    // Clear the processed words set when starting a new word
    processedWords.current.clear()
    
    // Focus the input field
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // Start the game
  const startGame = () => {
    if (!user) return
    setError('')
    setResult(null)
    setLastAnswer(null)
    setHint('')
    setScore(0)
    setStreak(0)
    setMaxStreak(0)
    setTotalWords(0)
    setCorrectWords(0)
    setSkippedWords(0)
    setTimeLeft(60)
    setGameState('playing')
    processedWords.current.clear()
    startNewWord()
    
    // Start the timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          endGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Skip the current word
  const skipWord = () => {
    if (gameState !== 'playing') return
    
    // Mark this word as processed to prevent scoring
    processedWords.current.add(currentWord)
    
    // Reset streak when skipping
    setStreak(0)
    
    // Increment skipped words counter
    setSkippedWords(prev => prev + 1)
    
    // Show feedback about the skipped word
    setLastAnswer({
      correct: null, // null indicates skipped
      word: currentWord,
      hint: hint,
      message: 'Skipped'
    })
    
    // Move to next word after a brief delay
    setTimeout(() => {
      setLastAnswer(null)
      startNewWord()
    }, 1000)
  }

  // End the game
  const endGame = async () => {
    setGameState('finished')
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    
    // Simple reward calculation based only on correct answers and streak
    const finalCorrectWords = correctWords
    const finalMaxStreak = maxStreak
    
    let totalCoins = 0
    let rewardMessage = ''
    
    // Only use correct answers and streak for rewards
    if (finalCorrectWords > 0) {
      const correctReward = finalCorrectWords * 20 // 20 coins per correct answer
      const streakReward = finalMaxStreak * 10 // 10 coins per streak point
      totalCoins = correctReward + streakReward
      
      rewardMessage = `+${correctReward} (correct) +${streakReward} (streak) = ${totalCoins} coins`
    } else {
      totalCoins = 0
      rewardMessage = 'No correct answers. Try to unscramble at least one Pokémon name!'
    }
    
    // Call server endpoint to update database and get new balance
    try {
      if (totalCoins > 0) {
        const res = await api.post('/api/games/typing/finish', {
          username: user.username,
          correctWords: finalCorrectWords,
          maxStreak: finalMaxStreak
        })
        const data = res.data
        if (data?.user?.poke_coins != null) updateBalance(data.user.poke_coins)
      }
      setResult({
        coins: totalCoins,
        message: rewardMessage
      })
    } catch (e) {
      setError('Failed to update balance')
      // Still show the result even if balance update fails
      setResult({
        coins: totalCoins,
        message: rewardMessage
      })
    }
  }

  // Handle word submission - auto-check as user types
  useEffect(() => {
    if (gameState !== 'playing' || !userInput.trim() || processedWords.current.has(currentWord)) return
    
    const isCorrect = userInput.trim().toLowerCase() === currentWord.toLowerCase()
    
    if (isCorrect) {
      // Mark this word as processed to prevent duplicate scoring
      processedWords.current.add(currentWord)
      
      // Correct guess
      const newStreak = streak + 1
      setStreak(newStreak)
      setMaxStreak(prev => Math.max(prev, newStreak))
      setCorrectWords(prev => prev + 1)
      
      // Add score - reasonable points per word
      const wordScore = 10 + (timeLeft > 10 ? 5 : 0) + (newStreak > 3 ? 5 : 0) // Base 10, bonus for time and streak
      setScore(prev => prev + wordScore)
      
      // Show feedback
      setLastAnswer({
        correct: true,
        word: currentWord,
        hint: hint,
        answer: userInput.trim(),
        points: wordScore
      })
      
      // Move to next word after a brief delay
      setTimeout(() => {
        setLastAnswer(null)
        startNewWord()
      }, 1000)
    } else if (userInput.length >= currentWord.length) {
      // If user has typed enough characters and it's wrong, show the correct answer
      processedWords.current.add(currentWord) // Prevent further processing of this word
      
      setStreak(0) // Reset streak
      
      setLastAnswer({
        correct: false,
        word: currentWord,
        hint: hint,
        answer: userInput.trim()
      })
      
      // Move to next word after showing the correct answer
      setTimeout(() => {
        setLastAnswer(null)
        startNewWord()
      }, 1500)
    }
  }, [userInput])

  // Handle input change
  const handleInputChange = (e) => {
    setUserInput(e.target.value)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-2">⌨️ Typing Challenge</h2>
      <p className="text-slate-300 mb-4">
        Unscramble the Pokémon name within 60 seconds. Type the correct name to score points!
      </p>

      <div className="border border-slate-700 rounded-lg p-6 bg-slate-800 text-slate-200">
        {gameState === 'idle' && (
          <div className="text-center">
            <p className="mb-4">Unscramble Pokémon names as fast as you can!</p>
            <p className="text-sm text-slate-400 mb-6">
              You have 60 seconds to unscramble as many names as possible.<br />
              Earn coins based on speed, accuracy, and streaks.<br />
              Type the correct name - no need to press Enter!<br />
              Use the Skip button if you don't know a Pokémon name.<br />
              Hints show the Pokémon type to help you guess!
            </p>
            <button
              onClick={startGame}
              disabled={!user}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-lg"
            >
              Start Challenge
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="text-center">
            <div className="flex justify-between items-center mb-6">
              <div className="text-left">
                <div className="text-sm text-slate-400">Time</div>
                <div className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-green-400'}`}>
                  {timeLeft}s
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-slate-400">Score</div>
                <div className="text-2xl font-bold text-amber-400">{score}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Streak</div>
                <div className="text-2xl font-bold text-purple-400">
                  {streak} <span className="text-sm text-slate-400">(max: {maxStreak})</span>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <div className="text-sm text-slate-400 mb-2">Unscramble this Pokémon name:</div>
              <div className="text-4xl font-bold text-blue-300 mb-4 tracking-wider">
                {scrambledWord}
              </div>
              
              {hint && (
                <div className="text-sm text-slate-300 mb-4 italic">
                  Hint: {hint}
                </div>
              )}
              
              {lastAnswer && (
                <div className={`mb-4 p-3 rounded-lg ${
                  lastAnswer.correct === true ? 'bg-green-900/50' : 
                  lastAnswer.correct === false ? 'bg-red-900/50' : 
                  'bg-yellow-900/50'
                }`}>
                  {lastAnswer.correct === true ? (
                    <div className="text-green-300 font-semibold">
                      Correct! +{lastAnswer.points} points
                      <div className="text-sm">It was: {lastAnswer.word}</div>
                    </div>
                  ) : lastAnswer.correct === false ? (
                    <div className="text-red-300">
                      <div>Incorrect!</div>
                      <div className="text-sm">You typed: {lastAnswer.answer}</div>
                      <div className="text-sm">The Pokémon was: <span className="font-semibold">{lastAnswer.word}</span></div>
                      <div className="text-xs mt-1">Hint: {lastAnswer.hint}</div>
                    </div>
                  ) : (
                    <div className="text-yellow-300">
                      <div>Skipped!</div>
                      <div className="text-sm">The Pokémon was: <span className="font-semibold">{lastAnswer.word}</span></div>
                      <div className="text-xs mt-1">Hint: {lastAnswer.hint}</div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="max-w-md mx-auto">
                <input
                  ref={inputRef}
                  type="text"
                  value={userInput}
                  onChange={handleInputChange}
                  placeholder="Type the Pokémon name"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 outline-none focus:border-slate-500 text-center text-lg"
                  disabled={gameState !== 'playing'}
                  autoFocus
                />
                <div className="mt-3 flex justify-center gap-3">
                  <button
                    onClick={skipWord}
                    disabled={gameState !== 'playing'}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg font-semibold text-sm"
                  >
                    Skip Pokémon
                  </button>
                </div>
              </div>
            </div>

            <div className="text-sm text-slate-400">
              Correct: {correctWords} | Skipped: {skippedWords} | Total: {totalWords}
            </div>
          </div>
        )}

        {gameState === 'finished' && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-4">Game Over!</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-sm text-slate-400">Score</div>
                <div className="text-xl font-bold text-amber-400">{score}</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-sm text-slate-400">Correct</div>
                <div className="text-xl font-bold text-green-400">{correctWords}/{totalWords}</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-sm text-slate-400">Max Streak</div>
                <div className="text-xl font-bold text-purple-400">{maxStreak}</div>
              </div>
              <div className="bg-slate-900 rounded-lg p-3">
                <div className="text-sm text-slate-400">Skipped</div>
                <div className="text-xl font-bold text-yellow-400">{skippedWords}</div>
              </div>
            </div>

            {result && (
              <div className="mb-6 p-4 bg-slate-900 rounded-lg">
                <div className="font-semibold mb-2">Rewards:</div>
                <div className="text-green-300 font-bold text-xl">+{result.coins} coins</div>
                <div className="text-xs text-slate-400 mt-2">{result.message}</div>
              </div>
            )}

            <button
              onClick={startGame}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-lg"
            >
              Play Again
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 text-red-300 text-center">{error}</div>
        )}
      </div>
    </main>
  )
}