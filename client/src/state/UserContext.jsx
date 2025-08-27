import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../utils/api.js'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null) // { username, poke_coins, id }

  // Persist username in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('username')
    if (saved && !user) {
      api.get(`/api/users/${saved}`)
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('username'))
    }
  }, [])

  const login = async (username) => {
    const res = await api.post('/api/users/register', { username })
    localStorage.setItem('username', res.data.username)
    setUser(res.data)
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('username')
    setUser(null)
  }

  const updateBalance = (deltaOrNewValue, isDelta = true) => {
    setUser((u) => {
      if (!u) return u;
      const newValue = isDelta ? u.poke_coins + deltaOrNewValue : deltaOrNewValue;
      return { ...u, poke_coins: newValue };
    });
  }

  return (
    <UserContext.Provider value={{ user, setUser, login, logout, updateBalance }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
