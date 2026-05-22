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

// GET /api/dashboard/reports?month=YYYY-MM
router.get('/reports', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  const isSuperAdmin = req.user.role === 'super_admin';
  const paymentFilter = isSuperAdmin ? '' : "AND payment_type = 'bank'";
  const approvedCond = isSuperAdmin
    ? "status IN ('approved','completed')"
    : "status IN ('approved','completed') AND payment_type = 'bank'";

  // Accept ?month=2026-05 or default to current month
  const monthParam = req.query.month;
  let targetDate;
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    targetDate = new Date(`${monthParam}-01`);
  } else {
    targetDate = new Date();
    targetDate.setDate(1);
  }
  const thisMonthStart = targetDate.toISOString().slice(0, 10);
  const nextMonthStart = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1).toISOString().slice(0, 10);

  try {
    const [thisMonth, lastMonth, byAgent, byContainer, tripsList, allMonths] = await Promise.all([

      // This month income + trip count
      pool.query(`
        SELECT
          COALESCE(SUM(admin_final_price), 0) AS revenue,
          COUNT(*) AS trips
        FROM trips
        WHERE ${approvedCond}
          AND created_at >= $1 AND created_at < $2
      `, [thisMonthStart, nextMonthStart]),

      // Last month income + trip count
      pool.query(`
        SELECT
          COALESCE(SUM(admin_final_price), 0) AS revenue,
          COUNT(*) AS trips
        FROM trips
        WHERE ${approvedCond}
          AND created_at >= $1 AND created_at < $2
      `, [lastMonthStart, thisMonthStart]),

      // Income by agent this month
      pool.query(`
        SELECT u.name, u.phone,
               COUNT(t.id) AS trips,
               COALESCE(SUM(t.admin_final_price), 0) AS revenue
        FROM trips t
        JOIN users u ON u.id = t.agent_id
        WHERE ${approvedCond.replace(/\b(status|payment_type)\b/g, 't.$1')}
          AND t.created_at >= $1 AND t.created_at < $2
        GROUP BY u.id, u.name, u.phone
        ORDER BY revenue DESC
      `, [thisMonthStart, nextMonthStart]),

      // Income by container type this month
      pool.query(`
        SELECT container_type,
               COUNT(*) AS trips,
               COALESCE(SUM(admin_final_price), 0) AS revenue
        FROM trips
        WHERE ${approvedCond}
          AND created_at >= $1 AND created_at < $2
        GROUP BY container_type
      `, [thisMonthStart, nextMonthStart]),

      // All trips this month (full details)
      pool.query(`
        SELECT t.id, t.pickup_location, t.dropoff_locations,
               t.container_type, t.admin_final_price, t.status,
               t.created_at, u.name AS agent_name, u.phone AS agent_phone,
               v.plate_number, d.name AS driver_name
        FROM trips t
        LEFT JOIN users u ON u.id = t.agent_id
        LEFT JOIN vehicles v ON v.id = t.vehicle_id
        LEFT JOIN drivers d ON d.id = t.driver_id
        WHERE 1=1 ${paymentFilter.replace('AND payment_type', 'AND t.payment_type')}
          AND t.created_at >= $1 AND t.created_at < $2
        ORDER BY t.created_at DESC
      `, [thisMonthStart, nextMonthStart]),

      // All months available (for month picker)
      pool.query(`
        SELECT DISTINCT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month
        FROM trips
        ORDER BY month DESC
        LIMIT 24
      `),
    ]);

    const thisRev = parseFloat(thisMonth.rows[0].revenue);
    const lastRev = parseFloat(lastMonth.rows[0].revenue);
    const growth = lastRev > 0 ? ((thisRev - lastRev) / lastRev * 100).toFixed(1) : null;

    res.json({
      selected_month: monthParam || new Date().toISOString().slice(0, 7),
      this_month: { revenue: thisRev, trips: parseInt(thisMonth.rows[0].trips) },
      last_month: { revenue: lastRev, trips: parseInt(lastMonth.rows[0].trips) },
      growth_pct: growth,
      by_agent: byAgent.rows,
      by_container: byContainer.rows,
      trips: tripsList.rows,
      available_months: allMonths.rows.map((r) => r.month),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
