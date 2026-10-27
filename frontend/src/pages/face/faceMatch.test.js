import { test } from 'node:test';
import assert from 'node:assert';
import {
  similarity, rankMatches, decide, averageEmbeddings, encodeEmbedding, decodeEmbedding,
  AUTO_THRESHOLD, CONFIRM_THRESHOLD, MARGIN, STREAK_FRAMES, EMBEDDING_DIM,
} from './faceMatch.js';

const match = (score, userId = 'a') => ({ person: { userId }, score });

test('similarity: identical vectors = 1, far vectors clamp to 0', () => {
  const a = Array.from({ length: 8 }, (_, i) => i / 10);
  assert.strictEqual(similarity(a, a), 1);
  assert.strictEqual(similarity(a, a.map((v) => v + 100)), 0);
  assert.strictEqual(similarity(a, [1, 2]), 0);
});

test('rankMatches returns best and runner-up', () => {
  const probe = [0, 0, 0];
  const gallery = [
    { userId: 'far', vector: [1, 1, 1] },
    { userId: 'near', vector: [0.1, 0, 0] },
    { userId: 'mid', vector: [0.5, 0, 0] },
  ];
  const { best, second } = rankMatches(probe, gallery);
  assert.strictEqual(best.person.userId, 'near');
  assert.strictEqual(second.person.userId, 'mid');
  assert.deepStrictEqual(rankMatches(probe, []), { best: null, second: null });
});

test('decide: below confirm threshold is UNKNOWN', () => {
  assert.strictEqual(decide({ best: match(CONFIRM_THRESHOLD - 0.01) }, 10), 'UNKNOWN');
  assert.strictEqual(decide({ best: null }, 10), 'UNKNOWN');
});

test('decide: confident and clear winner waits for the streak, then AUTO', () => {
  const ranked = { best: match(AUTO_THRESHOLD + 0.1), second: match(AUTO_THRESHOLD + 0.1 - MARGIN - 0.01, 'b') };
  assert.strictEqual(decide(ranked, STREAK_FRAMES - 1), 'WAIT');
  assert.strictEqual(decide(ranked, STREAK_FRAMES), 'AUTO');
});

test('decide: two lookalikes or a middling score asks BTC', () => {
  const close = { best: match(0.8), second: match(0.8 - MARGIN / 2, 'b') };
  assert.strictEqual(decide(close, 10), 'CONFIRM');
  assert.strictEqual(decide({ best: match((AUTO_THRESHOLD + CONFIRM_THRESHOLD) / 2) }, 10), 'CONFIRM');
});

test('averageEmbeddings averages element-wise', () => {
  assert.deepStrictEqual(averageEmbeddings([[0, 2], [2, 4]]), [1, 3]);
  assert.strictEqual(averageEmbeddings([]), null);
});

test('encode/decode round-trips through Float32 little-endian base64', () => {
  const v = Array.from({ length: EMBEDDING_DIM }, (_, i) => Math.fround(Math.sin(i) * 0.3));
  const b64 = encodeEmbedding(v);
  assert.strictEqual(Buffer.from(b64, 'base64').length, EMBEDDING_DIM * 4);
  assert.strictEqual(Buffer.from(b64, 'base64').readFloatLE(4), v[1]);
  assert.deepStrictEqual(decodeEmbedding(b64), v);
});
