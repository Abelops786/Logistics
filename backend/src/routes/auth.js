const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('cnic').notEmpty().withMessage('CNIC is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, cnic, password, region, cnic_front_base64, cnic_back_base64 } = req.body;

    try {
      const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (existing.rows.length) {
        return res.status(409).json({ message: 'Phone number already registered' });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const { rows } = await pool.query(
        `INSERT INTO users (name, cnic, phone, password_hash, role, status, region, cnic_front_base64, cnic_back_base64)
         VALUES ($1, $2, $3, $4, 'agent', 'pending', $5, $6, $7)
         RETURNING id, name, phone, status`,
        [name, cnic, phone, password_hash, region || null, cnic_front_base64 || null, cnic_back_base64 || null]
      );

      res.status(201).json({ message: 'Registration successful. Awaiting admin approval.', user: rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('phone').notEmpty(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { phone, password } = req.body;

    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
      if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

      if (user.status === 'pending') {
        return res.status(403).json({ status: 'pending', message: 'Your profile is under review by Admin. You will receive a WhatsApp notification once approved.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ status: 'suspended', message: 'Your account has been suspended. Contact support.' });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.json({
        token,
        user: { id: user.id, name: user.name, phone: user.phone, role: user.role, status: user.status },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
