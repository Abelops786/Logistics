require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const tripsRoutes = require('./routes/trips');
const agentRoutes = require('./routes/agent');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const webhookRoutes = require('./routes/webhook');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' })); // 20mb for base64 images (CNIC + driver photos)

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/webhook', webhookRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// WhatsApp connection test — hit this URL to send a test message to ADMIN_WHATSAPP_NUMBER
app.get('/test-whatsapp', async (req, res) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;

  if (!token || !phoneId || !adminPhone) {
    return res.json({ ok: false, reason: 'Missing env vars', token: !!token, phoneId: !!phoneId, adminPhone: !!adminPhone });
  }

  const digits = adminPhone.replace(/\D/g, '');
  const to = digits.startsWith('0') ? '92' + digits.slice(1) : digits;

  try {
    const axios = require('axios');
    const result = await axios.post(
      `https://graph.facebook.com/v25.0/${phoneId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: `Abel Logistics ✅ WhatsApp test message. Connection is working!` },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
    res.json({ ok: true, messageId: result.data?.messages?.[0]?.id });
  } catch (err) {
    res.json({ ok: false, error: err.response?.data?.error || err.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Abel Dispatch API running on port ${PORT}`));

module.exports = app;
