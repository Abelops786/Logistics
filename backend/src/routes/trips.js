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

// POST /api/trips/:id/bilty — agent submits bilty for an approved trip
router.post('/:id/bilty', authenticate, requireRole('agent'), async (req, res) => {
  const { bilty_no, category, invoice_type, gross_weight_mt, freight,
          pod_required, credit_term_days, transit_loss, image_base64 } = req.body;
  try {
    const tripRow = await pool.query(
      "SELECT * FROM trips WHERE id=$1 AND agent_id=$2 AND status='approved'",
      [req.params.id, req.user.id]
    );
    if (!tripRow.rows.length)
      return res.status(404).json({ message: 'Trip not found or not approved' });

    // Upsert — allow re-upload
    const { rows } = await pool.query(
      `INSERT INTO bilty_submissions
         (trip_id, agent_id, bilty_no, category, invoice_type, gross_weight_mt,
          freight, pod_required, credit_term_days, transit_loss, image_base64)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (trip_id) DO UPDATE SET
         bilty_no=EXCLUDED.bilty_no, category=EXCLUDED.category,
         invoice_type=EXCLUDED.invoice_type, gross_weight_mt=EXCLUDED.gross_weight_mt,
         freight=EXCLUDED.freight, pod_required=EXCLUDED.pod_required,
         credit_term_days=EXCLUDED.credit_term_days, transit_loss=EXCLUDED.transit_loss,
         image_base64=EXCLUDED.image_base64, updated_at=NOW()
       RETURNING *`,
      [req.params.id, req.user.id, bilty_no||null, category||null, invoice_type||null,
       gross_weight_mt||null, freight||null, pod_required||null,
       credit_term_days||null, transit_loss||null, image_base64||null]
    );
    res.status(201).json({ message: 'Bilty uploaded successfully', bilty: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/trips/:id/bilty — agent views own bilty
router.get('/:id/bilty', authenticate, requireRole('agent'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bilty_submissions WHERE trip_id=$1 AND agent_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ bilty: rows[0] || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
