const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { buildTripWhereClause, stripCashFieldsArray } = require('../middleware/tripFilter');
const { sendWhatsApp, sendAccountApproved, sendQuotedNotification, sendPenaltyNotification, sendCompletedNotification, sendNotCompleteNotification } = require('../services/notificationService');
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
      await sendAccountApproved(rows[0].phone);
      await notify(rows[0].id, 'Account Approved ✅', 'Your R Transport agent account is now active. You can submit trip requests.', 'account_approved');
    }
    res.json({ message: `Agent ${newStatus}`, agent: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/agents/:id/suspend
router.post('/agents/:id/suspend', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE users SET status = 'suspended', updated_at = NOW() WHERE id = $1 AND role = 'agent' RETURNING id, name, phone, status",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found' });
    res.json({ message: 'Agent suspended', agent: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/agents/:id/unsuspend
router.post('/agents/:id/unsuspend', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "UPDATE users SET status = 'active', updated_at = NOW() WHERE id = $1 AND role = 'agent' RETURNING id, name, phone, status",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Agent not found' });
    res.json({ message: 'Agent unsuspended', agent: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/agents/:id — hard delete agent (nullifies agent_id on trips to preserve history)
router.delete('/agents/:id', ...isAdmin, async (req, res) => {
  try {
    // Nullify agent_id on trips so trip history is kept without the agent reference
    await pool.query('UPDATE trips SET agent_id = NULL WHERE agent_id = $1', [req.params.id]);
    // Delete notifications
    await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.params.id]);
    // Hard delete the agent
    const { rows } = await pool.query("DELETE FROM users WHERE id = $1 AND role = 'agent' RETURNING name", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Agent not found' });
    res.json({ message: `Agent ${rows[0].name} permanently deleted` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/agents/:id/profile — full agent profile with revenue & trip history
router.get('/agents/:id/profile', ...isAdmin, async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const paymentFilter = isSuperAdmin ? '' : "AND t.payment_type = 'bank'";
  const agentId = req.params.id;

  // Period filter
  const period = req.query.period || 'month';
  const customFrom = req.query.from;
  const customTo = req.query.to;

  let periodStart, periodEnd;
  const now = new Date();

  if (period === 'today') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  } else if (period === 'yesterday') {
    periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (period === 'week') {
    periodStart = new Date(now.getTime() - 7 * 86400000).toISOString();
    periodEnd = new Date(now.getTime() + 86400000).toISOString();
  } else if (period === 'custom' && customFrom && customTo) {
    periodStart = new Date(customFrom).toISOString();
    periodEnd = new Date(new Date(customTo).getTime() + 86400000).toISOString();
  } else {
    // month (default)
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  }

  try {
    const [agentRow, statsRow, revenueRow, trips] = await Promise.all([
      pool.query(
        "SELECT id, name, phone, cnic, region, status, cnic_front_base64, cnic_back_base64, created_at FROM users WHERE id = $1 AND role = 'agent'",
        [agentId]
      ),

      // All-time counts
      pool.query(
        `SELECT
           COUNT(*) AS total_requests,
           COUNT(*) FILTER (WHERE status IN ('approved','completed')) AS approved,
           COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending,
           COUNT(*) FILTER (WHERE status = 'quoted') AS quoted,
           COALESCE(SUM(admin_final_price + COALESCE(detention_penalty,0)) FILTER (WHERE status IN ('approved','completed')), 0) AS total_revenue_alltime
         FROM trips t WHERE agent_id = $1 ${paymentFilter}`,
        [agentId]
      ),

      // Revenue for selected period
      pool.query(
        `SELECT
           COALESCE(SUM(admin_final_price + COALESCE(detention_penalty,0)), 0) AS period_revenue,
           COUNT(*) AS period_trips
         FROM trips t
         WHERE agent_id = $1 ${paymentFilter}
           AND status IN ('approved','completed')
           AND created_at >= $2 AND created_at < $3`,
        [agentId, periodStart, periodEnd]
      ),

      // Full trip history
      pool.query(
        `SELECT t.id, t.pickup_location, t.dropoff_locations, t.container_type,
                t.system_estimated_price, t.agent_requested_price, t.admin_final_price,
                t.detention_penalty, t.total_amount, t.payment_type,
                t.status, t.created_at, t.completion_notes, t.not_complete_reason,
                v.plate_number, d.name AS driver_name, d.phone AS driver_phone
         FROM trips t
         LEFT JOIN vehicles v ON v.id = t.vehicle_id
         LEFT JOIN drivers d ON d.id = t.driver_id
         WHERE t.agent_id = $1 ${paymentFilter.replace('AND t.', 'AND t.')}
         ORDER BY t.created_at DESC`,
        [agentId]
      ),
    ]);

    if (!agentRow.rows.length) return res.status(404).json({ message: 'Agent not found' });

    const agent = agentRow.rows[0];
    if (agent.role === 'admin') delete agent.cnic_front_base64; // safety

    res.json({
      agent,
      stats: statsRow.rows[0],
      period_revenue: parseFloat(revenueRow.rows[0].period_revenue),
      period_trips: parseInt(revenueRow.rows[0].period_trips),
      period,
      trips: isSuperAdmin
        ? trips.rows
        : trips.rows.map((t) => { const s = { ...t }; delete s.payment_type; return s; }),
    });
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
      SELECT d.*, v.plate_number AS assigned_vehicle, d.vehicle_id
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

// DELETE /api/admin/vehicles/:id
router.delete('/vehicles/:id', ...isAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE drivers SET vehicle_id = NULL WHERE vehicle_id = $1', [req.params.id]);
    await pool.query('UPDATE trips SET vehicle_id = NULL, driver_id = NULL WHERE vehicle_id = $1', [req.params.id]);
    const { rows } = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING plate_number', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Vehicle not found' });
    res.json({ message: `Vehicle ${rows[0].plate_number} deleted` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/drivers/:id
router.delete('/drivers/:id', ...isAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE vehicles SET assigned_driver_id = NULL WHERE assigned_driver_id = $1', [req.params.id]);
    await pool.query('UPDATE trips SET driver_id = NULL WHERE driver_id = $1', [req.params.id]);
    const { rows } = await pool.query('DELETE FROM drivers WHERE id = $1 RETURNING name', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Driver not found' });
    res.json({ message: `Driver ${rows[0].name} deleted` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/vehicles/:id/history
router.get('/vehicles/:id/history', ...isAdmin, async (req, res) => {
  try {
    const vehicleRow = await pool.query(`
      SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, d.photo_base64 AS driver_photo
      FROM vehicles v LEFT JOIN drivers d ON d.id = v.assigned_driver_id
      WHERE v.id = $1
    `, [req.params.id]);
    if (!vehicleRow.rows.length) return res.status(404).json({ message: 'Vehicle not found' });

    const statsRow = await pool.query(`
      SELECT
        COUNT(*) AS total_trips,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_trips,
        COUNT(*) FILTER (WHERE status = 'approved') AS in_progress,
        COUNT(*) FILTER (WHERE status IN ('pending','quoted')) AS pending_trips,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_trips,
        COALESCE(SUM(admin_final_price + COALESCE(detention_penalty,0)) FILTER (WHERE status IN ('approved','completed')), 0) AS total_revenue
      FROM trips WHERE vehicle_id = $1
    `, [req.params.id]);

    const tripsRow = await pool.query(`
      SELECT t.*, u.name AS agent_name, u.phone AS agent_phone
      FROM trips t LEFT JOIN users u ON u.id = t.agent_id
      WHERE t.vehicle_id = $1 ORDER BY t.created_at DESC
    `, [req.params.id]);

    res.json({ vehicle: vehicleRow.rows[0], stats: statsRow.rows[0], trips: tripsRow.rows });
  } catch (err) {
    console.error(err);
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

// POST /api/admin/vehicles/:id/add-driver — link a driver to this vehicle
router.post('/vehicles/:id/add-driver', ...isAdmin, async (req, res) => {
  const { driver_id, set_primary } = req.body;
  if (!driver_id) return res.status(400).json({ message: 'driver_id required' });
  try {
    await pool.query('UPDATE drivers SET vehicle_id = $1 WHERE id = $2', [req.params.id, driver_id]);
    if (set_primary) {
      await pool.query('UPDATE vehicles SET assigned_driver_id = $1, updated_at = NOW() WHERE id = $2', [driver_id, req.params.id]);
    }
    res.json({ message: 'Driver linked to vehicle' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/vehicles/:id/remove-driver/:driverId — unlink a driver
router.delete('/vehicles/:id/remove-driver/:driverId', ...isAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE drivers SET vehicle_id = NULL WHERE id = $1 AND vehicle_id = $2', [req.params.driverId, req.params.id]);
    // If this was the primary driver, clear assigned_driver_id
    await pool.query('UPDATE vehicles SET assigned_driver_id = NULL WHERE id = $1 AND assigned_driver_id = $2', [req.params.id, req.params.driverId]);
    res.json({ message: 'Driver removed from vehicle' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/vehicles/:id — update plate, type, rate
router.put('/vehicles/:id', ...isAdmin, async (req, res) => {
  const { plate_number, container_type, rate_per_km } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE vehicles SET
         plate_number = COALESCE($1, plate_number),
         container_type = COALESCE($2, container_type),
         rate_per_km = COALESCE($3, rate_per_km),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [plate_number || null, container_type || null, rate_per_km != null ? rate_per_km : null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Vehicle not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
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
    const { rows } = await pool.query(
      `UPDATE trips
       SET admin_final_price = $1, vehicle_id = $2, driver_id = $3, payment_type = $4,
           status = 'quoted', updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [final_price, vehicle_id, driver_id, payment_type, req.params.id]
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
      await sendQuotedNotification(agentRow.rows[0].phone, agentRow.rows[0].name, route, final_price);
      await notify(trip.agent_id,
        'Admin Quoted a Price',
        `Rs. ${Number(final_price).toLocaleString()} for your trip: ${route}. Please Accept or Reject.`,
        'trip_quoted', trip.id);
    }

    res.json({ message: 'Price quoted, awaiting agent confirmation', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/trips/:id
router.delete('/trips/:id', ...isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM ledger_transactions WHERE trip_id = $1', [req.params.id]);
    await pool.query('DELETE FROM client_ledger_transactions WHERE trip_id = $1', [req.params.id]);
    await pool.query('DELETE FROM notifications WHERE trip_id = $1', [req.params.id]);
    const { rows } = await pool.query('DELETE FROM trips WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/trips/:id — edit trip fields (dynamic — only updates sent fields)
router.put('/trips/:id', ...isAdmin, async (req, res) => {
  const allowed = ['payment_type', 'admin_final_price', 'container_type', 'vehicle_id', 'driver_id',
                   'client_name', 'client_phone', 'client_id_2', 'client_name_2', 'client_phone_2',
                   'weight_ton', 'cargo_items', 'is_double'];
  try {
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in req.body) {
        setClauses.push(`${key} = $${idx++}`);
        let val = req.body[key];
        if (key === 'admin_final_price') val = val ? parseFloat(val) : null;
        else if (key === 'weight_ton') val = val ? parseFloat(val) : null;
        else if (key === 'is_double') val = Boolean(val);
        else val = val === '' ? null : (val || null);
        params.push(val);
      }
    }

    if (!setClauses.length) return res.status(400).json({ message: 'Nothing to update' });

    setClauses.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE trips SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ message: 'Trip not found' });
    res.json({ message: 'Trip updated', trip: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/trips/:id/pod — admin uploads POD document (image or PDF)
router.post('/trips/:id/pod', ...isAdmin, async (req, res) => {
  const { pod_file_base64, pod_file_type } = req.body;
  if (!pod_file_base64) return res.status(400).json({ message: 'pod_file_base64 required' });
  try {
    const tripRow = await pool.query("SELECT * FROM trips WHERE id=$1 AND status IN ('approved','completed')", [req.params.id]);
    if (!tripRow.rows.length) return res.status(404).json({ message: 'Trip not found or not approved/completed' });
    const trip = tripRow.rows[0];

    await pool.query(
      `INSERT INTO bilty_submissions (trip_id, pod_file_base64, pod_file_type)
       VALUES ($1,$2,$3)
       ON CONFLICT (trip_id) DO UPDATE SET pod_file_base64=$2, pod_file_type=$3, updated_at=NOW()`,
      [req.params.id, pod_file_base64, pod_file_type || 'image']
    );

    // Notify agent that POD has been uploaded
    if (trip.agent_id) {
      const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations||'[]');
      await notify(trip.agent_id, '✅ POD Uploaded',
        `Proof of delivery has been uploaded for your trip: ${trip.pickup_location} → ${drops.join(' → ')}`,
        'pod_uploaded', trip.id).catch(() => {});
    }

    res.json({ message: 'POD uploaded successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/admin/trips/:id/bilty
router.get('/trips/:id/bilty', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bilty_submissions WHERE trip_id=$1',
      [req.params.id]
    );
    res.json({ bilty: rows[0] || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/trips/:id/notify-bilty — remind agent to upload bilty
router.post('/trips/:id/notify-bilty', ...isAdmin, async (req, res) => {
  try {
    const tripRow = await pool.query(
      `SELECT t.*, u.id AS uid, u.name AS agent_name, u.phone AS agent_phone
       FROM trips t LEFT JOIN users u ON u.id=t.agent_id WHERE t.id=$1`,
      [req.params.id]
    );
    if (!tripRow.rows.length) return res.status(404).json({ message: 'Trip not found' });
    const trip = tripRow.rows[0];
    const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
    const route = `${trip.pickup_location} → ${drops.join(' → ')}`;
    await notify(trip.uid,
      '📄 Bilty Upload Required',
      `Please upload the bilty for your trip: ${route}`,
      'bilty_reminder', trip.id
    );
    res.json({ message: 'Notification sent to agent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/trips/:id/complete
router.post('/trips/:id/complete', ...isAdmin, async (req, res) => {
  const { notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE trips SET status = 'completed', completion_notes = $1,
       total_amount = admin_final_price + COALESCE(detention_penalty, 0),
       updated_at = NOW()
       WHERE id = $2 AND status IN ('approved', 'not_complete')
       RETURNING *`,
      [notes || null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ message: 'Trip not found or not in approved status' });

    const trip = rows[0];
    const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
    const route = `${trip.pickup_location} → ${drops.join(' → ')}`;

    const agentRow = await pool.query('SELECT phone FROM users WHERE id = $1', [trip.agent_id]);
    await notify(trip.agent_id, 'Trip Completed ✅', `Your trip has been marked as completed.${notes ? ' Note: ' + notes : ''}`, 'trip_approved', trip.id);
    if (agentRow.rows.length) {
      await sendCompletedNotification(agentRow.rows[0].phone, route, notes);
    }

    res.json({ message: 'Trip completed', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/trips/:id/not-complete
router.post('/trips/:id/not-complete', ...isAdmin, async (req, res) => {
  const { reason } = req.body;
  if (!reason?.trim()) return res.status(400).json({ message: 'Reason is required' });
  try {
    const { rows } = await pool.query(
      `UPDATE trips SET status = 'not_complete', not_complete_reason = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'approved'
       RETURNING *`,
      [reason, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ message: 'Trip not found or not in approved status' });

    const trip = rows[0];
    const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
    const route = `${trip.pickup_location} → ${drops.join(' → ')}`;

    const agentRow = await pool.query('SELECT phone FROM users WHERE id = $1', [trip.agent_id]);
    await notify(trip.agent_id, 'Trip Not Completed ❌', `Reason: ${reason}`, 'trip_rejected', trip.id);
    if (agentRow.rows.length) {
      await sendNotCompleteNotification(agentRow.rows[0].phone, route, reason);
    }

    res.json({ message: 'Trip marked as not complete', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/trips/:id/penalty
router.post('/trips/:id/penalty', ...isAdmin, async (req, res) => {
  const { penalty_amount } = req.body;
  if (!penalty_amount || isNaN(penalty_amount) || penalty_amount <= 0) {
    return res.status(400).json({ message: 'Valid penalty amount required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE trips
       SET detention_penalty = $1,
           total_amount = COALESCE(admin_final_price, 0) + $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *, agent_id`,
      [penalty_amount, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Trip not found' });

    const trip = rows[0];
    const drops = Array.isArray(trip.dropoff_locations) ? trip.dropoff_locations : JSON.parse(trip.dropoff_locations || '[]');
    const route = `${trip.pickup_location} → ${drops.join(' → ')}`;

    // In-app notification
    await notify(
      trip.agent_id,
      '⚠️ Detention Penalty Applied',
      `A detention penalty of PKR ${Number(penalty_amount).toLocaleString()} has been added to your trip.\nRoute: ${route}\nNew Total: PKR ${Number(trip.total_amount).toLocaleString()}`,
      'trip_quoted',
      trip.id
    );

    // WhatsApp to agent
    const agentRow = await pool.query('SELECT name, phone FROM users WHERE id = $1', [trip.agent_id]);
    if (agentRow.rows.length) {
      await sendPenaltyNotification(agentRow.rows[0].phone, agentRow.rows[0].name, route, penalty_amount, trip.total_amount);
    }

    // Ledger entries for penalty
    try {
      if (trip.agent_id) {
        await pool.query(
          `INSERT INTO ledger_transactions (agent_id, trip_id, transaction_type, amount, payment_method, reference_note, logged_by)
           VALUES ($1,$2,'credit',$3,'adjustment','Detention penalty',$4)`,
          [trip.agent_id, trip.id, parseFloat(penalty_amount), req.user.id]
        );
      }
      if (trip.client_id) {
        await pool.query(
          `INSERT INTO client_ledger_transactions (client_id, trip_id, transaction_type, amount, payment_mode, internal_notes, processed_by)
           VALUES ($1,$2,'invoice',$3,'adjustment','Detention penalty',$4)`,
          [trip.client_id, trip.id, parseFloat(penalty_amount), req.user.id]
        );
      }
    } catch (ledgerErr) {
      console.error('Ledger insert skipped:', ledgerErr.message);
    }

    res.json({ message: 'Penalty applied and agent notified', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Clients CRUD ─────────────────────────────────────────────────────────────

router.get('/clients', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(amount) FILTER (WHERE transaction_type IN ('invoice','adjustment'))
               - SUM(amount) FILTER (WHERE transaction_type = 'payment')
          FROM client_ledger_transactions WHERE client_id = c.id
        ), 0) AS outstanding_balance,
        (SELECT COUNT(*) FROM trips
         WHERE client_id = c.id AND status IN ('approved','pending','quoted')) AS active_trips
      FROM clients c
      ORDER BY c.name ASC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/clients', ...isAdmin, async (req, res) => {
  const { name, phone, company_name, address, notes, poc_name, poc_email, ntn_number, status } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO clients (name, phone, company_name, address, notes, poc_name, poc_email, ntn_number, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, phone || null, company_name || null, address || null, notes || null,
       poc_name || null, poc_email || null, ntn_number || null, status || 'active']
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.put('/clients/:id', ...isAdmin, async (req, res) => {
  const { name, phone, company_name, address, notes, poc_name, poc_email, ntn_number, status } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE clients SET
         name=COALESCE($1,name), phone=COALESCE($2,phone), company_name=COALESCE($3,company_name),
         address=COALESCE($4,address), notes=COALESCE($5,notes), poc_name=COALESCE($6,poc_name),
         poc_email=COALESCE($7,poc_email), ntn_number=COALESCE($8,ntn_number),
         status=COALESCE($9,status), updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name||null, phone||null, company_name||null, address||null, notes||null,
       poc_name||null, poc_email||null, ntn_number||null, status||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Client not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/clients/:id', ...isAdmin, async (req, res) => {
  try {
    const balRow = await pool.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE transaction_type IN ('invoice','adjustment')),0)
              - COALESCE(SUM(amount) FILTER (WHERE transaction_type='payment'),0) AS balance
       FROM client_ledger_transactions WHERE client_id=$1`, [req.params.id]
    );
    const balance = parseFloat(balRow.rows[0].balance);
    if (balance > 0) {
      return res.status(400).json({ message: `Cannot delete — client has outstanding balance of Rs. ${balance.toLocaleString()}. Clear dues first.` });
    }
    await pool.query('UPDATE trips SET client_id=NULL WHERE client_id=$1', [req.params.id]);
    const { rows } = await pool.query('DELETE FROM clients WHERE id=$1 RETURNING name', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: `Client "${rows[0].name}" deleted` });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ── Route Prices CRUD ─────────────────────────────────────────────────────────

router.get('/route-prices', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM route_prices ORDER BY direction ASC, from_city ASC, to_city ASC'
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.post('/route-prices', ...isAdmin, async (req, res) => {
  const { from_city, to_city, container_type, price, direction, notes } = req.body;
  if (!from_city || !to_city || !container_type || !price) {
    return res.status(400).json({ message: 'from_city, to_city, container_type, price are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO route_prices (from_city, to_city, container_type, price, direction, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (from_city, to_city, container_type)
       DO UPDATE SET price=$4, direction=$5, notes=$6, updated_at=NOW()
       RETURNING *`,
      [from_city.trim(), to_city.trim(), container_type, parseFloat(price), direction || 'from_karachi', notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error', detail: err.message }); }
});

router.put('/route-prices/:id', ...isAdmin, async (req, res) => {
  const { from_city, to_city, container_type, price, direction, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE route_prices SET from_city=COALESCE($1,from_city), to_city=COALESCE($2,to_city),
       container_type=COALESCE($3,container_type), price=COALESCE($4,price),
       direction=COALESCE($5,direction), notes=COALESCE($6,notes), updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [from_city||null, to_city||null, container_type||null, price?parseFloat(price):null, direction||null, notes||null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Route price not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/route-prices/:id', ...isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM route_prices WHERE id=$1 RETURNING from_city, to_city', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Route not found' });
    res.json({ message: `Route ${rows[0].from_city} → ${rows[0].to_city} deleted` });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
});

// ── Admin Create Trip ─────────────────────────────────────────────────────────

router.post('/trips/create', ...isAdmin, async (req, res) => {
  const { client_id, client_name, client_phone,
          client_id_2, client_name_2, client_phone_2,
          pickup_location, dropoff_locations,
          container_type, final_price, vehicle_id, payment_type,
          weight_ton, cargo_items, is_double } = req.body;

  if (!pickup_location || !dropoff_locations?.length || !container_type || !final_price || !vehicle_id || !payment_type) {
    return res.status(400).json({ message: 'pickup_location, dropoff_locations, container_type, final_price, vehicle_id, payment_type are required' });
  }

  try {
    const vRow = await pool.query('SELECT assigned_driver_id, plate_number FROM vehicles WHERE id=$1', [vehicle_id]);
    if (!vRow.rows.length) return res.status(400).json({ message: 'Vehicle not found' });
    const driver_id = vRow.rows[0].assigned_driver_id;
    if (!driver_id) return res.status(400).json({ message: 'Selected vehicle has no driver assigned.' });

    const { rows } = await pool.query(
      `INSERT INTO trips (client_id, client_name, client_phone,
        client_id_2, client_name_2, client_phone_2,
        pickup_location, dropoff_locations,
        container_type, admin_final_price, vehicle_id, driver_id, payment_type,
        weight_ton, cargo_items, is_double, status, system_estimated_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'approved',$10) RETURNING *`,
      [
        client_id || null,
        client_name || null,
        client_phone || null,
        client_id_2 || null,
        client_name_2 || null,
        client_phone_2 || null,
        pickup_location,
        JSON.stringify(dropoff_locations),
        container_type,
        parseFloat(final_price),
        vehicle_id,
        driver_id,
        payment_type,
        weight_ton || null,
        cargo_items || null,
        is_double || false,
      ]
    );
    const trip = rows[0];
    // Auto-invoice client ledger for admin-created trips
    try {
      if (trip.client_id) {
        await pool.query(
          `INSERT INTO client_ledger_transactions (client_id, trip_id, transaction_type, amount, payment_mode, internal_notes, processed_by)
           VALUES ($1,$2,'invoice',$3,$4,'Admin-created trip',$5)`,
          [trip.client_id, trip.id, parseFloat(final_price), payment_type === 'cash' ? 'cash' : 'bank_transfer', req.user.id]
        );
      }
    } catch (ledgerErr) {
      console.error('Ledger insert skipped:', ledgerErr.message);
    }
    res.status(201).json({ message: 'Trip created', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Agent Ledger ──────────────────────────────────────────────────────────────

function ledgerDateRange(query) {
  const { from, to } = query;
  const now = new Date();
  if (from && to) {
    return [new Date(from).toISOString(), new Date(new Date(to).getTime() + 86400000).toISOString()];
  }
  return [new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()];
}

// GET /api/admin/agents/:id/ledger
router.get('/agents/:id/ledger', ...isAdmin, async (req, res) => {
  const [rangeStart, rangeEnd] = ledgerDateRange(req.query);
  const agentId = req.params.id;
  try {
    const [summaryRow, txRows] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COALESCE(SUM(admin_final_price + COALESCE(detention_penalty,0)),0)
            FROM trips
            WHERE agent_id=$1 AND status IN ('approved','completed')
              AND created_at>=$2 AND created_at<$3) AS total_revenue,
           COALESCE(SUM(amount) FILTER (WHERE transaction_type='debit'),0) AS total_collected
         FROM ledger_transactions
         WHERE agent_id=$1 AND created_at>=$2 AND created_at<$3`,
        [agentId, rangeStart, rangeEnd]
      ),
      pool.query(
        `SELECT lt.id, lt.transaction_type, lt.amount, lt.payment_method, lt.reference_note,
                lt.created_at, lt.trip_id, u.name AS logged_by_name,
                t.pickup_location, t.dropoff_locations
         FROM ledger_transactions lt
         LEFT JOIN users u ON u.id=lt.logged_by
         LEFT JOIN trips t ON t.id=lt.trip_id
         WHERE lt.agent_id=$1 AND lt.created_at>=$2 AND lt.created_at<$3
         ORDER BY lt.created_at ASC`,
        [agentId, rangeStart, rangeEnd]
      ),
    ]);

    const s = summaryRow.rows[0];
    let running = 0;
    const transactions = txRows.rows.map((tx) => {
      running += tx.transaction_type === 'credit' ? parseFloat(tx.amount) : -parseFloat(tx.amount);
      return { ...tx, running_balance: running };
    }).reverse();

    res.json({
      summary: {
        total_revenue: parseFloat(s.total_revenue),
        total_collected: parseFloat(s.total_collected),
        outstanding_balance: parseFloat(s.total_revenue) - parseFloat(s.total_collected),
      },
      transactions,
      range: { from: rangeStart, to: rangeEnd },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/agents/:id/ledger-adjustment
router.post('/agents/:id/ledger-adjustment', ...isAdmin, async (req, res) => {
  const { transaction_type, amount, payment_method, reference_note } = req.body;
  if (!['credit', 'debit'].includes(transaction_type))
    return res.status(400).json({ message: 'transaction_type must be credit or debit' });
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
    return res.status(400).json({ message: 'Valid positive amount required' });
  if (!reference_note?.trim())
    return res.status(400).json({ message: 'reference_note is required for manual adjustments' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO ledger_transactions (agent_id, transaction_type, amount, payment_method, reference_note, logged_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, transaction_type, parseFloat(amount), payment_method || 'cash', reference_note.trim(), req.user.id]
    );
    res.status(201).json({ message: 'Adjustment recorded', transaction: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Client Ledger ─────────────────────────────────────────────────────────────

// GET /api/admin/clients/:id/profile
router.get('/clients/:id/profile', ...isAdmin, async (req, res) => {
  const { from, to } = req.query;
  const rangeStart = from ? new Date(from).toISOString() : '1970-01-01T00:00:00.000Z';
  const rangeEnd = to ? new Date(new Date(to).getTime() + 86400000).toISOString() : '9999-12-31T00:00:00.000Z';
  const clientId = req.params.id;
  try {
    const [clientRow, summaryRow, txRows, tripsRow] = await Promise.all([
      pool.query('SELECT * FROM clients WHERE id=$1', [clientId]),
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE transaction_type IN ('invoice','adjustment')),0) AS total_invoiced,
           COALESCE(SUM(amount) FILTER (WHERE transaction_type='payment'),0) AS total_received
         FROM client_ledger_transactions
         WHERE client_id=$1 AND created_at>=$2 AND created_at<$3`,
        [clientId, rangeStart, rangeEnd]
      ),
      pool.query(
        `SELECT clt.id, clt.transaction_type, clt.amount, clt.payment_mode, clt.reference_number,
                clt.internal_notes, clt.created_at, clt.trip_id, u.name AS processed_by_name,
                t.pickup_location, t.dropoff_locations
         FROM client_ledger_transactions clt
         LEFT JOIN users u ON u.id=clt.processed_by
         LEFT JOIN trips t ON t.id=clt.trip_id
         WHERE clt.client_id=$1 AND clt.created_at>=$2 AND clt.created_at<$3
         ORDER BY clt.created_at ASC`,
        [clientId, rangeStart, rangeEnd]
      ),
      pool.query(
        `SELECT t.*, v.plate_number, d.name AS driver_name, u.name AS agent_name
         FROM trips t
         LEFT JOIN vehicles v ON v.id=t.vehicle_id
         LEFT JOIN drivers d ON d.id=t.driver_id
         LEFT JOIN users u ON u.id=t.agent_id
         WHERE t.client_id=$1 ORDER BY t.created_at DESC`,
        [clientId]
      ),
    ]);

    if (!clientRow.rows.length) return res.status(404).json({ message: 'Client not found' });

    const s = summaryRow.rows[0];
    let running = 0;
    const transactions = txRows.rows.map((tx) => {
      const isCharge = tx.transaction_type === 'invoice' || tx.transaction_type === 'adjustment';
      running += isCharge ? parseFloat(tx.amount) : -parseFloat(tx.amount);
      return { ...tx, running_balance: running };
    }).reverse();

    res.json({
      client: clientRow.rows[0],
      summary: {
        total_invoiced: parseFloat(s.total_invoiced),
        total_received: parseFloat(s.total_received),
        outstanding_balance: parseFloat(s.total_invoiced) - parseFloat(s.total_received),
      },
      transactions,
      trips: tripsRow.rows,
      range: { from: rangeStart, to: rangeEnd },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/clients/:id/ledger-adjustment
router.post('/clients/:id/ledger-adjustment', ...isAdmin, async (req, res) => {
  const { transaction_type, amount, payment_mode, reference_number, internal_notes } = req.body;
  if (!['invoice', 'payment', 'adjustment'].includes(transaction_type))
    return res.status(400).json({ message: 'transaction_type must be invoice, payment, or adjustment' });
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
    return res.status(400).json({ message: 'Valid positive amount required' });
  if (!internal_notes?.trim())
    return res.status(400).json({ message: 'internal_notes are required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO client_ledger_transactions (client_id, transaction_type, amount, payment_mode, reference_number, internal_notes, processed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, transaction_type, parseFloat(amount), payment_mode || 'cash',
       reference_number || null, internal_notes.trim(), req.user.id]
    );
    res.status(201).json({ message: 'Transaction recorded', transaction: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/test-whatsapp — send a test message to verify template works
router.post('/test-whatsapp', ...isAdmin, async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'phone is required' });
  try {
    await sendWhatsApp(phone, [
      'Test Agent',
      'Karachi → Lahore',
      '50000',
      'TEST-1234',
      'Test Driver',
    ]);
    res.json({ message: `Test WhatsApp sent to ${phone} using template_4b1` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
