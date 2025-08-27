import React, { useEffect, useState } from 'react'
import { api } from '../utils/api.js'
import { useUser } from '../state/UserContext.jsx'
import PackOpeningModal from './PackOpeningModal.jsx'

export default function PackStore() {
  const { user, updateBalance, setUser } = useUser()
  const [loadingPackId, setLoadingPackId] = useState(null) // which pack is opening
  const [error, setError] = useState('')
  const [availablePacks, setAvailablePacks] = useState([])
  const [openedPacks, setOpenedPacks] = useState([]) // array of arrays (cards)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const { data } = await api.get('/api/packs')
        if (mounted) setAvailablePacks(data || [])
      } catch (e) {
        // fallback to empty; error shown on card click
        console.warn('Failed to load packs list', e?.message)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const openSpecificPack = async (setId) => {
    setError('')
    if (!user) return
    try {
      if (loadingPackId) return
      setLoadingPackId(setId)
      const { data } = await api.post('/api/packs/open', { username: user.username, setId })
      // data: { user, cards, set }
      setUser(data.user)
      updateBalance(data.user.poke_coins)
      setOpenedPacks([data.cards])
      setOpen(true)
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to open pack'
      setError(msg)
    } finally {
      setLoadingPackId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-4">Packs</h2>
      {error && <p className="text-red-300 mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {availablePacks.map((p) => (
          <div key={p.id} className="bg-slate-800 border border-slate-700 rounded p-4 flex flex-col items-center gap-4">
            <img
              className="w-36 h-52 object-contain rounded"
              alt={`${p.name} Booster Pack`}
              src={p.images?.logo || `https://images.pokemontcg.io/${p.id}/logo.png`}
              onError={(e) => {
                const img = e.currentTarget
                // try symbol once, then fallback to pokeball
                if (!img.dataset.triedSymbol) {
                  img.dataset.triedSymbol = '1'
                  img.src = p.images?.symbol || `https://images.pokemontcg.io/${p.id}/symbol.png`
                } else {
                  img.src = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'
                }
              }}
            />
            <div className="text-center">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-slate-400">{p.series}</div>
            </div>
            <div className="text-sm mb-2">
              <span className="bg-yellow-400 text-slate-900 px-2 py-1 rounded font-semibold">{p.cost || 100} PokéCoins</span>
            </div>
            <button
              onClick={() => openSpecificPack(p.id)}
              disabled={!!loadingPackId}
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded"
            >
              {loadingPackId === p.id ? 'Opening…' : 'Open Pack'}
            </button>
          </div>
        ))}
      </div>

      <PackOpeningModal open={open} onClose={() => setOpen(false)} packs={openedPacks} />
    </div>
  )
}
