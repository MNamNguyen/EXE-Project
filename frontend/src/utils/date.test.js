import { test } from 'node:test';
import assert from 'node:assert';
import { toLocalInput, localInputToISO } from './date.js';

test('localInputToISO → toLocalInput round-trips the same wall-clock value', () => {
  assert.strictEqual(toLocalInput(localInputToISO('2026-08-16T08:00')), '2026-08-16T08:00');
});

test('toLocalInput returns empty string for falsy input', () => {
  assert.strictEqual(toLocalInput(null), '');
  assert.strictEqual(toLocalInput(''), '');
});

test('localInputToISO returns empty string for empty or invalid input', () => {
  assert.strictEqual(localInputToISO(''), '');
  assert.strictEqual(localInputToISO('not-a-date'), '');
});
