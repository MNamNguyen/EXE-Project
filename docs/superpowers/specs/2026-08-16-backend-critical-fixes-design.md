# Backend Critical Fixes — Batch 1 Design

## Goal

Fix the highest-severity backend defects found in the 2026-08-16 full-codebase review, with regression tests for each fix, and commit the work to a dedicated branch.

## Scope

Seven fix areas. Frontend changes are limited to what each area requires (payload conversion, one error mapping). Lower-severity findings, efficiency work, and frontend auth-flow fixes are explicitly out of scope for this batch.

| # | Area | Files |
|---|------|-------|
| 1 | Whitelist never enforced at check-in | `backend/src/controllers/checkin.controller.js`, `frontend/src/pages/scan/ScanLanding.jsx` |
| 2 | GPS integrity: NaN bypass, falsy coords, radius semantics | `checkin.controller.js`, `event.controller.js` |
| 3 | Timezone: naive `datetime-local` parsed as server-local | `frontend/src/utils/date.js` (new), `EventCreate.jsx`, `EventEditModal.jsx`, `event.controller.js` |
| 4 | Email config: provisioned SMTP_* vars unused by Brevo client | `render.yaml`, `backend/.env.example`, `email.service.js`, `auth.controller.js` |
| 5 | Missing ownership checks: QR minting + manual check-in | `event.controller.js` |
| 6 | PII exposure: attendance/members/search/export lack ownership checks | `event.controller.js`, `report.controller.js` |
| 7 | Weak temp password + no login lockout | `admin.controller.js`, `auth.controller.js`, `prisma/schema.prisma` |

## Test infrastructure (introduced first)

- Split `backend/src/app.js` (builds the Express app) from `backend/src/index.js` (listen + DB warm-up only) so the app can be mounted with supertest.
- Test runner: Node's built-in `node:test`. Add dev dependency `supertest`. `npm test` runs `node --test test/`.
- Prisma calls are stubbed with `node:test`'s `mock.method` on the shared client from `backend/src/lib/prisma.js` — no test database required.
- Tests are written red-first for each fix (TDD), then the fix, then green.
- Frontend `utils/date.js` is plain ESM with no JSX — covered by a small `node --test` file as well.

## Fix area designs

### 1. Whitelist enforcement (implements `2026-07-14-whitelist-enforcement-design.md`)

In `processCheckin`, after the event is loaded and before the time-window step: when `event.isWhitelisted` is true, look up `EventMember` by the `eventId_userId` composite unique key. If absent, return HTTP 403:

```json
{ "success": false, "error": "NOT_REGISTERED", "message": "Bạn không có trong danh sách đăng ký tham gia sự kiện này." }
```

Applies to both `checkin` and `checkout`. No fraud log, no attendance mutation. `ScanLanding.jsx` maps `NOT_REGISTERED` to the title "Chưa đăng ký tham gia"; retry stays available.

Tests: public event allows non-member; whitelisted event allows member; whitelisted event rejects non-member with 403 + `NOT_REGISTERED`; rejection applies to checkout too; rejected request performs no attendance mutation.

### 2. GPS integrity

- `processCheckin` step 4: `gps.lat`/`gps.lng` must be finite numbers within range (lat ±90, lng ±180). Missing → 400 `GPS_REQUIRED` (unchanged). Present but invalid → fraud log `GPS_INVALID` + 400. This removes the `NaN > radius` bypass.
- Distance check gate: `if (event.lat !== null && event.lng !== null)` instead of truthiness, so a geofence with coordinate 0 still runs and a null coordinate pair no longer silently disables the check.
- `createEvent`/`updateEvent`: reject with 400 when `gpsEnabled` is true and lat/lng are missing or not finite numbers (closes the "GPS event with null coords → geofence silently off" hole). Radius: parse as float when provided; reject NaN or ≤ 0 with 400; default 100 only when the field is absent.

Tests: non-numeric or string GPS rejected + fraud logged; valid finite numbers accepted; event with gpsEnabled but no coords rejected at creation; radius 0 / "abc" rejected; radius absent → 100.

