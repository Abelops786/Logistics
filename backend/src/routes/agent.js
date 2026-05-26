const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { notify } = require('../services/notifyAgent');
const { sendAdminAlert, sendWhatsApp } = require('../services/notificationService');

const router = express.Router();

// GET /api/agent/ledger
router.get('/ledger', authenticate, requireRole('agent'), async (req, res) => {
  const agentId = req.user.id;
  try {
    const summary = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE agent_id = $1) AS total_requests,
         COUNT(*) FILTER (WHERE agent_id = $1 AND status IN ('approved','completed')) AS approved_trips,
         COUNT(*) FILTER (WHERE agent_id = $1 AND status = 'rejected') AS rejected_trips,
         COALESCE(SUM(admin_final_price + COALESCE(detention_penalty,0)) FILTER (WHERE agent_id = $1 AND status IN ('approved','completed')), 0) AS total_revenue
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

    const { rows } = await pool.query(
      `UPDATE trips SET agent_requested_price = $1, admin_final_price = NULL,
       status = 'pending', agent_repriced = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [new_price, req.params.id]
    );
    const trip = rows[0];
    const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
    const route = `${trip.pickup_location} → ${drops.join(' → ')}`;
    await sendAdminAlert(req.user.name, 'counter', route, new_price, req.user.phone);
    res.json({ message: 'Counter price sent. Admin will review.', trip });
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
    const trip = rows[0];
    const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
    const route = `${trip.pickup_location} → ${drops.join(' → ')}`;

    if (newStatus === 'rejected') {
      await notify(req.user.id, 'Trip Rejected', 'You rejected the admin\'s quoted price. You can submit a new trip request.', 'trip_rejected', req.params.id);
    } else {
      // Agent accepted — send WhatsApp with vehicle & driver details
      const [vRow, dRow] = await Promise.all([
        pool.query('SELECT plate_number FROM vehicles WHERE id=$1', [trip.vehicle_id]),
        pool.query('SELECT name FROM drivers WHERE id=$1', [trip.driver_id]),
      ]);
      const plate = vRow.rows[0]?.plate_number || '';
      const driverName = dRow.rows[0]?.name || '';
      if (req.user.phone) {
        await sendWhatsApp(req.user.phone, [req.user.name, route, String(trip.admin_final_price), plate, driverName]);
      }
      await notify(req.user.id, 'Trip Approved! 🎉',
        `Vehicle: ${plate} • Driver: ${driverName} • Price: Rs. ${Number(trip.admin_final_price).toLocaleString()}`,
        'trip_approved', req.params.id);
      // Auto-create ledger entry (trip was quoted, now accepted)
      try {
        const noEntry = await pool.query('SELECT 1 FROM ledger_transactions WHERE trip_id=$1', [trip.id]);
        if (!noEntry.rows.length && trip.agent_id && trip.admin_final_price) {
          await pool.query(
            `INSERT INTO ledger_transactions (agent_id, trip_id, transaction_type, amount, payment_method, reference_note, logged_by)
             VALUES ($1,$2,'credit',$3,$4,'Agent accepted quoted price',$5)`,
            [trip.agent_id, trip.id, parseFloat(trip.admin_final_price),
             trip.payment_type === 'cash' ? 'cash' : 'bank_transfer', trip.agent_id]
          );
        }
      } catch (ledgerErr) {
        console.error('Ledger insert skipped:', ledgerErr.message);
      }
    }

    // Notify admin via WhatsApp
    await sendAdminAlert(req.user.name, action, route, trip.admin_final_price, req.user.phone);

    res.json({ message: `Trip ${newStatus}`, trip });
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
