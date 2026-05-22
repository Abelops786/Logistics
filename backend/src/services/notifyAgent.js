const pool = require('../config/database');

async function notify(userId, title, body, type, tripId = null) {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, title, body, type, trip_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, title, body, type, tripId]
    );
  } catch (err) {
    console.error('Notification insert failed:', err.message);
  }
}

module.exports = { notify };
