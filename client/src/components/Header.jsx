import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useUser } from '../state/UserContext.jsx'

export default function Header() {
  const { user, logout } = useUser()
  const location = useLocation()

  return (
    <header className="bg-slate-800 border-b border-slate-700">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          <Link to="/store">Pokémon TCG Pack Opening</Link>
        </h1>
        <nav className="flex items-center gap-4">
          <Link className={`hover:underline ${location.pathname === '/store' ? 'underline' : ''}`} to="/store">Store</Link>
          <Link className={`hover:underline ${location.pathname === '/collection' ? 'underline' : ''}`} to="/collection">Collection</Link>
          <Link className={`hover:underline ${location.pathname.startsWith('/games') ? 'underline' : ''}`} to="/games">Games</Link>
        </nav>
        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm">{user.username}</span>
              <span className="text-sm bg-yellow-400 text-slate-900 px-2 py-1 rounded font-semibold">{user.poke_coins} PokéCoins</span>
              <button onClick={logout} className="text-sm text-red-300 hover:text-red-200">Logout</button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
