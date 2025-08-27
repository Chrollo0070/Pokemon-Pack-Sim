import React from 'react'
import { Link } from 'react-router-dom'

export default function Games() {
  const tiles = [
    {
      title: 'Spin the Wheel',
      path: '/games/spin',
      emoji: '🎡',
      blurb: 'Casino-style wheel. Win coins, a random pack, or a booster token. Small chance to lose 50 coins.'
    },
    {
      title: 'Guess the Silhouette',
      path: '/games/silhouette',
      emoji: '🕵️‍♂️',
      blurb: 'Guess the Pokémon by its silhouette. Correct guesses earn coins or a bonus card.'
    },
    {
      title: 'Poké Memory Flip',
      path: '/games/memory',
      emoji: '🃏',
      blurb: 'Flip two cards to match Pokémon or energy type. Faster matches = bigger rewards.'
    },
    {
      title: 'Typing Challenge',
      path: '/games/typing',
      emoji: '⌨️',
      blurb: 'Unscramble the Pokémon name within 10 seconds. Accuracy and speed pay more.'
    }
  ]

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-4">Games</h2>
      <p className="text-slate-300 mb-6">Mini games to earn coins</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tiles.map(t => (
          <Link key={t.path} to={t.path} className="block border border-slate-700 rounded-lg p-4 bg-slate-800 hover:bg-slate-700 transition">
            <div className="text-2xl mb-2">{t.emoji} {t.title}</div>
            <div className="text-slate-300 text-sm">{t.blurb}</div>
          </Link>
        ))}
      </div>
    </main>
  )
}
