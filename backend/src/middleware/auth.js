const jwt = require('jsonwebtoken');
const pool = require('../config/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query('SELECT id, name, phone, role, status FROM users WHERE id = $1', [decoded.id]);
    if (!rows.length) return res.status(401).json({ message: 'User not found' });
    if (rows[0].status !== 'active') return res.status(403).json({ message: 'Account not active' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
