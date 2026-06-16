const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendWhatsApp, sendEmail } = require('../services/notificationService');
const { notify } = require('../services/notifyAgent');

const router = express.Router();

// POST /api/trips/request
router.post('/request', authenticate, requireRole('agent'), async (req, res) => {
  const { pickup_location, dropoff_locations, container_type, agent_requested_price,
          client_name, client_phone, client_name_2, client_phone_2,
          weight_ton, cargo_items, is_double, driver_id } = req.body;

  if (!pickup_location || !dropoff_locations?.length || !container_type) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  if (!client_name?.trim() || !client_phone?.trim()) {
    return res.status(400).json({ message: 'Client name and contact number are required' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO trips (agent_id, pickup_location, dropoff_locations, container_type, agent_requested_price,
                          client_name, client_phone, client_name_2, client_phone_2,
                          weight_ton, cargo_items, is_double, driver_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending') RETURNING *`,
      [req.user.id, pickup_location, JSON.stringify(dropoff_locations), container_type, agent_requested_price || null,
       client_name || null, client_phone || null, client_name_2 || null, client_phone_2 || null,
       weight_ton || null, cargo_items || null, is_double || false, driver_id || null]
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

// GET /api/trips/bilty/next-job — returns next auto job number
router.get('/bilty/next-job', authenticate, requireRole('agent'), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT last_value + 1 AS next FROM bilty_job_seq");
    const next = rows[0]?.next || 1;
    res.json({ job_number: String(next).padStart(3, '0') });
  } catch (err) { res.status(500).json({ job_number: '—' }); }
});

// POST /api/trips/:id/bilty — agent uploads bilty number + document (image or PDF)
router.post('/:id/bilty', authenticate, requireRole('agent'), async (req, res) => {
  const { bilty_number, bilty_file_base64, bilty_file_type,
          bilty_no, category, invoice_type, gross_weight_mt,
          freight, pod_required, credit_term_days, transit_loss, image_base64,
          booking_date, customer_name, vehicle_no, container_size, origin, destination } = req.body;
  try {
    const tripRow = await pool.query(
      "SELECT * FROM trips WHERE id=$1 AND agent_id=$2 AND status='approved'",
      [req.params.id, req.user.id]
    );
    if (!tripRow.rows.length)
      return res.status(404).json({ message: 'Trip not found or not approved' });

    const { rows } = await pool.query(
      `INSERT INTO bilty_submissions
         (trip_id, agent_id, bilty_number, bilty_file_base64, bilty_file_type,
          bilty_no, category, invoice_type, gross_weight_mt, freight,
          pod_required, credit_term_days, transit_loss, image_base64,
          booking_date, customer_name, vehicle_no, container_size, origin, destination)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (trip_id) DO UPDATE SET
         bilty_number=COALESCE(EXCLUDED.bilty_number, bilty_submissions.bilty_number),
         bilty_file_base64=COALESCE(EXCLUDED.bilty_file_base64, bilty_submissions.bilty_file_base64),
         bilty_file_type=COALESCE(EXCLUDED.bilty_file_type, bilty_submissions.bilty_file_type),
         bilty_no=COALESCE(EXCLUDED.bilty_no, bilty_submissions.bilty_no),
         category=COALESCE(EXCLUDED.category, bilty_submissions.category),
         invoice_type=COALESCE(EXCLUDED.invoice_type, bilty_submissions.invoice_type),
         gross_weight_mt=COALESCE(EXCLUDED.gross_weight_mt, bilty_submissions.gross_weight_mt),
         freight=COALESCE(EXCLUDED.freight, bilty_submissions.freight),
         pod_required=COALESCE(EXCLUDED.pod_required, bilty_submissions.pod_required),
         credit_term_days=COALESCE(EXCLUDED.credit_term_days, bilty_submissions.credit_term_days),
         transit_loss=COALESCE(EXCLUDED.transit_loss, bilty_submissions.transit_loss),
         image_base64=COALESCE(EXCLUDED.image_base64, bilty_submissions.image_base64),
         booking_date=COALESCE(EXCLUDED.booking_date, bilty_submissions.booking_date),
         customer_name=COALESCE(EXCLUDED.customer_name, bilty_submissions.customer_name),
         vehicle_no=COALESCE(EXCLUDED.vehicle_no, bilty_submissions.vehicle_no),
         container_size=COALESCE(EXCLUDED.container_size, bilty_submissions.container_size),
         origin=COALESCE(EXCLUDED.origin, bilty_submissions.origin),
         destination=COALESCE(EXCLUDED.destination, bilty_submissions.destination),
         updated_at=NOW()
       RETURNING *`,
      [req.params.id, req.user.id,
       bilty_number||null, bilty_file_base64||null, bilty_file_type||null,
       bilty_no||null, category||null, invoice_type||null, gross_weight_mt||null,
       freight||null, pod_required||null, credit_term_days||null, transit_loss||null, image_base64||null,
       booking_date||null, customer_name||null, vehicle_no||null, container_size||null,
       origin||null, destination||null]
    );

    // Notify all admins that bilty was uploaded
    const admins = await pool.query("SELECT id FROM users WHERE role IN ('admin','super_admin') AND status='active'");
    const trip = tripRow.rows[0];
    const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations||'[]');
    const route = `${trip.pickup_location} → ${drops.join(' → ')}`;
    for (const admin of admins.rows) {
      await notify(admin.id, '📄 Bilty Uploaded',
        `${req.user.name} uploaded bilty for trip: ${route}`,
        'bilty_uploaded', trip.id).catch(() => {});
    }

    res.status(201).json({ message: 'Bilty uploaded successfully', bilty: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/trips/:id/bilty/image — quick upload bilty photo only
router.post('/:id/bilty/image', authenticate, requireRole('agent'), async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ message: 'image_base64 required' });
  try {
    await pool.query(
      `INSERT INTO bilty_submissions (trip_id, agent_id, image_base64)
       VALUES ($1,$2,$3)
       ON CONFLICT (trip_id) DO UPDATE SET image_base64=$3, updated_at=NOW()`,
      [req.params.id, req.user.id, image_base64]
    );
    res.json({ message: 'Bilty image uploaded' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
});

// POST /api/trips/:id/bilty/pod — quick upload POD photo only
router.post('/:id/bilty/pod', authenticate, requireRole('agent'), async (req, res) => {
  const { image_base64 } = req.body;
  if (!image_base64) return res.status(400).json({ message: 'image_base64 required' });
  try {
    await pool.query(
      `INSERT INTO bilty_submissions (trip_id, agent_id, pod_image_base64)
       VALUES ($1,$2,$3)
       ON CONFLICT (trip_id) DO UPDATE SET pod_image_base64=$3, updated_at=NOW()`,
      [req.params.id, req.user.id, image_base64]
    );
    res.json({ message: 'POD image uploaded' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
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
