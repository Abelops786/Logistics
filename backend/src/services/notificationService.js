// Notification engine — Meta WhatsApp Cloud API v25.0 (template messages)
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

async function _sendTemplate(toPhone, templateName, params) {
  const { token, phoneId } = _getConfig();
  if (!token || !phoneId) {
    console.log('[WhatsApp Stub — set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in Railway]', toPhone, templateName);
    return;
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`;
  try {
    const res = await axios.post(url, {
      messaging_product: 'whatsapp',
      to: _cleanPhone(toPhone),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: params.length
          ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text: String(text) })) }]
          : [],
      },
    }, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    console.log('WhatsApp sent:', res.data?.messages?.[0]?.id);
  } catch (err) {
    console.error('WhatsApp send failed:', err.response?.data?.error?.message || err.message);
  }
}

// New booking → admin  OR  Trip approved → agent
async function sendWhatsApp(toPhone, variables) {
  const [agentName, route, price, plateNumber, driverName] = variables;
  const agentPhone = variables[5] || '';

  if (plateNumber && driverName && price) {
    // Trip approved → agent: {{1}}=Vehicle {{2}}=Driver {{3}}=Price {{4}}=Route
    await _sendTemplate(toPhone, 'template_4b1', [
      plateNumber, driverName, Number(price).toLocaleString(), route,
    ]);
  } else {
    // New booking → admin: {{1}}=AgentName {{2}}=Phone {{3}}=Route
    await _sendTemplate(toPhone, 'new_trip_to_admin', [agentName, agentPhone, route]);
  }
}

// Account approved → agent (no variables)
async function sendAccountApproved(toPhone) {
  await _sendTemplate(toPhone, 'template_2__abel_account_approved', []);
}

// Quoted price → agent: {{1}}=Route {{2}}=Price
async function sendQuotedNotification(toPhone, agentName, route, price) {
  await _sendTemplate(toPhone, 'template_3__abel_trip_quoted', [route, Number(price).toLocaleString()]);
}

// Detention penalty → agent: {{1}}=Route {{2}}=Penalty {{3}}=NewTotal
async function sendPenaltyNotification(toPhone, agentName, route, penaltyAmount, newTotal) {
  await _sendTemplate(toPhone, 'template_7__abel_detention_penalty', [
    route, Number(penaltyAmount).toLocaleString(), Number(newTotal).toLocaleString(),
  ]);
}

// Trip completed → agent: {{1}}=Route
async function sendCompletedNotification(toPhone, route, notes) {
  await _sendTemplate(toPhone, 'template_5__abel_trip_completed', [route]);
}

// Trip not complete → agent: {{1}}=Route {{2}}=Reason
async function sendNotCompleteNotification(toPhone, route, reason) {
  await _sendTemplate(toPhone, 'template_6__abel_trip_not_complete', [route, reason]);
}

// Agent action (accept / reject / counter) → admin: {{1}}=AgentName {{2}}=Phone {{3}}=Price {{4}}=Route
async function sendAdminAlert(agentName, action, route, price, agentPhone) {
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
  if (!adminPhone) return;
  const priceText = price ? Number(price).toLocaleString() : 'N/A';
  await _sendTemplate(adminPhone, 'template_8__abel_agent_action', [
    agentName, agentPhone || '', priceText, route,
  ]);
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

module.exports = {
  sendWhatsApp, sendAccountApproved, sendQuotedNotification, sendPenaltyNotification,
  sendCompletedNotification, sendNotCompleteNotification, sendAdminAlert, sendEmail,
};
