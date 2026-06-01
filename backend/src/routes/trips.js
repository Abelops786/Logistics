const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendWhatsApp, sendEmail } = require('../services/notificationService');

const router = express.Router();

// POST /api/trips/request
router.post('/request', authenticate, requireRole('agent'), async (req, res) => {
  const { pickup_location, dropoff_locations, container_type, agent_requested_price,
          client_name, client_phone, client_name_2, client_phone_2,
          weight_ton, cargo_items, is_double } = req.body;

  if (!pickup_location || !dropoff_locations?.length || !container_type) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO trips (agent_id, pickup_location, dropoff_locations, container_type, agent_requested_price,
                          client_name, client_phone, client_name_2, client_phone_2,
                          weight_ton, cargo_items, is_double, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending') RETURNING *`,
      [req.user.id, pickup_location, JSON.stringify(dropoff_locations), container_type, agent_requested_price || null,
       client_name || null, client_phone || null, client_name_2 || null, client_phone_2 || null,
       weight_ton || null, cargo_items || null, is_double || false]
    );

    const trip = rows[0];
    const route = `${pickup_location} → ${dropoff_locations.join(' → ')}`;
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
    if (adminPhone) await sendWhatsApp(adminPhone, [req.user.name, route, '', '', '', req.user.phone || '']);
    if (process.env.ADMIN_EMAIL) {
      await sendEmail(process.env.ADMIN_EMAIL, `New Trip Request from ${req.user.name}`,
        `<p>Agent <strong>${req.user.name}</strong> submitted a new trip request.</p><p>Route: ${route}</p><p>Container: ${container_type}</p>`);
    }

    res.status(201).json({ message: 'Trip request submitted', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
