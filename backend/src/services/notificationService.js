// Notification engine — Meta WhatsApp Cloud API v25.0
const axios = require('axios');

const API_VERSION = 'v25.0';

function _getConfig() {
  return {
    token: process.env.WHATSAPP_TOKEN,
    phoneId: process.env.WHATSAPP_PHONE_ID,
  };
}

// Pakistani numbers: 03001234567 → 923001234567, already 92xxx kept as-is
function _cleanPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '92' + digits.slice(1);
  return digits;
}

async function _send(toPhone, messageBody) {
  const { token, phoneId } = _getConfig();
  if (!token || !phoneId) {
    console.log('[WhatsApp Stub — set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in Railway]', toPhone);
    return;
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`;
  try {
    const res = await axios.post(url, {
      messaging_product: 'whatsapp',
      to: _cleanPhone(toPhone),
      type: 'text',
      text: { body: messageBody },
    }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    console.log('WhatsApp sent:', res.data?.messages?.[0]?.id);
  } catch (err) {
    console.error('WhatsApp send failed:', err.response?.data?.error?.message || err.message);
  }
}

// New booking request → admin
async function sendWhatsApp(toPhone, variables) {
  const [agentName, route, price, plateNumber, driverName] = variables;

  let text;
  if (plateNumber && driverName && price) {
    // Trip approved → agent
    text = `*Abel Logistics* ✅\n\nTrip Approved!\n\n🚛 Vehicle: ${plateNumber}\n👤 Driver: ${driverName}\n💰 Final Price: PKR ${Number(price).toLocaleString()}\n\nRoute: ${route}`;
  } else if (!price && !plateNumber) {
    // Account approved → agent (route contains a descriptive message here)
    text = `*Abel Logistics* ✅\n\nYour agent account has been approved! You can now log in and submit trip requests.`;
  } else {
    // New booking → admin
    text = `*Abel Logistics* 🚛\n\nNew trip request from Agent *${agentName}*\n\nRoute: ${route}`;
  }

  await _send(toPhone, text);
}

// Quoted price → agent
async function sendQuotedNotification(toPhone, agentName, route, price) {
  await _send(toPhone,
    `*Abel Logistics* ⏳\n\nAdmin has quoted a price for your trip.\n\nRoute: ${route}\n💰 Quoted Price: PKR ${Number(price).toLocaleString()}\n\nPlease open the app to Accept, Reject, or Re-Price.`
  );
}

// Detention penalty → agent
async function sendPenaltyNotification(toPhone, agentName, route, penaltyAmount, newTotal) {
  await _send(toPhone,
    `*Abel Logistics* ⚠️\n\nA detention penalty has been added to your trip.\n\nRoute: ${route}\n⚠️ Penalty: PKR ${Number(penaltyAmount).toLocaleString()}\n💰 New Total: PKR ${Number(newTotal).toLocaleString()}`
  );
}

// Trip completed → agent
async function sendCompletedNotification(toPhone, route, notes) {
  await _send(toPhone,
    `*Abel Logistics* ✅\n\nYour trip has been marked as Completed!\n\nRoute: ${route}${notes ? `\n📝 Note: ${notes}` : ''}`
  );
}

// Trip not complete → agent
async function sendNotCompleteNotification(toPhone, route, reason) {
  await _send(toPhone,
    `*Abel Logistics* ❌\n\nYour trip has been marked as Not Completed.\n\nRoute: ${route}\n📋 Reason: ${reason}`
  );
}

// Agent action (accept / reject / counter) → admin
async function sendAdminAlert(agentName, action, route, price) {
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
  if (!adminPhone) return;
  const actionText = {
    accept: `✅ *${agentName}* accepted the quoted price of PKR ${Number(price).toLocaleString()}`,
    reject: `❌ *${agentName}* rejected the quoted price`,
    counter: `🔄 *${agentName}* sent a counter price of PKR ${Number(price).toLocaleString()}`,
  }[action] || `*${agentName}* updated a trip`;
  await _send(adminPhone,
    `*Abel Logistics* 🔔\n\n${actionText}\n\nRoute: ${route}\n\nPlease open the dashboard.`
  );
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

module.exports = { sendWhatsApp, sendQuotedNotification, sendPenaltyNotification, sendCompletedNotification, sendNotCompleteNotification, sendAdminAlert, sendEmail };
