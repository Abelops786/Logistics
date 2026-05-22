const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/metrics
router.get('/metrics', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const paymentFilter = isSuperAdmin ? '' : "AND t.payment_type = 'bank'";
  const approvedFilter = isSuperAdmin ? "status IN ('approved','completed')" : "status IN ('approved','completed') AND payment_type = 'bank'";

  try {
    const [
      totalTrips,
      totalRevenue,
      statusBreakdown,
      topAgents,
      topVehicles,
      monthlyRevenue,
      containerBreakdown,
      dailyTrips,
      agentCount,
    ] = await Promise.all([

      pool.query(`SELECT COUNT(*) AS count FROM trips t WHERE 1=1 ${paymentFilter}`),

      pool.query(`SELECT COALESCE(SUM(admin_final_price), 0) AS total FROM trips WHERE ${approvedFilter}`),

      pool.query(`SELECT status, COUNT(*) AS count FROM trips t WHERE 1=1 ${paymentFilter} GROUP BY status`),

      pool.query(`
        SELECT u.id, u.name, u.phone,
               COUNT(t.id) AS trip_count,
               COALESCE(SUM(t.admin_final_price), 0) AS total_revenue
        FROM users u
        JOIN trips t ON t.agent_id = u.id
        WHERE t.status IN ('approved','completed') ${paymentFilter}
        GROUP BY u.id, u.name, u.phone
        ORDER BY total_revenue DESC
        LIMIT 5
      `),

      pool.query(`
        SELECT v.plate_number, v.container_type, COUNT(t.id) AS trip_count
        FROM vehicles v
        JOIN trips t ON t.vehicle_id = v.id
        WHERE t.status IN ('approved','completed') ${paymentFilter}
        GROUP BY v.id, v.plate_number, v.container_type
        ORDER BY trip_count DESC
        LIMIT 5
      `),

      // Monthly revenue — last 6 months
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
          DATE_TRUNC('month', created_at) AS month_date,
          COALESCE(SUM(admin_final_price), 0) AS revenue,
          COUNT(*) AS trips
        FROM trips
        WHERE ${approvedFilter}
          AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month_date ASC
      `),

      // Container type revenue split
      pool.query(`
        SELECT container_type,
               COUNT(*) AS trip_count,
               COALESCE(SUM(admin_final_price), 0) AS revenue
        FROM trips
        WHERE ${approvedFilter}
        GROUP BY container_type
      `),

      // Daily trips — last 30 days
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'DD Mon') AS day,
          DATE_TRUNC('day', created_at) AS day_date,
          COUNT(*) AS trips
        FROM trips t
        WHERE 1=1 ${paymentFilter}
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day_date ASC
      `),

      pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'agent' AND status = 'active'"),
    ]);

    res.json({
      total_trips: parseInt(totalTrips.rows[0].count),
      total_revenue: parseFloat(totalRevenue.rows[0].total),
      active_agents: parseInt(agentCount.rows[0].count),
      status_breakdown: statusBreakdown.rows,
      top_agents: topAgents.rows,
      top_vehicles: topVehicles.rows,
      monthly_revenue: monthlyRevenue.rows,
      container_breakdown: containerBreakdown.rows,
      daily_trips: dailyTrips.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
