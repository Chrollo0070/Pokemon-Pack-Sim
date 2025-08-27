// Add this to the end of server/index.js

// Games: Typing Challenge
app.post('/api/games/typing/finish', async (req, res) => {
  const db = await getDB();
  try {
    const { username, correctWords, maxStreak } = req.body || {};
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }
    const user = await getUserByUsername(username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Calculate rewards based on correct words and streak
    let coins = 0;
    if (correctWords > 0) {
      const correctReward = correctWords * 20; // 20 coins per correct answer
      const streakReward = maxStreak * 10; // 10 coins per streak point
      coins = correctReward + streakReward;
    }
    
    // Update user balance
    await db.run('UPDATE users SET poke_coins = poke_coins + ? WHERE id = ?', [coins, user.id]);
    
    // Get updated user
    const updated = await db.get('SELECT * FROM users WHERE id = ?', user.id);
    
    return res.json({ 
      coins,
      user: updated
    });
  } catch (e) {
    console.error('Error in /api/games/typing/finish:', e);
    return res.status(500).json({ error: 'Server error' });
  }
});