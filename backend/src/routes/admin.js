const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { buildTripWhereClause, stripCashFieldsArray } = require('../middleware/tripFilter');
const { sendWhatsApp } = require('../services/notificationService');
const { notify } = require('../services/notifyAgent');

const router = express.Router();
const isAdmin = [authenticate, requireRole('admin', 'super_admin')];

// GET /api/admin/agents/pending
router.get('/agents/pending', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, cnic, phone, region, cnic_front_base64, cnic_back_base64, created_at FROM users WHERE status = 'pending' AND role = 'agent' ORDER BY created_at ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/agents/:id/approve
router.post('/agents/:id/approve', ...isAdmin, async (req, res) => {
  const { action } = req.body; // 'approve' | 'reject'
  const newStatus = action === 'reject' ? 'suspended' : 'active';
  try {
    const { rows } = await pool.query(
      "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, phone, status",
      [newStatus, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found' });

    if (newStatus === 'active') {
      await sendWhatsApp(rows[0].phone, [rows[0].name, 'Your Abel Logistics agent account has been approved. You can now log in.', '', '', '']);
      await notify(rows[0].id, 'Account Approved ✅', 'Your Abel Logistics agent account is now active. You can submit trip requests.', 'account_approved');
    }
    res.json({ message: `Agent ${newStatus}`, agent: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/agents — all agents list
router.get('/agents', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, cnic, phone, region, status, cnic_front_base64, cnic_back_base64, created_at FROM users WHERE role = 'agent' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/agents/:id — edit agent details + password
router.put('/agents/:id', ...isAdmin, async (req, res) => {
  const { name, phone, region, cnic, new_password, cnic_front_base64, cnic_back_base64 } = req.body;
  try {
    let passwordHash = null;
    if (new_password && new_password.length >= 6) {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(new_password, 10);
    }

    const { rows } = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         region = COALESCE($3, region),
         cnic = COALESCE($4, cnic),
         password_hash = COALESCE($5, password_hash),
         cnic_front_base64 = COALESCE($6, cnic_front_base64),
         cnic_back_base64 = COALESCE($7, cnic_back_base64),
         updated_at = NOW()
       WHERE id = $8
       RETURNING id, name, phone, region, cnic, status`,
      [name || null, phone || null, region || null, cnic || null, passwordHash, cnic_front_base64 || null, cnic_back_base64 || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found' });
    res.json({ message: 'Agent updated', agent: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/drivers
router.get('/drivers', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*, v.plate_number AS assigned_vehicle
      FROM drivers d
      LEFT JOIN vehicles v ON v.assigned_driver_id = d.id
      ORDER BY d.name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/drivers
router.post('/drivers', ...isAdmin, async (req, res) => {
  const { name, phone, photo_base64 } = req.body;
  if (!name || !phone) return res.status(400).json({ message: 'name and phone are required' });
  try {
    const { rows } = await pool.query(
      "INSERT INTO drivers (name, phone, photo_base64) VALUES ($1, $2, $3) RETURNING *",
      [name, phone, photo_base64 || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/drivers/:id
router.put('/drivers/:id', ...isAdmin, async (req, res) => {
  const { name, phone, status, photo_base64 } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE drivers SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         status = COALESCE($3, status),
         photo_base64 = COALESCE($4, photo_base64),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name || null, phone || null, status || null, photo_base64 || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Driver not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/vehicles
router.get('/vehicles', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, d.status AS driver_status, d.photo_base64 AS driver_photo
      FROM vehicles v
      LEFT JOIN drivers d ON d.id = v.assigned_driver_id
      ORDER BY v.plate_number ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/vehicles/:id/assign-driver
router.put('/vehicles/:id/assign-driver', ...isAdmin, async (req, res) => {
  const { driver_id } = req.body;
  try {
    const { rows } = await pool.query(
      "UPDATE vehicles SET assigned_driver_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [driver_id || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Vehicle not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/vehicles
router.post('/vehicles', ...isAdmin, async (req, res) => {
  const { plate_number, container_type, rate_per_km } = req.body;
  if (!plate_number || !container_type) return res.status(400).json({ message: 'plate_number and container_type required' });
  try {
    const { rows } = await pool.query(
      "INSERT INTO vehicles (plate_number, container_type, rate_per_km) VALUES ($1, $2, $3) RETURNING *",
      [plate_number, container_type, rate_per_km || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/pricing
router.put('/pricing', ...isAdmin, async (req, res) => {
  const { container_type, rate_per_km } = req.body;
  if (!container_type || !rate_per_km) return res.status(400).json({ message: 'container_type and rate_per_km are required' });
  try {
    await pool.query(
      "UPDATE vehicles SET rate_per_km = $1, updated_at = NOW() WHERE container_type = $2",
      [rate_per_km, container_type]
    );
    res.json({ message: 'Pricing updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/trips — all trips with role-based filtering
router.get('/trips', ...isAdmin, async (req, res) => {
  const whereClause = req.user.role === 'admin' ? "WHERE t.payment_type = 'bank' OR t.payment_type IS NULL" : '';
  try {
    const { rows } = await pool.query(
      `SELECT t.*, u.name AS agent_name, u.phone AS agent_phone,
              v.plate_number, v.container_type AS vehicle_type,
              d.name AS driver_name, d.phone AS driver_phone
       FROM trips t
       LEFT JOIN users u ON u.id = t.agent_id
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers d ON d.id = t.driver_id
       ${whereClause}
       ORDER BY t.created_at DESC`
    );
    const result = req.user.role === 'admin'
      ? rows.map((r) => { const s = { ...r }; delete s.payment_type; return s; })
      : rows;
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/trips/:id/assign
router.post('/trips/:id/assign', ...isAdmin, async (req, res) => {
  const { final_price, vehicle_id, payment_type } = req.body;
  let { driver_id } = req.body;

  if (!final_price || !vehicle_id || !payment_type) {
    return res.status(400).json({ message: 'final_price, vehicle_id, payment_type are required' });
  }

  // Auto-resolve driver from vehicle if not provided
  if (!driver_id) {
    const vRow = await pool.query('SELECT assigned_driver_id FROM vehicles WHERE id = $1', [vehicle_id]);
    driver_id = vRow.rows[0]?.assigned_driver_id;
    if (!driver_id) {
      return res.status(400).json({ message: 'This vehicle has no driver assigned. Assign a driver to the vehicle first.' });
    }
  }

  try {
    // If agent submitted a counter offer, set status to 'quoted' — agent must confirm
    const tripCheck = await pool.query('SELECT agent_requested_price FROM trips WHERE id = $1', [req.params.id]);
    const hasCounterOffer = tripCheck.rows[0]?.agent_requested_price != null;
    const newStatus = hasCounterOffer ? 'quoted' : 'approved';

    const { rows } = await pool.query(
      `UPDATE trips
       SET admin_final_price = $1, vehicle_id = $2, driver_id = $3, payment_type = $4,
           status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [final_price, vehicle_id, driver_id, payment_type, newStatus, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Trip not found' });

    const trip = rows[0];
    const [agentRow, vehicleRow, driverRow] = await Promise.all([
      pool.query('SELECT name, phone FROM users WHERE id = $1', [trip.agent_id]),
      pool.query('SELECT plate_number FROM vehicles WHERE id = $1', [vehicle_id]),
      pool.query('SELECT name FROM drivers WHERE id = $1', [driver_id]),
    ]);

    if (agentRow.rows.length) {
      const drops = Array.isArray(trip.dropoff_locations)
        ? trip.dropoff_locations.join(' → ')
        : JSON.parse(trip.dropoff_locations).join(' → ');
      const route = `${trip.pickup_location} → ${drops}`;
      const plate = vehicleRow.rows[0]?.plate_number || '';
      const driverName = driverRow.rows[0]?.name || '';

      if (newStatus === 'quoted') {
        await sendWhatsApp(agentRow.rows[0].phone, [agentRow.rows[0].name, route, String(final_price), plate, driverName]);
        await notify(trip.agent_id,
          'Admin Quoted a Price',
          `Rs. ${Number(final_price).toLocaleString()} for your trip: ${route}. Please Accept or Reject.`,
          'trip_quoted', trip.id);
      } else {
        await sendWhatsApp(agentRow.rows[0].phone, [agentRow.rows[0].name, route, String(final_price), plate, driverName]);
        await notify(trip.agent_id,
          'Trip Approved! 🎉',
          `Vehicle: ${plate} • Driver: ${driverName} • Final Price: Rs. ${Number(final_price).toLocaleString()}`,
          'trip_approved', trip.id);
      }
    }

    res.json({ message: newStatus === 'quoted' ? 'Price quoted, awaiting agent confirmation' : 'Trip approved', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/trips/:id/complete
router.post('/trips/:id/complete', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE trips SET status = 'completed', updated_at = NOW()
       WHERE id = $1 AND status = 'approved'
       RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ message: 'Trip not found or not in approved status' });
    res.json({ message: 'Trip marked as completed', trip: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