### 3. Timezone-correct event windows

- New `frontend/src/utils/date.js` exporting `toLocalInput(iso)` (moved from `EventEditModal.jsx`) and `localInputToISO(value)` (`new Date(value).toISOString()` — the browser parses `datetime-local` values as local time, so the result carries the correct offset).
- `EventCreate.jsx` and `EventEditModal.jsx` convert the four datetime fields via `localInputToISO` before sending; `EventCreate` computes its default at render time in local time (replaces the module-scope UTC `today`).
- Backend `createEvent`/`updateEvent`: validate each date with `!isNaN(d.getTime())` → 400 on invalid; parse ISO-with-offset strings (correct in any server TZ; no TZ env needed).

Tests: `utils/date.js` round-trip (localInputToISO → toLocalInput is identity for a given local wall-clock value); backend rejects an invalid date string with 400.

### 4. Email config + resilient OTP send

- `render.yaml` and `backend/.env.example`: replace `SMTP_HOST/PORT/USER/PASS/FROM` with `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
- `email.service.js`: fail fast with a clear error when `BREVO_API_KEY` or `BREVO_SENDER_EMAIL` is missing.
- `auth.controller.js` login: call `emailService.sendOtpEmail(...)` (module object import so tests can stub it). On send failure: delete the just-created OTP row and return 500 with a clear Vietnamese message; no orphan OTP remains.

Tests: login with sendOtpEmail throwing → 500, OTP record deleted; login with sendOtpEmail resolving → requireOtp response as before.

### 5. QR minting + manual check-in ownership

- `getQRToken`: include `createdById` in the select; `if (req.user.role !== 'ADMIN' && event.createdById !== req.user.id)` → 403. Same pattern as `updateEvent`.
- `manualCheckin`: load the event first (`isActive: true`), apply the same ownership gate → 403.

Tests: non-owner BTC gets 403 on both endpoints; owner/ADMIN still works.

### 6. PII read endpoints gated by ownership

- `getAttendance`, `listMembers`, `searchUsersForEvent` (event.controller.js) and `exportAttendance` (report.controller.js): gate with the existing `loadEventForWrite` logic (ADMIN or `createdById === req.user.id`) → 403 otherwise.
- `getEvent`: stays open to all authenticated roles, but `lat`/`lng`/`radius` are stripped from the response unless the requester is ADMIN or the event creator (closes the coordinate-leak that assists remote GPS forgery).

Tests: non-owner BTC/LECTURER → 403 on attendance, members, search, export; getEvent strips coords for non-owners and keeps them for owner/ADMIN.

### 7. Crypto-grade temp password + login lockout

- `generateTempPassword` in `admin.controller.js`: `crypto.randomInt(100000, 1000000)` (still `Fpt@` + 6 digits).
- Schema (`prisma/schema.prisma`, model `User`): add `failedLoginAttempts Int @default(0)` and `lockedUntil DateTime?`.
- `login` in `auth.controller.js`:
  - If `user.lockedUntil` is in the future → 429 `{ success:false, error:'ACCOUNT_LOCKED', message:'Tài khoản tạm khoá do đăng nhập sai nhiều lần. Thử lại sau N phút.' }` (before password comparison; no password timing side channel).
  - Wrong password → increment `failedLoginAttempts`; at 5 → set `lockedUntil = now + 15 min` and reset the counter.
  - Successful login → reset counter and `lockedUntil`.
  - Lock check happens after the user lookup so unknown identifiers keep the same response path.

Tests: 5 failed attempts locks the account (6th attempt with the correct password → 429); success before threshold resets counter; expired lock allows login again.

## Deployment notes (after merge)

- `npx prisma db push` — two new `User` columns.
- Set `BREVO_API_KEY` + `BREVO_SENDER_EMAIL` in Render env; delete stale `SMTP_*` vars.
- Rebuild frontend (timezone payloads + `NOT_REGISTERED` mapping).

## Git workflow

Branch `fix/backend-critical-batch-1` off `main`. One commit per fix area (test + fix together), pushed to origin. Spec committed first as `docs:`.
