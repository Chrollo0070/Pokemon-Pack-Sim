import React, { useState } from 'react'
import { api } from '../../utils/api.js'
import { useUser } from '../../state/UserContext.jsx'

export default function Silhouette() {
  const { user, updateBalance } = useUser()
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState('')
  const [image, setImage] = useState('')
  const [setInfo, setSetInfo] = useState(null)
  const [guess, setGuess] = useState('')
  const [result, setResult] = useState(null) // { correct, answer? }
  const [error, setError] = useState('')

  const start = async () => {
    if (!user || loading) return
    setError('')
    setResult(null)
    setGuess('')
    setLoading(true)
    try {
      const res = await api.post('/api/games/silhouette/start')
      setToken(res.data.token)
      // Route through server proxy (absolute) to avoid CORS/referrer blocks
      const proxied = `${api.defaults.baseURL}/api/proxy-image?url=${encodeURIComponent(res.data.image)}&t=${Date.now()}`
      setImage(proxied)
      setSetInfo(res.data.set)
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Failed to start challenge')
    } finally {
      setLoading(false)
    }
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (!user || !token || !guess) return
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/games/silhouette/guess', { username: user.username, token, guess })
      const data = res.data
      setResult({ correct: data.correct, answer: data.answer, name: data.pokemonName })
      if (data?.user?.poke_coins != null) updateBalance(data.user.poke_coins, false)
      // Clear token so it can't be reused
      setToken('')
    } catch (e2) {
      setError(e2?.response?.data?.error || e2.message || 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-2">🕵️‍♂️ Guess the Silhouette</h2>
      <p className="text-slate-300 mb-4">Guess the Pokémon by its silhouette. Correct guess awards <span className="text-green-300 font-semibold">+200 coins</span>.</p>

      <div className="border border-slate-700 rounded-lg p-6 bg-slate-800 text-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={start} disabled={loading || !user} className={`px-4 py-2 rounded font-semibold ${loading ? 'bg-slate-600' : 'bg-blue-500 hover:bg-blue-400'}`}>
            {loading ? 'Loading…' : (token ? 'New Challenge' : 'Start Challenge')}
          </button>
          {setInfo && (
            <div className="text-xs text-slate-400">Set: {setInfo.name}</div>
          )}
        </div>

        {!image && (
          <div className="text-slate-300 text-sm">Press Start to get a silhouette.</div>
        )}

        {image && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/2">
              <div className="aspect-[3/4] w-full rounded overflow-hidden border border-slate-700 bg-white flex items-center justify-center">
                <img
                  src={image}
                  alt="Silhouette"
                  className="w-full h-full object-contain"
                  style={ result ? undefined : { filter: 'grayscale(100%) brightness(0) contrast(220%)' } }
                  onError={() => setError('Failed to load image. Try New Challenge.')}
                />
              </div>
              {!result && (
                <div className="mt-2 text-xs text-slate-400">Tip: Look at the outline and pose!</div>
              )}
              {result && (
                <div className="mt-2 text-sm">
                  <span className="text-slate-200">It's </span>
                  <span className="font-semibold text-amber-300">{result.name || (result.answer ?? '')}</span>
                  <span className="text-slate-200">!</span>
                </div>
              )}
            </div>

            <form onSubmit={submit} className="w-full md:w-1/2">
              <label className="block text-sm mb-2">Your guess (Pokémon name)</label>
              <input
                className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 outline-none focus:border-slate-500"
                type="text"
                placeholder="e.g. Pikachu"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                disabled={!token || loading}
              />
              <div className="mt-3 flex items-center gap-2">
                <button disabled={!token || loading || !guess.trim()} className={`px-4 py-2 rounded font-semibold ${(!token || loading || !guess.trim()) ? 'bg-slate-600' : 'bg-green-600 hover:bg-green-500'}`}>
                  Submit Guess
                </button>
                {result && (
                  <span className={`text-sm ${result.correct ? 'text-green-400' : 'text-red-300'}`}>
                    {result.correct ? 'Correct! +200 coins' : `Wrong. Answer: ${result.answer}`}
                  </span>
                )}
              </div>
              {error && <div className="mt-3 text-red-300 text-sm">{error}</div>}
            </form>
          </div>
        )}
      </div>
    </main>
  )
}
