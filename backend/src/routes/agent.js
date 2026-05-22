const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { notify } = require('../services/notifyAgent');

const router = express.Router();

// GET /api/agent/ledger
router.get('/ledger', authenticate, requireRole('agent'), async (req, res) => {
  const agentId = req.user.id;
  try {
    const summary = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE agent_id = $1) AS total_requests,
         COUNT(*) FILTER (WHERE agent_id = $1 AND status = 'approved') AS approved_trips,
         COUNT(*) FILTER (WHERE agent_id = $1 AND status = 'rejected') AS rejected_trips,
         COALESCE(SUM(admin_final_price) FILTER (WHERE agent_id = $1 AND status = 'approved'), 0) AS total_revenue
       FROM trips`,
      [agentId]
    );

    const trips = await pool.query(
      `SELECT t.id, t.pickup_location, t.dropoff_locations, t.container_type,
              t.system_estimated_price, t.agent_requested_price, t.admin_final_price,
              t.payment_type, t.status, t.agent_repriced, t.created_at,
              v.plate_number, d.name AS driver_name, d.phone AS driver_phone
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       WHERE t.agent_id = $1
       ORDER BY t.created_at DESC`,
      [agentId]
    );

    res.json({ summary: summary.rows[0], history: trips.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/agent/trips/:id/counter — agent sends a new counter price on a quoted trip
router.post('/trips/:id/counter', authenticate, requireRole('agent'), async (req, res) => {
  const { new_price } = req.body;
  if (!new_price || isNaN(new_price)) {
    return res.status(400).json({ message: 'new_price is required' });
  }
  try {
    const tripCheck = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND agent_id = $2',
      [req.params.id, req.user.id]
    );
    if (!tripCheck.rows.length) return res.status(404).json({ message: 'Trip not found' });
    if (tripCheck.rows[0].status !== 'quoted') {
      return res.status(400).json({ message: 'Can only counter-price a quoted trip' });
    }
    if (tripCheck.rows[0].agent_repriced) {
      return res.status(400).json({ message: 'You have already used your one re-price. You can only Accept or Reject now.' });
    }

    // Validate new price is within system estimated range
    const sysEstimate = parseFloat(tripCheck.rows[0].system_estimated_price);
    if (sysEstimate > 0) {
      const low = Math.round(sysEstimate * 0.9);
      const high = Math.round(sysEstimate * 1.1);
      if (new_price < low || new_price > high) {
        return res.status(400).json({
          message: `Price must be between Rs. ${low.toLocaleString()} and Rs. ${high.toLocaleString()}.`,
        });
      }
    }

    const { rows } = await pool.query(
      `UPDATE trips SET agent_requested_price = $1, admin_final_price = NULL,
       status = 'pending', agent_repriced = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [new_price, req.params.id]
    );
    res.json({ message: 'Counter price sent. Admin will review.', trip: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/agent/trips/:id/confirm — agent accepts or rejects admin-quoted price
router.post('/trips/:id/confirm', authenticate, requireRole('agent'), async (req, res) => {
  const { action } = req.body; // 'accept' | 'reject'
  if (!['accept', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'action must be accept or reject' });
  }

  try {
    const tripCheck = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND agent_id = $2',
      [req.params.id, req.user.id]
    );
    if (!tripCheck.rows.length) return res.status(404).json({ message: 'Trip not found' });
    if (tripCheck.rows[0].status !== 'quoted') {
      return res.status(400).json({ message: 'Trip is not in quoted status' });
    }

    const newStatus = action === 'accept' ? 'approved' : 'rejected';
    const { rows } = await pool.query(
      'UPDATE trips SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newStatus, req.params.id]
    );

    if (newStatus === 'rejected') {
      await notify(req.user.id, 'Trip Rejected', 'You rejected the admin\'s quoted price. You can submit a new trip request.', 'trip_rejected', req.params.id);
    }

    res.json({ message: `Trip ${newStatus}`, trip: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/agent/profile — agent updates own profile
router.put('/profile', authenticate, requireRole('agent'), async (req, res) => {
  const { name, region, new_password } = req.body;
  try {
    let query = 'UPDATE users SET name = $1, region = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, phone, region, status';
    let params = [name || req.user.name, region || null, req.user.id];

    if (new_password && new_password.length >= 6) {
      const hash = await bcrypt.hash(new_password, 10);
      query = 'UPDATE users SET name = $1, region = $2, password_hash = $3, updated_at = NOW() WHERE id = $4 RETURNING id, name, phone, region, status';
      params = [name || req.user.name, region || null, hash, req.user.id];
    }

    const { rows } = await pool.query(query, params);
    res.json({ message: 'Profile updated', user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/agent/notifications
router.get('/notifications', authenticate, requireRole('agent'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    const unread = rows.filter((n) => !n.is_read).length;
    res.json({ notifications: rows, unread_count: unread });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/agent/notifications/read-all
router.post('/notifications/read-all', authenticate, requireRole('agent'), async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.user.id]);
    res.json({ message: 'Marked all as read' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
