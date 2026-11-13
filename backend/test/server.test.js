import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-not-used-for-real-authentication';
process.env.CORS_ORIGIN = 'https://portal.example';

const { default: app } = await import('../server.js');
const { pool } = await import('../config/db.js');
const { gradeForScore } = await import('../routes/recordRoutes.js');

let server;
let baseUrl;

before(async () => {
  // Keep these API smoke tests independent of a running PostgreSQL instance.
  pool.query = async () => ({ rows: [{ connected: 1 }] });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
});

test('health endpoints return a database-connected response', async () => {
  for (const path of ['/', '/health', '/api/health']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should return 200`);
    assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
  }
});

test('admin CORS preflight permits the step-up verification header', async () => {
  const response = await fetch(`${baseUrl}/api/admin/catalog`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://portal.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type,x-step-up-token',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://portal.example');
  assert.match(response.headers.get('access-control-allow-headers') || '', /x-step-up-token/i);
});

test('unknown API paths return JSON 404 instead of crashing', async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Route not found' });
});

test('grade calculation validates scores and uses the configured five-point scale', () => {
  assert.deepEqual(gradeForScore(70), { grade: 'A', point: 5 });
  assert.deepEqual(gradeForScore(60), { grade: 'B', point: 4 });
  assert.deepEqual(gradeForScore(50), { grade: 'C', point: 3 });
  assert.deepEqual(gradeForScore(45), { grade: 'D', point: 2 });
  assert.deepEqual(gradeForScore(40), { grade: 'E', point: 1 });
  assert.deepEqual(gradeForScore(39), { grade: 'F', point: 0 });
  assert.throws(() => gradeForScore(101), /whole number from 0 to 100/);
  assert.throws(() => gradeForScore(50.5), /whole number from 0 to 100/);
});
