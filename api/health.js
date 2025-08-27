import { getUserByUsername } from '../server/database.js';

export default async function handler(request, response) {
  try {
    // Simple health check
    response.status(200).json({ ok: true, message: 'Vercel API endpoint working' });
  } catch (error) {
    console.error('Error in health check:', error);
    response.status(500).json({ error: 'Server error' });
  }
}