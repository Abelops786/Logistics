const express = require('express');
const router = express.Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'abel_logistics_verify_2024';

// GET /api/webhook/whatsapp — Meta verification handshake
router.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// POST /api/webhook/whatsapp — incoming messages & delivery status
router.post('/whatsapp', (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    body.entry?.forEach((entry) => {
      entry.changes?.forEach((change) => {
        const value = change.value;

        // Delivery status updates
        value.statuses?.forEach((status) => {
          console.log(`Message ${status.id} status: ${status.status} → ${status.recipient_id}`);
        });

        // Incoming messages from agents/clients
        value.messages?.forEach((msg) => {
          console.log(`Incoming WhatsApp from ${msg.from}: ${msg.text?.body || '[media]'}`);
        });
      });
    });
  }

  res.sendStatus(200);
});

module.exports = router;
