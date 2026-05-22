const express = require('express');
const axios = require('axios');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendWhatsApp, sendEmail } = require('../services/notificationService');

const router = express.Router();

// ── Google Directions API distance calculator ──────────────────────────────
// Handles multi-stop routes correctly including round trips / back-tracking
async function calculateDistanceGoogle(stops) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || stops.length < 2) return null;

  const origin = encodeURIComponent(stops[0]);
  const destination = encodeURIComponent(stops[stops.length - 1]);

  // Intermediate stops as waypoints (optimized:false preserves order)
  const waypoints = stops.slice(1, -1).map((s) => encodeURIComponent(s)).join('|');
  const waypointsParam = waypoints ? `&waypoints=optimize:false|${waypoints}` : '';

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&key=${apiKey}&region=pk&units=metric`;

  try {
    const res = await axios.get(url, { timeout: 8000 });
    const data = res.data;

    if (data.status !== 'OK') {
      console.warn('Google Directions API status:', data.status, data.error_message || '');
      return null;
    }

    // Sum distance of every leg (each stop-to-stop segment)
    const route = data.routes[0];
    let totalMeters = 0;
    route.legs.forEach((leg) => { totalMeters += leg.distance.value; });
    const totalKm = totalMeters / 1000;

    // Build per-leg breakdown for transparency
    const legs = route.legs.map((leg, i) => ({
      from: stops[i],
      to: stops[i + 1] || stops[stops.length - 1],
      distance_km: (leg.distance.value / 1000).toFixed(1),
      duration: leg.duration.text,
    }));

    return { totalKm: parseFloat(totalKm.toFixed(2)), legs, source: 'google' };
  } catch (err) {
    console.warn('Google Directions API error:', err.message);
    return null;
  }
}

// ── City matrix fallback ───────────────────────────────────────────────────
async function calculateDistanceMatrix(stops) {
  let totalKm = 0;
  const legs = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i].trim();
    const to = stops[i + 1].trim();

    // Extract city name from full address (e.g. "North Karachi, Karachi, Pakistan" → "Karachi")
    const fromCity = from.split(',')[1]?.trim() || from.split(',')[0]?.trim();
    const toCity = to.split(',')[1]?.trim() || to.split(',')[0]?.trim();

    const distRow = await pool.query(
      `SELECT distance_km FROM city_km_matrix
       WHERE (LOWER(city_from) = LOWER($1) OR LOWER(city_from) = LOWER($3))
         AND (LOWER(city_to)   = LOWER($2) OR LOWER(city_to)   = LOWER($4))`,
      [from, to, fromCity, toCity]
    );

    const km = distRow.rows.length ? parseFloat(distRow.rows[0].distance_km) : 300;
    totalKm += km;
    legs.push({ from, to, distance_km: km.toFixed(1) });
  }
  return { totalKm: parseFloat(totalKm.toFixed(2)), legs, source: 'matrix' };
}

// GET /api/trips/pricing-rates
router.get('/pricing-rates', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT container_type, rate_per_km FROM vehicles WHERE plate_number IN ('SYSTEM-50FT', 'SYSTEM-47FT')"
    );
    const rates = {};
    rows.forEach((r) => { rates[r.container_type] = parseFloat(r.rate_per_km); });
    res.json(rates);
  } catch (err) {
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

    // Try Google Directions first, fall back to matrix
    let result = await calculateDistanceGoogle(stops);
    if (!result) {
      result = await calculateDistanceMatrix(stops);
    }

    const { totalKm, legs, source } = result;
    const base = Math.round(totalKm * rate);
    const low = Math.round(base * 0.9);
    const high = Math.round(base * 1.1);

    res.json({
      total_km: totalKm,
      rate_per_km: rate,
      estimate_low: low,
      estimate_high: high,
      legs,           // breakdown per stop
      source,         // 'google' or 'matrix'
    });
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

  if (agent_requested_price != null && system_estimated_price != null) {
    const low = Math.round(system_estimated_price * 0.9);
    const high = Math.round(system_estimated_price * 1.1);
    if (agent_requested_price < low || agent_requested_price > high) {
      return res.status(400).json({
        message: `Counter price must be between Rs. ${low.toLocaleString()} and Rs. ${high.toLocaleString()}.`,
      });
    }
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO trips (agent_id, pickup_location, dropoff_locations, container_type, system_estimated_price, agent_requested_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [req.user.id, pickup_location, JSON.stringify(dropoff_locations), container_type, system_estimated_price || null, agent_requested_price || null]
    );

    const trip = rows[0];
    const route = `${pickup_location} → ${dropoff_locations.join(' → ')}`;
    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
    if (adminPhone) await sendWhatsApp(adminPhone, [req.user.name, route]);
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
