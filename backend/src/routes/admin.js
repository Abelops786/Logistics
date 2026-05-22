const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { buildTripWhereClause, stripCashFieldsArray } = require('../middleware/tripFilter');
const { sendWhatsApp } = require('../services/notificationService');

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
      // Reuse positional vars: agentName in slot 1, rest empty — notification service handles template branching
      await sendWhatsApp(rows[0].phone, [rows[0].name, 'Your Abel Logistics agent account has been approved. You can now log in.', '', '', '']);
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
      "SELECT id, name, cnic, phone, region, status, created_at FROM users WHERE role = 'agent' ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/drivers
router.get('/drivers', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM drivers ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/drivers
router.post('/drivers', ...isAdmin, async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) return res.status(400).json({ message: 'name and phone are required' });
  try {
    const { rows } = await pool.query(
      "INSERT INTO drivers (name, phone) VALUES ($1, $2) RETURNING *",
      [name, phone]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/vehicles
router.get('/vehicles', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM vehicles ORDER BY plate_number ASC");
    res.json(rows);
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
  const { final_price, vehicle_id, driver_id, payment_type } = req.body;
  if (!final_price || !vehicle_id || !driver_id || !payment_type) {
    return res.status(400).json({ message: 'final_price, vehicle_id, driver_id, payment_type are required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE trips
       SET admin_final_price = $1, vehicle_id = $2, driver_id = $3, payment_type = $4,
           status = 'approved', updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [final_price, vehicle_id, driver_id, payment_type, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Trip not found' });

    const trip = rows[0];

    // Fetch agent & vehicle/driver info for notification
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

      await sendWhatsApp(
        agentRow.rows[0].phone,
        [agentRow.rows[0].name, route, String(final_price), plate, driverName]
      );
    }

    res.json({ message: 'Trip approved and assigned', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
