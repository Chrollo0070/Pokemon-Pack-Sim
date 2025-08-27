import React, { useState } from 'react'
import { api } from '../../utils/api.js'
import { useUser } from '../../state/UserContext.jsx'
import PackOpeningModal from '../PackOpeningModal.jsx'

export default function SpinWheel() {
  const { user, updateBalance } = useUser()
  const [spinning, setSpinning] = useState(false)
  const [outcome, setOutcome] = useState(null) // { type, delta?, label }
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [packs, setPacks] = useState([]) // array of arrays

  const spin = async () => {
    if (!user || spinning) return
    setError('')
    setOutcome(null)
    setSpinning(true)
    try {
      const res = await api.post('/api/games/spin', { username: user.username })
      const data = res.data
      setOutcome(data.outcome)
      if (data?.user?.poke_coins != null) updateBalance(data.user.poke_coins, false)
      if (data?.pack?.cards?.length) {
        setPacks([data.pack.cards])
        setModalOpen(true)
      }
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Spin failed')
    } finally {
      setSpinning(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-4">🎡 Spin the Wheel</h2>
      <p className="text-slate-300 mb-6">Casino-style wheel. Rewards may include coins, a random pack, or a booster token. Small chance to lose 50 coins.</p>

      <div className="border border-slate-700 rounded-lg p-6 bg-slate-800 text-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={spin}
            disabled={spinning || !user}
            className={`px-4 py-2 rounded font-semibold ${spinning ? 'bg-slate-600' : 'bg-blue-500 hover:bg-blue-400'}`}
          >
            {spinning ? 'Spinning…' : 'Spin'}
          </button>
          {outcome && (
            <div className="text-sm">
              <span className="font-medium">Outcome:</span> {outcome.label}
              {outcome.type === 'coins' && (
                <span className={`ml-2 ${outcome.delta >= 0 ? 'text-green-400' : 'text-red-300'}`}>
                  ({outcome.delta >= 0 ? '+' : ''}{outcome.delta} coins)
                </span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 text-red-300 text-sm">{error}</div>
        )}

        {/* Simple visual wheel placeholder */}
        <div className="mt-6 grid grid-cols-5 gap-2 text-center text-xs text-slate-300">
          {['Lose 50', '+50', '+100', '+250', 'Free Pack'].map((t, i) => (
            <div key={i} className={`border border-slate-700 rounded p-3 ${spinning ? 'animate-pulse' : ''}`}>{t}</div>
          ))}
        </div>
      </div>

      <PackOpeningModal open={modalOpen} onClose={() => setModalOpen(false)} packs={packs} />
    </main>
  )
}
