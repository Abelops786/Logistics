# Abel Dispatch MVP

3 components:
- `backend/` — Node.js + Express + PostgreSQL API
- `dashboard/` — Next.js admin panel
- `mobile/` — Flutter agent app

---

## 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, WhatsApp/Email keys

# Create DB in PostgreSQL, then run migration:
node src/migrations/run.js

# Start dev server:
npm run dev
# Runs on http://localhost:5000
```

Default super admin login: phone `923001234567`, password `password` (update after first login)

---

## 2. Dashboard Setup

```bash
cd dashboard
npm install
# Edit .env.local if backend is not on localhost:5000

npm run dev
# Opens on http://localhost:3000
```

---

## 3. Mobile App Setup

```bash
cd mobile
flutter pub get
# Edit lib/services/api_service.dart:
#   Android emulator → http://10.0.2.2:5000
#   Physical device  → http://YOUR_PC_IP:5000
#   iOS simulator    → http://localhost:5000

flutter run
```

---

## API Quick Reference

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| POST | /api/trips/estimate | Agent |
| POST | /api/trips/request | Agent |
| GET  | /api/agent/ledger | Agent |
| GET  | /api/admin/agents/pending | Admin |
| POST | /api/admin/agents/:id/approve | Admin |
| PUT  | /api/admin/pricing | Admin |
| GET  | /api/admin/trips | Admin |
| POST | /api/admin/trips/:id/assign | Admin |
| GET  | /api/dashboard/metrics | Admin |

---

## Tax Audit Rule
- `super_admin` → sees all trips (cash + bank)
- `admin` → sees **bank only** trips. `payment_type` field is stripped from response payload.
- Enforced at backend query level, not frontend.
