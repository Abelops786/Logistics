const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendWhatsApp, sendEmail } = require('../services/notificationService');

const router = express.Router();

// GET /api/trips/pricing-rates — returns current rates for both container types
router.get('/pricing-rates', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT container_type, rate_per_km FROM vehicles WHERE plate_number IN ('SYSTEM-50FT', 'SYSTEM-47FT')"
    );
    const rates = {};
    rows.forEach((r) => { rates[r.container_type] = parseFloat(r.rate_per_km); });
    res.json(rates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/trips/estimate
router.post('/estimate', authenticate, async (req, res) => {
  const { pickup_location, dropoff_locations, container_type } = req.body;
  if (!pickup_location || !dropoff_locations?.length || !container_type) {
    return res.status(400).json({ message: 'pickup_location, dropoff_locations, container_type are required' });
  }

  try {
    const rateRow = await pool.query(
      "SELECT rate_per_km FROM vehicles WHERE plate_number = $1",
      [container_type === '50ft_22_wheeler' ? 'SYSTEM-50FT' : 'SYSTEM-47FT']
    );
    if (!rateRow.rows.length) return res.status(400).json({ message: 'Unknown container type' });
    const rate = parseFloat(rateRow.rows[0].rate_per_km);

    const stops = [pickup_location, ...dropoff_locations];
    let totalKm = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      const from = stops[i].trim();
      const to = stops[i + 1].trim();
      const distRow = await pool.query(
        'SELECT distance_km FROM city_km_matrix WHERE LOWER(city_from) = LOWER($1) AND LOWER(city_to) = LOWER($2)',
        [from, to]
      );
      if (distRow.rows.length) {
        totalKm += parseFloat(distRow.rows[0].distance_km);
      } else {
        totalKm += 500; // default fallback if city pair not found
      }
    }

    const base = Math.round(totalKm * rate);
    const low = Math.round(base * 0.9);
    const high = Math.round(base * 1.1);

    res.json({ total_km: totalKm, rate_per_km: rate, estimate_low: low, estimate_high: high });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/trips/request
router.post('/request', authenticate, requireRole('agent'), async (req, res) => {
  const { pickup_location, dropoff_locations, container_type, system_estimated_price, agent_requested_price } = req.body;

  if (!pickup_location || !dropoff_locations?.length || !container_type) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  // Validate agent counter offer is within estimated range
  if (agent_requested_price != null && system_estimated_price != null) {
    const low = Math.round(system_estimated_price * 0.9);
    const high = Math.round(system_estimated_price * 1.1);
    if (agent_requested_price < low || agent_requested_price > high) {
      return res.status(400).json({
        message: `Counter price must be between Rs. ${low.toLocaleString()} and Rs. ${high.toLocaleString()} (within the system estimate range).`,
      });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO trips (agent_id, pickup_location, dropoff_locations, container_type, system_estimated_price, agent_requested_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        req.user.id,
        pickup_location,
        JSON.stringify(dropoff_locations),
        container_type,
        system_estimated_price || null,
        agent_requested_price || null,
      ]
    );

    const trip = rows[0];
    const route = `${pickup_location} → ${dropoff_locations.join(' → ')}`;
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;

    // Notify admin via WhatsApp — positional vars: [AgentName, Route, ...]
    if (adminPhone) {
      await sendWhatsApp(adminPhone, [req.user.name, route]);
    }

    // Notify admin via email
    if (process.env.ADMIN_EMAIL) {
      await sendEmail(
        process.env.ADMIN_EMAIL,
        `New Trip Request from ${req.user.name}`,
        `<p>Agent <strong>${req.user.name}</strong> submitted a new trip request.</p><p>Route: ${route}</p><p>Container: ${container_type}</p>`
      );
    }

    res.status(201).json({ message: 'Trip request submitted', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
