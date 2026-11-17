import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';

async function serveClientIp() {
  const app = express();
  // Must match the production setting: only the local Nginx proxy is trusted.
  app.set('trust proxy', 'loopback');
  app.get('/client-ip', (req, res) => res.json({ ip: req.ip }));
  const server: Server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start local HTTP server');
  return {
    url: `http://127.0.0.1:${address.port}/client-ip`,
    close: () => new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve())
    ),
  };
}

test('usa o endereço do cliente acrescentado pelo proxy local e ignora valores XFF anteriores', async () => {
  const server = await serveClientIp();
  try {
    const response = await fetch(server.url, {
      headers: { 'X-Forwarded-For': '198.51.100.77, 203.0.113.24' },
    });
    const body = await response.json() as { ip: string };
    assert.equal(response.status, 200);
    assert.equal(body.ip, '203.0.113.24');
  } finally {
    await server.close();
  }
});

test('sem proxy mantém o endereço directo da ligação', async () => {
  const server = await serveClientIp();
  try {
    const response = await fetch(server.url);
    const body = await response.json() as { ip: string };
    assert.equal(response.status, 200);
    assert.equal(body.ip, '127.0.0.1');
  } finally {
    await server.close();
  }
});
