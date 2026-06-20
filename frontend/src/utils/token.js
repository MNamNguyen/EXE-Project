// Decode a JWT payload WITHOUT verifying the signature.
//
// This is used CLIENT-SIDE ONLY, to read non-secret claims (`exp`, `userId`)
// so we can:
//   1. expire a stale session before trusting any cached profile, and
//   2. make sure a cached profile actually belongs to the current token.
//
// NEVER use this for authorization decisions — it does not verify the
// signature. The backend re-verifies every token on every request.
export function decodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Milliseconds until the token expires. Returns 0 if missing/invalid/expired.
export function msUntilExpiry(token) {
  const payload = decodeToken(token);
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}

export function isTokenExpired(token) {
  return msUntilExpiry(token) <= 0;
}
