const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/metrics
router.get('/metrics', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const paymentFilter = isSuperAdmin ? '' : "AND t.payment_type = 'bank'";

  try {
    const totalTrips = await pool.query(
      `SELECT COUNT(*) AS count FROM trips t WHERE 1=1 ${paymentFilter}`
    );

    const topAgents = await pool.query(
      `SELECT u.id, u.name, u.phone,
              COUNT(t.id) AS trip_count,
              COALESCE(SUM(t.admin_final_price), 0) AS total_revenue
       FROM users u
       JOIN trips t ON t.agent_id = u.id
       WHERE t.status = 'approved' ${paymentFilter}
       GROUP BY u.id, u.name, u.phone
       ORDER BY total_revenue DESC
       LIMIT 5`
    );

    const topVehicles = await pool.query(
      `SELECT v.plate_number, v.container_type,
              COUNT(t.id) AS trip_count
       FROM vehicles v
       JOIN trips t ON t.vehicle_id = v.id
       WHERE t.status = 'approved' ${paymentFilter}
       GROUP BY v.id, v.plate_number, v.container_type
       ORDER BY trip_count DESC
       LIMIT 5`
    );

    const statusBreakdown = await pool.query(
      `SELECT status, COUNT(*) AS count FROM trips t WHERE 1=1 ${paymentFilter} GROUP BY status`
    );

    res.json({
      total_trips: parseInt(totalTrips.rows[0].count),
      status_breakdown: statusBreakdown.rows,
      top_agents: topAgents.rows,
      top_vehicles: topVehicles.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
