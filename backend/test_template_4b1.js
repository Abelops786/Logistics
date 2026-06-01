// ============================================================
//  TEST SCRIPT — template_4b1 (Trip Approved)
//  Run: node test_template_4b1.js
// ============================================================

const axios = require('axios');

// ── FILL THESE IN ──────────────────────────────────────────
const WHATSAPP_TOKEN   = 'PASTE_YOUR_TOKEN_HERE';       // Meta permanent token
const WHATSAPP_PHONE_ID = '1204077672778109';           // Your Phone Number ID
const TEST_PHONE        = 'PASTE_RECIPIENT_NUMBER';     // e.g. 923001234567
// ───────────────────────────────────────────────────────────

// Sample values matching template_4b1 variables
const plateNumber = 'AAAA-1234';
const driverName  = 'Muhammad Ahmed';
const price       = 'PKR 45,000';
const route       = 'Karachi → Lahore';

async function sendTest() {
  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: TEST_PHONE,
    type: 'template',
    template: {
      name: 'template_4b1',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: plateNumber },
            { type: 'text', text: driverName  },
            { type: 'text', text: price       },
            { type: 'text', text: route       },
          ],
        },
      ],
    },
  };

  console.log('\n📤 Sending test message to:', TEST_PHONE);
  console.log('   Template : template_4b1');
  console.log('   Vehicle  :', plateNumber);
  console.log('   Driver   :', driverName);
  console.log('   Price    :', price);
  console.log('   Route    :', route);
  console.log('');

  try {
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ SUCCESS! Message ID:', res.data?.messages?.[0]?.id);
    console.log('   Full response:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('❌ FAILED!');
    console.error('   Error:', err.response?.data?.error?.message || err.message);
    console.error('   Details:', JSON.stringify(err.response?.data, null, 2));
  }
}

sendTest();
