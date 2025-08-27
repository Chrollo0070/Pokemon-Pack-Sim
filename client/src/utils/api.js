import axios from 'axios'

// Use environment variable for API base URL, with a default for local development
const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

export const api = axios.create({
  baseURL,
})
