const express = require('express');
const pool = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/agent/ledger
router.get('/ledger', authenticate, requireRole('agent'), async (req, res) => {
  const agentId = req.user.id;
  try {
    const summary = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE agent_id = $1) AS total_requests,
         COUNT(*) FILTER (WHERE agent_id = $1 AND status = 'approved') AS approved_trips,
         COUNT(*) FILTER (WHERE agent_id = $1 AND status = 'rejected') AS rejected_trips,
         COALESCE(SUM(admin_final_price) FILTER (WHERE agent_id = $1 AND status = 'approved'), 0) AS total_revenue
       FROM trips`,
      [agentId]
    );

    const trips = await pool.query(
      `SELECT t.id, t.pickup_location, t.dropoff_locations, t.container_type,
              t.system_estimated_price, t.agent_requested_price, t.admin_final_price,
              t.status, t.created_at
       FROM trips t
       WHERE t.agent_id = $1
       ORDER BY t.created_at DESC`,
      [agentId]
    );

    res.json({
      summary: summary.rows[0],
      history: trips.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
