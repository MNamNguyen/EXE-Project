# Event Feedback Design

## Goal

After an event, attendees fill in a feedback form. Managers (ADMIN, BTC) build reusable form
templates with two question types — free text and a 1–5 star rating — attach one to an event,
open/close it by hand, and read aggregated results.

## Decisions (confirmed with the product owner)

| Topic | Decision |
|---|---|
| Who builds templates | ADMIN **and** BTC, one shared template library |
| Who may answer | Only attendees whose `Attendance.status` is `CHECKED_OUT` |
| Anonymity | Per form (`isAnonymous`). The server always stores `userId` (one answer per person), but when the form is anonymous no API returns who wrote what |
| When it is open | Manual toggle only (`isOpen`), no schedule |

## Data model

Three new tables, all prefixed `attendance_`:

- `FeedbackTemplate` — `name`, `description?`, `questions` (JSON), `createdById?`.
- `EventFeedbackForm` — one per event (`eventId @unique`), holding a **snapshot** of the questions
  copied from a template (or typed directly). `templateId?` is informational only.
  `isAnonymous`, `isOpen` (default `false`).
- `FeedbackResponse` — `formId`, `userId?`, `answers` (JSON: `{ [questionId]: string | 1..5 }`),
  `@@unique([formId, userId])`.

Question shape (same in templates and forms):

```json
{ "id": "q_ab12cd", "type": "TEXT" | "RATING", "label": "…", "required": true }
```

Why a snapshot instead of a live template reference: editing a template later must not change the
questions under answers that were already given. Why JSON instead of question/answer rows: a form is
always read and written whole, results are aggregated in JS per event (tens to a few thousand
answers), and the snapshot semantics fall out naturally.

Referential actions:
- Event → form → responses: `Cascade` (events are soft-deleted anyway).
- Template deleted → `form.templateId` `SetNull`; the form keeps its snapshot.
- User deleted → `response.userId` and `template.createdById` `SetNull`, so results and the
  shared library survive account deletion and `deleteUser` needs no change.

## Integrity rules

- A form's questions cannot be changed or the form removed once it has at least one response
  (`409 FEEDBACK_HAS_RESPONSES`). Closing it is always allowed.
- `isAnonymous` can go `false → true` at any time but not `true → false` once responses exist
  (`409 FEEDBACK_ANONYMITY_LOCKED`) — people answered on the promise of anonymity.
- A respondent may edit their own answer while the form is open (upsert).
- Validation lives in `lib/feedbackForm.js`: 1–30 questions, label 1–500 chars, rating is an
  integer 1–5, text ≤ 2000 chars, required questions must be answered, unknown keys dropped.

## API (`/api/feedback`, all authenticated)

Templates — `ADMIN`, `BTC`; edit/delete by ADMIN or the creator:
- `GET /templates`, `POST /templates`, `GET /templates/:id`, `PUT /templates/:id`, `DELETE /templates/:id`

Event form — organizer, through `loadEventForWrite` (ADMIN or event creator):
- `GET /events/:id/form` (ADMIN, BTC, LECTURER) → `{ form | null, responseCount, eligibleCount }`
- `PUT /events/:id/form` (ADMIN, BTC) — `{ templateId }` or `{ title, description, questions }`, plus `isAnonymous`
- `PATCH /events/:id/form` (ADMIN, BTC) — `{ isOpen?, isAnonymous? }`
- `DELETE /events/:id/form` (ADMIN, BTC)
- `GET /events/:id/results` (ADMIN, BTC, LECTURER) — per rating question: count, average,
  distribution 1–5; per text question: the answers (with name/MSSV only if not anonymous)

Respondent — any role:
- `GET /events/:id/response` → form, own answers, `canSubmit` + `reason`
- `POST /events/:id/response` — checks in order: event → form (`404 FEEDBACK_NOT_FOUND`) → open
  (`403 FEEDBACK_CLOSED`) → checked out (`403 FEEDBACK_NOT_ELIGIBLE`) → answers
  (`400 INVALID_ANSWERS`) → upsert.

`GET /api/events` for STUDENT additionally returns `feedback: { isOpen, submitted } | null` per event
so "Lịch sử tham dự" can show the "Đánh giá" button without N extra requests.

## Prompt right after checkout

A successful QR checkout response carries `feedback: { isOpen: true, submitted }` when the event's
form is open (`lib/feedbackForm.js#feedbackPromptFor`, best-effort — a lookup failure never breaks
the already-recorded checkout). `ALREADY_CHECKED_OUT` carries it too, so a student who closed the
tab can re-scan and still get the form. `ScanLanding` renders the shared `FeedbackResponseForm`
under the result card when `submitted` is false and scrolls to it after the success animation.
Manual checkout by BTC has no scan page, so those attendees use "Lịch sử tham dự" instead.

## Frontend

- `pages/feedback/FeedbackTemplates.jsx` (`/feedback-templates`, ADMIN/BTC, sidebar "Mẫu đánh giá")
  with a question builder shared with the event form editor (`QuestionListEditor.jsx`).
- `pages/btc/EventFeedbackPanel.jsx` in `EventDetail`: attach template / write custom, open/close,
  anonymous toggle, response count, results modal (`FeedbackResultsModal.jsx`).
- `pages/student/EventFeedback.jsx` (`/feedback/:eventId`): star inputs + text areas.
- `MyAttendance.jsx`: "Đánh giá" / "Sửa đánh giá" button when the form is open and the student
  checked out.

## Out of scope

Email/push notification when a form opens, Excel export of results, scheduled open/close.

## Testing

`test/feedback.test.js` (Prisma stubbed, as elsewhere): validation helpers; template ownership;
attach from template copies a snapshot; question edit blocked with responses; anonymity lock;
respondent rejected when closed / not checked out / invalid answers; happy-path upsert; results
hide identities for anonymous forms and aggregate ratings correctly.
