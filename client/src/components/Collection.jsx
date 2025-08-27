import React, { useEffect, useMemo, useState } from 'react'
import { useUser } from '../state/UserContext.jsx'
import { api } from '../utils/api.js'

export default function Collection() {
  const { user } = useUser()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('rarity') // 'rarity' | 'newest'

  useEffect(() => {
    let mounted = true
    async function fetchCollection() {
      try {
        setLoading(true)
        const { data } = await api.get(`/api/collections/${user.username}`)
        if (mounted) setCards(data)
      } catch (e) {
        setError('Failed to load collection')
      } finally {
        setLoading(false)
      }
    }
    if (user?.username) fetchCollection()
    return () => { mounted = false }
  }, [user?.username])

  const rarities = useMemo(() => {
    const setR = new Set(['All'])
    cards.forEach(c => setR.add(c.card_rarity || 'Unknown'))
    return Array.from(setR)
  }, [cards])

  const rarityWeight = (r) => {
    const s = (r || 'Unknown').toLowerCase()
    if (s.includes('secret')) return 100
    if (s.includes('ultra')) return 90
    if (s.includes('holo')) return 80
    if (s.startsWith('rare')) return 70
    if (s === 'uncommon') return 40
    if (s === 'common') return 10
    return 0
  }

  const filtered = useMemo(() => {
    const list = filter === 'All' ? cards.slice() : cards.filter(c => (c.card_rarity || 'Unknown') === filter)
    if (sort === 'rarity') {
      list.sort((a, b) => {
        const ra = rarityWeight(a.card_rarity)
        const rb = rarityWeight(b.card_rarity)
        if (rb !== ra) return rb - ra // desc by rarity weight
        return b.id - a.id // tie-breaker: newer first
      })
    } else if (sort === 'newest') {
      list.sort((a, b) => b.id - a.id)
    }
    return list
  }, [cards, filter, sort])

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-6">Loading...</div>
  if (error) return <div className="max-w-5xl mx-auto px-4 py-6 text-red-300">{error}</div>

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">Your Collection</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
          >
            {rarities.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <label className="text-sm text-slate-300 ml-3">Sort:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1"
          >
            <option value="rarity">Rarity (best first)</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-slate-300">No cards yet. Try opening a pack!</p>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {filtered.map((c) => (
            <div key={c.id} className="ring-2 ring-slate-600 rounded overflow-hidden">
              {(() => {
                // Build a reliable src: if stored URL is a Poké Ball placeholder, try to construct the CDN URL from card_id
                const isPlaceholder = typeof c.card_image_url === 'string' && c.card_image_url.includes('githubusercontent.com/PokeAPI/sprites')
                let computedSrc = c.card_image_url
                if (isPlaceholder && typeof c.card_id === 'string') {
                  // Robust parse: setId is leading letters+digits (with optional .digits), num is trailing token
                  let setId = null, num = null
                  const lead = c.card_id.match(/^([a-z]+\d+(?:\.\d+)?)/i)
                  if (lead) setId = lead[1]
                  const tail = c.card_id.match(/([a-z0-9]+)$/i)
                  if (tail) num = tail[1]
                  if (setId && num && setId.length > 1) {
                    // Use a known working card image as placeholder instead of guessing URLs
                    computedSrc = 'https://images.pokemontcg.io/sv1/1_small.jpg'
                  }
                }
                return (
                  <img
                    src={computedSrc}
                alt={c.card_id}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget
                  // First, if we know the card_id like "swsh1-1", construct CDN URL directly
                  if (!img.dataset.tryCdn && typeof c.card_id === 'string') {
                    let setId = null, num = null
                    const lead = c.card_id.match(/^([a-z]+\d+(?:\.\d+)?)/i)
                    if (lead) setId = lead[1]
                    const tail = c.card_id.match(/([a-z0-9]+)$/i)
                    if (tail) num = tail[1]
                    if (setId && num && setId.length > 1) {
                      img.dataset.tryCdn = '1'
                      // Use reliable placeholder instead of guessing URLs
                      img.src = 'https://images.pokemontcg.io/sv1/1_small.jpg'
                      return
                    }
                  }
                  if (!img.dataset.fallbackTried && c.card_image_url) {
                    img.dataset.fallbackTried = '1'
                    // try swapping to small variant if URL looks like a known pattern
                    try {
                      const u = new URL(c.card_image_url)
                      if (/_large\./.test(u.pathname)) {
                        img.src = u.origin + u.pathname.replace('_large.', '_small.')
                        return
                      }
                    } catch {}
                  }
                  img.src = 'https://images.pokemontcg.io/sv1/1_small.jpg' // final guaranteed small placeholder
                }}
                  />
                )
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
