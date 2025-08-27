import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../state/UserContext.jsx'

export default function Login() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useUser()
  const navigate = useNavigate()

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim()) return setError('Please enter a username')
    try {
      setLoading(true)
      await login(username.trim())
      navigate('/store')
    } catch (e) {
      setError('Failed to login/register')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-slate-800 border border-slate-700 rounded p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Welcome Trainer</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 focus:outline-none"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold py-2 rounded"
          >
            {loading ? 'Loading...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
