// Notification engine — Meta WhatsApp Cloud API v25.0
// Positional variables: [AgentName, Route, Price, PlateNumber, DriverName]
// Same vars map to Meta template {{1}}, {{2}}, {{3}}, {{4}}, {{5}}
const axios = require('axios');

const META_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;
const API_VERSION = 'v25.0';
const META_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

async function sendWhatsApp(toPhone, variables) {
  const [agentName, route, price, plateNumber, driverName] = variables;

  if (!META_TOKEN || !PHONE_NUMBER_ID) {
    console.log('[WhatsApp Stub]', toPhone, variables);
    return;
  }

  // Clean phone number — Meta requires international format without +
  const cleanPhone = toPhone.replace(/\D/g, '');

  let body;

  if (plateNumber && driverName && price) {
    // Trigger 2: Trip approved → agent
    body = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: {
        body: `*Abel Logistics* ✅\n\nTrip Approved!\n\n🚛 Vehicle: ${plateNumber}\n👤 Driver: ${driverName}\n💰 Final Price: PKR ${Number(price).toLocaleString()}\n\nRoute: ${route}`,
      },
    };
  } else if (route && route.includes('approved')) {
    // Account approved notification
    body = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: {
        body: `*Abel Logistics* ✅\n\nYour agent account has been approved! You can now log in and submit trip requests.`,
      },
    };
  } else {
    // Trigger 1: New booking request → admin
    body = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: {
        body: `*Abel Logistics* 🚛\n\nNew trip request from Agent *${agentName}*\n\nRoute: ${route}`,
      },
    };
  }

  try {
    const res = await axios.post(META_URL, body, {
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('WhatsApp sent:', res.data?.messages?.[0]?.id);
  } catch (err) {
    const errData = err.response?.data?.error;
    console.error('WhatsApp send failed:', errData?.message || err.message);
  }
}

// Quoted price notification (separate trigger)
async function sendQuotedNotification(toPhone, agentName, route, price) {
  if (!META_TOKEN || !PHONE_NUMBER_ID) return;
  const cleanPhone = toPhone.replace(/\D/g, '');
  try {
    await axios.post(META_URL, {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: {
        body: `*Abel Logistics* ⏳\n\nAdmin has quoted a price for your trip.\n\nRoute: ${route}\n💰 Quoted Price: PKR ${Number(price).toLocaleString()}\n\nPlease open the Abel Logistics app to Accept, Reject, or Re-Price.`,
      },
    }, {
      headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('WhatsApp quoted notification failed:', err.response?.data?.error?.message || err.message);
  }
}

async function sendEmail(to, subject, html) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.log('[Email Stub]', to, subject);
    return;
  }
  try {
    await axios.post('https://api.resend.com/emails',
      { from: process.env.EMAIL_FROM, to, subject, html },
      { headers: { Authorization: `Bearer ${RESEND_KEY}` } }
    );
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

module.exports = { sendWhatsApp, sendQuotedNotification, sendEmail };
