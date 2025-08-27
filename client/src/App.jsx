import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useUser } from './state/UserContext.jsx'
import Login from './components/Login.jsx'
import PackStore from './components/PackStore.jsx'
import Collection from './components/Collection.jsx'
import Header from './components/Header.jsx'
import Admin from './components/Admin.jsx'
import Games from './components/Games.jsx'
import SpinWheel from './components/games/SpinWheel.jsx'
import Silhouette from './components/games/Silhouette.jsx'
import Memory from './components/games/Memory.jsx'
import Typing from './components/games/Typing.jsx'

function RequireAuth({ children }) {
  const { user } = useUser()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />
  }
  return children
}

export default function App() {
  const { user } = useUser()

  return (
    <div className="min-h-screen">
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/store" replace /> : <Login />}
        />
        <Route
          path="/store"
          element={
            <RequireAuth>
              <Header />
              <PackStore />
            </RequireAuth>
          }
        />
        <Route
          path="/collection"
          element={
            <RequireAuth>
              <Header />
              <Collection />
            </RequireAuth>
          }
        />
        <Route
          path="/games"
          element={
            <RequireAuth>
              <Header />
              <Games />
            </RequireAuth>
          }
        />
        <Route
          path="/games/spin"
          element={
            <RequireAuth>
              <Header />
              <SpinWheel />
            </RequireAuth>
          }
        />
        <Route
          path="/games/silhouette"
          element={
            <RequireAuth>
              <Header />
              <Silhouette />
            </RequireAuth>
          }
        />
        <Route
          path="/games/memory"
          element={
            <RequireAuth>
              <Header />
              <Memory />
            </RequireAuth>
          }
        />
        <Route
          path="/games/typing"
          element={
            <RequireAuth>
              <Header />
              <Typing />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={<Admin />}
        />
        <Route path="*" element={<Navigate to={user ? '/store' : '/'} replace />} />
      </Routes>
    </div>
  )
}
