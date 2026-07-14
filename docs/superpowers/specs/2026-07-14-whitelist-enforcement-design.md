# Whitelist Enforcement Design

## Goal

Prevent students who are not registered for a restricted event from checking in or checking out through its QR code, and clearly tell them that they are not on the event registration list.

## Scope

- Enforce the existing `Event.isWhitelisted` and `EventMember` relationship in the QR attendance flow.
- Return a stable API error for an unregistered student.
- Show a specific, understandable error title and message on the scan page.
- Preserve the current behavior for public events.
- Preserve organizer manual check-in as an explicit administrative override.

No database migration or event-management UI change is required because event membership management and the required schema already exist.

## Backend behavior

After the QR token has been validated and the active event has been loaded, `processCheckin` checks membership when `event.isWhitelisted` is true.

- If an `EventMember` row exists for the authenticated user and event, processing continues normally.
- If no membership exists, the endpoint returns HTTP `403` with:

```json
{
  "success": false,
  "error": "NOT_REGISTERED",
  "message": "Bạn không có trong danh sách đăng ký tham gia sự kiện này."
}
```

The same rule applies to QR check-in and QR check-out. The membership check occurs before time, GPS, device, and attendance mutations so an unregistered user receives the relevant response without unnecessary location or device processing.

Manual organizer attendance remains unchanged and can be used as an explicit override for exceptional cases.

## Frontend behavior

The scan page maps `NOT_REGISTERED` to the title `Chưa đăng ký tham gia`. The message returned by the backend is displayed using the existing error card.

Retry remains available because an organizer may add the student to the registration list while the QR token is still valid. No new screen or component is required.

## Error and security behavior

- The backend is the source of truth; hiding restricted events in the frontend is not considered authorization.
- A missing membership returns `403`, distinguishing authorization from an invalid QR or malformed request.
- Rejected attempts are not recorded as fraud because being absent from a registration list is not inherently fraudulent.
- No attendance row is created or modified for a rejected request.

## Testing

Automated controller tests will cover:

1. A public event permits a user without an `EventMember` row.
2. A whitelisted event permits a registered member.
3. A whitelisted event rejects an unregistered user with HTTP `403` and `NOT_REGISTERED`.
4. The restriction applies to checkout as well as check-in.
5. A rejected request performs no attendance mutation.
6. The scan page contains the `NOT_REGISTERED` title mapping.

Because the project currently has no test framework, the implementation plan will introduce the smallest practical test harness needed for this controller behavior.
