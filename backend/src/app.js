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

// WhatsApp template test — fires all 8 templates to ADMIN_WHATSAPP_NUMBER
app.get('/test-whatsapp', async (req, res) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;

  if (!token || !phoneId || !adminPhone) {
    return res.json({ ok: false, reason: 'Missing env vars', token: !!token, phoneId: !!phoneId, adminPhone: !!adminPhone });
  }

  const axios = require('axios');
  const digits = adminPhone.replace(/\D/g, '');
  const to = digits.startsWith('0') ? '92' + digits.slice(1) : digits;

  async function send(name, params) {
    try {
      const r = await axios.post(
        `https://graph.facebook.com/v25.0/${phoneId}/messages`,
        {
          messaging_product: 'whatsapp', to,
          type: 'template',
          template: {
            name,
            language: { code: 'en' },
            components: params.length ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] : [],
          },
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      return { ok: true, id: r.data?.messages?.[0]?.id };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error?.message || err.message };
    }
  }

  const results = await Promise.all([
    send('new_trip_to_admin',                  ['Asher Sajjad', '03145686872', 'Karachi to Lahore']).then(r => ({ template: 'new_trip_to_admin', ...r })),
    send('template_2__abel_account_approved',  []).then(r => ({ template: 'template_2__abel_account_approved', ...r })),
    send('template_3__abel_trip_quoted',        ['Karachi to Lahore', '45,000']).then(r => ({ template: 'template_3__abel_trip_quoted', ...r })),
    send('template_4__abel_trip_approved',      ['ABC-1234', 'Muhammad Usman', '45,000', 'Karachi to Lahore']).then(r => ({ template: 'template_4__abel_trip_approved', ...r })),
    send('template_5__abel_trip_completed',     ['Karachi to Lahore']).then(r => ({ template: 'template_5__abel_trip_completed', ...r })),
    send('template_6__abel_trip_not_complete',  ['Karachi to Lahore', 'Vehicle broke down']).then(r => ({ template: 'template_6__abel_trip_not_complete', ...r })),
    send('template_7__abel_detention_penalty',  ['Karachi to Lahore', '5,000', '50,000']).then(r => ({ template: 'template_7__abel_detention_penalty', ...r })),
    send('template_8__abel_agent_action',       ['Asher Sajjad', '03145686872', '45,000', 'Karachi to Lahore']).then(r => ({ template: 'template_8__abel_agent_action', ...r })),
  ]);

  res.json({ results });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Abel Dispatch API running on port ${PORT}`));

module.exports = app;
