// Notification engine — interface layer.
// Variables stored as positional array for Meta Cloud API future swap.
// Currently mapped to Whapi.cloud/Green API payload.
const axios = require('axios');

const GATEWAY_URL = process.env.WHATSAPP_GATEWAY_URL;
const TOKEN = process.env.WHATSAPP_TOKEN;

async function sendWhatsApp(toPhone, variables) {
  // variables: [AgentName, Route, Price, PlateNumber, DriverName]
  // Compose message from positional params so it's trivial to swap to Meta template {{1}},{{2}}...
  const [agentName, route, price, plateNumber, driverName] = variables;

  let message;
  if (plateNumber && driverName) {
    // Trigger 2: Trip approval → agent
    message = `*Abel Logistics*\nTrip Approved!\nVehicle: ${plateNumber}\nDriver: ${driverName}\nFinal Price: PKR ${price}`;
  } else if (route && route.includes('approved')) {
    // Agent account approved
    message = `*Abel Logistics*\n${route}`;
  } else {
    // Trigger 1: New booking → admin
    message = `*Abel Logistics*\nNew trip request from Agent *${agentName}*.\nRoute: ${route}`;
  }

  if (!GATEWAY_URL || !TOKEN) {
    console.log('[WhatsApp Stub]', toPhone, message);
    return;
  }

  try {
    await axios.post(
      `${GATEWAY_URL}/messages`,
      { to: toPhone, body: message },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
  } catch (err) {
    console.error('WhatsApp send failed:', err.message);
  }
}

async function sendEmail(to, subject, html) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.log('[Email Stub]', to, subject);
    return;
  }
  try {
    await axios.post(
      'https://api.resend.com/emails',
      { from: process.env.EMAIL_FROM, to, subject, html },
      { headers: { Authorization: `Bearer ${RESEND_KEY}` } }
    );
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

module.exports = { sendWhatsApp, sendEmail };
