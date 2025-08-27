import axios from 'axios'

// Use relative paths for API requests when deployed to Vercel
// This allows the frontend to work with the backend routes defined in vercel.json
const baseURL = import.meta.env.VITE_API_BASE || ''

export const api = axios.create({
  baseURL,
})
