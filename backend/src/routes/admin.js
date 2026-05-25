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
        await sendQuotedNotification(agentRow.rows[0].phone, agentRow.rows[0].name, route, final_price);
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

    res.json({ message: 'Penalty applied and agent notified', trip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
