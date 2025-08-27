import React, { useState } from 'react'
import { api } from '../utils/api.js'

export default function Admin() {
  const [username, setUsername] = useState('')
  const [amount, setAmount] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    if (!username || !amount || !token) {
      setMessage('Please fill all fields.')
      return
    }
    try {
      setLoading(true)
      const { data } = await api.post('/api/admin/set-coins', { username, amount }, { headers: { 'X-Admin-Token': token } })
      setMessage(`Success: ${data.username} now has ${data.poke_coins} PokéCoins`)
    } catch (e) {
      const msg = e?.response?.data?.error || 'Request failed'
      setMessage(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin: Set Coins</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Username</label>
          <input className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Amount</label>
          <input type="number" min={0} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Admin Token</label>
          <input className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2" value={token} onChange={(e) => setToken(e.target.value)} />
        </div>
        <button disabled={loading} className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded w-full">{loading ? 'Setting...' : 'Set Coins'}</button>
      </form>
      {message && <p className="mt-3 text-sm">{message}</p>}
      <p className="mt-4 text-xs text-slate-400">Note: This page is not linked in the UI. Navigate directly to /admin. Keep your admin token secret.</p>
    </div>
  )
}
