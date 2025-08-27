import React, { useEffect, useState } from 'react'

// packs: Array<Array<Card>>; when opening 1 pack, pass [cards]
export default function PackOpeningModal({ open, onClose, packs }) {
  const [flipped, setFlipped] = useState(() => new Set())

  // Reset flipped when opening or packs change
  useEffect(() => {
    if (open) setFlipped(new Set())
  }, [open, packs])

  const onFlip = (key) => {
    setFlipped((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  const revealAll = () => {
    const s = new Set()
    packs.forEach((cards, p) => cards.forEach((_, i) => s.add(`${p}-${i}`)))
    setFlipped(s)
  }

  const rarityColor = (rarity) => {
    if (typeof rarity === 'string' && rarity.toLowerCase().includes('secret')) return 'ring-purple-400'
    if (typeof rarity === 'string' && rarity.toLowerCase().includes('ultra')) return 'ring-orange-400'
    if (rarity?.startsWith('Rare')) return 'ring-yellow-400'
    if (rarity === 'Uncommon') return 'ring-green-400'
    if (rarity === 'Common') return 'ring-slate-400'
    return 'ring-blue-400'
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-6xl w-full p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Your Pulls</h3>
          <div className="flex gap-2">
            <button onClick={revealAll} className="px-3 py-1 rounded bg-blue-500 hover:bg-blue-400">Reveal All</button>
            <button onClick={onClose} className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600">Close</button>
          </div>
        </div>
        <div className="space-y-6 max-h-[80vh] overflow-auto pr-1">
          {packs.map((cards, packIdx) => (
            <div key={`pack-${packIdx}`}>
              {packs.length > 1 && (
                <h4 className="text-sm text-slate-300 mb-2">Pack {packIdx + 1}</h4>
              )}
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                {cards.map((card, idx) => {
                  const key = `${packIdx}-${idx}`
                  const isFlipped = flipped.has(key)
                  return (
                    <div key={card.id + key} className={`card aspect-[3/4] ring-2 ${rarityColor(card.rarity)} ${isFlipped ? 'flipped' : ''}`} onClick={() => onFlip(key)}>
                      <div className="card-inner">
                        <div className="card-face card-back">
                          <span>Click to reveal</span>
                        </div>
                        <div className="card-face card-front">
                          <img
                            src={card.images?.large || card.images?.small || card.imageUrl}
                            alt={card.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget
                              // Try constructing CDN URL from card.id like "swsh1-1" using simple split
                              const tryCdnFromCardId = () => {
                                if (img.dataset.tryCdnId || typeof card.id !== 'string') return false
                                const parts = card.id.split('-')
                                if (parts.length >= 2) {
                                  const setId = parts[0]
                                  const num = parts[parts.length - 1]
                                  if (setId && num) {
                                    img.dataset.tryCdnId = '1'
                                    // Use reliable placeholder for fallback cards
                                    img.src = 'https://images.pokemontcg.io/sv1/1_small.jpg'
                                    return true
                                  }
                                }
                                return false
                              }

                              // Try constructing CDN URL from set.id + number
                              const tryCdnFromSetNum = () => {
                                if (img.dataset.tryCdnSet) return false
                                const setId = card.set?.id
                                const num = card.number
                                if (typeof setId === 'string' && typeof num === 'string') {
                                  img.dataset.tryCdnSet = '1'
                                  // Use reliable placeholder for fallback cards
                                  img.src = 'https://images.pokemontcg.io/sv1/1_small.jpg'
                                  return true
                                }
                                return false
                              }

                              // Try small variant of current URL
                              const trySmallVariant = () => {
                                if (img.dataset.fallbackSmall || !img.src) return false
                                try {
                                  const u = new URL(img.src)
                                  if (/_large\./.test(u.pathname)) {
                                    img.dataset.fallbackSmall = '1'
                                    img.src = u.origin + u.pathname.replace('_large.', '_small.')
                                    return true
                                  }
                                } catch {}
                                return false
                              }

                              if (tryCdnFromCardId()) return
                              if (tryCdnFromSetNum()) return
                              if (trySmallVariant()) return
                              // Final tiny image placeholder from CDN (more reliable than GitHub raw)
                              img.src = 'https://images.pokemontcg.io/sv1/1_small.jpg'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
