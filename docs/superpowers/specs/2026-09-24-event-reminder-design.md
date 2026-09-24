# Event Reminder Design

## Goal

BTC can email everyone registered for an event a reminder that it is about to start, with an
optional short note. Sending is **manual only** — a "Gửi nhắc ngay" button on the event page.

An automatic, scheduled version (1 day / 3 h / 1 h before, triggered by GitHub Actions because
Render's free tier sleeps) was built and then dropped at the product owner's request. Do not
reintroduce an in-process timer: the server sleeps when idle and would silently miss sends.

## Data model

`EventReminder` — one row per send: `status` SENDING|SENT|FAILED, `recipientCount`, `failedCount`,
`note?`, `triggeredById?`, `createdAt`, `completedAt`. Cascade-deleted with the event; the sender
is `SetNull` on account deletion. It is the history shown to BTC and the basis of the cooldown.

## Rules

- Recipients: `EventMember` rows whose user is active and has not checked in. One email per person
  (never a shared To list), sent 8 at a time.
- The email says how far away the event is at send time (`leadText`: "sẽ diễn ra vào ngày mai",
  "sẽ bắt đầu sau 3 giờ nữa", "đang diễn ra"), dates computed in Vietnam time.
- 30-minute cooldown per event (`429 REMINDER_COOLDOWN`), `400 NO_RECIPIENTS` when nobody is
  left, note ≤ 500 chars (HTML-escaped in the email).
- The endpoint answers `202` after writing the log row and sends in the background: a list of a few
  hundred takes longer than the frontend's 25 s timeout, and `api.js` would retry the request.
- Brevo free tier is ~300 emails/day for the whole system; the UI warns above 250 recipients.

## API (ADMIN/BTC, event owner via `loadEventForWrite`)

- `GET /api/events/:id/reminders` — recipient count, last 30 log rows, `cooldownUntil`.
- `POST /api/events/:id/reminders/send` `{ note? }` → `202 { recipientCount }`.

## Frontend

`pages/btc/EventReminderPanel.jsx` in `EventDetail`: recipient count, send button + modal (note,
quota warning), collapsible send log that polls while a send is in progress.
