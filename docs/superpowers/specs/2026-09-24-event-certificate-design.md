# Event Certificate Design

## Goal

After an event, BTC can issue attendees a certificate of participation built from a template
image they upload; attendees view it on the web, download it (PDF or PNG) and get an email when
it is ready. **Optional per event** — an event without an uploaded template has no certificates.

## Decisions (confirmed with the product owner)

| Topic | Decision |
|---|---|
| Eligibility | `Attendance.status = CHECKED_OUT`, account active |
| When | BTC clicks "Cấp chứng nhận"; re-clicking issues only to newly eligible people and retries failed emails |
| Template | Uploaded **per event** (no shared library) |
| Public verification page | No — only the owner (plus ADMIN / the event creator) can open a certificate |

## Template

- PNG/JPG, ≤ 5 MB, each side ≥ 500 px, validated by magic bytes and by actually decoding it with
  pdf-lib (not by the browser's mimetype).
- Stored as `BYTEA` in `EventCertificateTemplate` because Render's disk is wiped on each deploy
  and the project has no object storage. Replacing the image keeps the existing layout.
- Four fields: `name`, `event`, `date`, `code`. `name` is always enabled. Each has
  `x`, `y`, `size`, `maxWidth` (fractions of the image), `font`, `color`, `align`.
- Coordinates: `x` is the anchor for `align`, `y` is the **baseline** from the top, `size` =
  font size as a fraction of image width, text wider than `maxWidth` shrinks to fit.

## One layout, two renderers

- **PDF** (download): `services/certificatePdf.js`, pdf-lib + fontkit, page long side = 842 pt
  (A4) keeping the image's aspect ratio, Vietnamese fonts embedded as subsets, text stays
  selectable.
- **Canvas** (in-app view, PNG download, editor preview): `frontend/src/pages/certificates/certRender.js`
  because mobile browsers can't display an embedded PDF.
- Both follow `lib/certificateLayout.js#layoutField` and use the **same TTF files**
  (`backend/assets/fonts` = `frontend/public/fonts/cert`, SIL OFL). Changing one side requires
  changing the other. Values (name, event, `Ngày dd/MM/yyyy` in VN time, `Mã chứng nhận: CN-XXXX-XXXX`)
  are computed by the server (`certificateValues`) and sent to the client so both print the same strings.
- PDFs are rendered on demand, never stored. Editing the template or layout therefore also
  changes already-issued certificates (the UI warns); the recipient name is snapshotted at issue.

## Issuing and email

- `POST /api/events/:id/certificates/issue` creates `Certificate` rows (`createMany skipDuplicates`,
  unique `eventId+userId`, random `code` without 0/O/1/I), answers `202`, then emails in the
  background (8 at a time). Each certificate is claimed `PENDING|FAILED → SENDING` with
  `updateMany` before sending, so two clicks never email someone twice.
- The email links to `/my-certificates` and does not attach the PDF (hundreds of attachments get
  throttled; the certificate is always available on the web). Brevo free tier ≈ 300 emails/day:
  the UI warns above 250.
- Revoke = delete the row; if still eligible, the next issue creates a new certificate with a new code.
- A template cannot be removed once certificates exist (`409 CERTIFICATES_ISSUED`).

## API

BTC (ADMIN/BTC + `loadEventForWrite`): `GET /api/events/:id/certificate`, `GET|PUT …/certificate/image`,
`PUT …/certificate/fields`, `DELETE …/certificate`, `GET …/certificate/preview` (sample PDF),
`POST …/certificates/issue`, `GET …/certificates`, `DELETE …/certificates/:certId`.

Recipient (authenticated; others get 404, not 403): `GET /api/certificates/mine`,
`GET /api/certificates/:id` (values + layout), `GET …/:id/background`, `GET …/:id/pdf` (`?view=1` inline).
`GET /api/events` for students adds `certificateId`.

## Frontend

`EventCertificatePanel` + `CertificateEditorModal` (drag fields on the canvas, arrow-key nudging,
font/size/colour/alignment, sample name, server PDF preview) in `EventDetail`;
`pages/student/MyCertificates.jsx` at `/my-certificates` (sidebar "Chứng nhận của tôi", `?open=<id>`),
and a "Xem chứng nhận" button in "Lịch sử tham dự".
