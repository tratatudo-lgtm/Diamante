import assert from 'node:assert/strict';
import test from 'node:test';
import express, { type RequestHandler } from 'express';
import { createServer, type Server } from 'node:http';
import jwt from 'jsonwebtoken';

const secret = 'test-only-secret-with-at-least-32-characters-long';
process.env.JWT_SECRET = secret;
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-role-key-not-used-for-network';
process.env.OTP_HMAC_SECRET = 'test-only-otp-hmac-secret-with-at-least-32-characters';

const { createVerifyAuth } = await import('../middleware/verifyAuth');
const { createVerifyAdmin } = await import('../middleware/verifyAdmin');

const employeeId = '11111111-1111-4111-8111-111111111111';
const storeId = '22222222-2222-4222-8222-222222222222';

function token(payload: object = { id: employeeId }, key = secret, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, key, { algorithm: 'HS256', expiresIn: '5m', ...options });
}

async function serve(middleware: RequestHandler) {
  const app = express();
  app.get('/protected', middleware, (req: any, res) => {
    res.json({ ok: true, user: req.authenticatedUser ?? req.adminUser });
  });
  const server: Server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start local HTTP server');
  return {
    url: `http://127.0.0.1:${address.port}/protected`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

function employee(overrides: Record<string, unknown> = {}) {
  return {
    id: employeeId, nome_completo: 'Funcionário de Teste', email: 'test@example.invalid',
    role: 'funcionario', loja_id: storeId, ativo: true, lojas: null, ...overrides,
  };
}

test('verifyAuth aceita JWT HS256 válido e volta a consultar o funcionário ativo', async () => {
  let lookedUp = '';
  const middleware = createVerifyAuth({
    secret,
    findActiveEmployee: async id => { lookedUp = id; return { data: employee(), error: null }; },
  });
  const server = await serve(middleware);
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token()}` } });
    const body = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(body.user.role, 'funcionario');
    assert.equal(lookedUp, employeeId);
  } finally { await server.close(); }
});

test('verifyAuth rejeita assinatura com segredo diferente', async () => {
  let queried = false;
  const server = await serve(createVerifyAuth({ secret, findActiveEmployee: async () => { queried = true; return { data: employee() }; } }));
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token({ id: employeeId }, 'attacker-secret-that-is-not-the-real-secret')}` } });
    assert.equal(response.status, 401);
    assert.equal(queried, false);
  } finally { await server.close(); }
});

test('verifyAuth rejeita JWT expirado', async () => {
  const expired = jwt.sign({ id: employeeId, exp: Math.floor(Date.now() / 1000) - 60 }, secret, { algorithm: 'HS256' });
  const server = await serve(createVerifyAuth({ secret, findActiveEmployee: async () => ({ data: employee() }) }));
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${expired}` } });
    assert.equal(response.status, 401);
  } finally { await server.close(); }
});

test('verifyAuth rejeita algoritmo none', async () => {
  const unsigned = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${Buffer.from(JSON.stringify({ id: employeeId, exp: Math.floor(Date.now()/1000)+60 })).toString('base64url')}.`;
  const server = await serve(createVerifyAuth({ secret, findActiveEmployee: async () => ({ data: employee() }) }));
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${unsigned}` } });
    assert.equal(response.status, 401);
  } finally { await server.close(); }
});

test('verifyAuth rejeita funcionário inativo ou perfil com ID divergente', async () => {
  for (const record of [employee({ ativo: false }), employee({ id: '33333333-3333-4333-8333-333333333333' })]) {
    const server = await serve(createVerifyAuth({ secret, findActiveEmployee: async () => ({ data: record }) }));
    try {
      const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(response.status, 401);
    } finally { await server.close(); }
  }
});

test('verifyAuth falha fechada quando a consulta de funcionário falha', async () => {
  const server = await serve(createVerifyAuth({ secret, findActiveEmployee: async () => ({ data: null, error: new Error('db unavailable') }) }));
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(response.status, 503);
  } finally { await server.close(); }
});

test('verifyAdmin aceita apenas role admin vinda do registo ativo e normaliza espaços/maiúsculas', async () => {
  const server = await serve(createVerifyAdmin({
    secret,
    findActiveEmployee: async id => ({ data: { id, role: ' ADMIN ', ativo: true, nome_completo: 'Admin Teste' } }),
  }));
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.user.role, 'admin');
  } finally { await server.close(); }
});

test('verifyAdmin rejeita funcionário normal, inativo e utilizador sem registo', async () => {
  for (const record of [employee(), employee({ role: 'admin', ativo: false }), null]) {
    const server = await serve(createVerifyAdmin({ secret, findActiveEmployee: async () => ({ data: record }) }));
    try {
      const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token()}` } });
      assert.equal(response.status, 403);
    } finally { await server.close(); }
  }
});

test('verifyAdmin rejeita JWT assinado com outro segredo e não consulta a base de dados', async () => {
  let queried = false;
  const server = await serve(createVerifyAdmin({ secret, findActiveEmployee: async () => { queried = true; return { data: employee({ role: 'admin' }) }; } }));
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token({ id: employeeId }, 'wrong-secret')}` } });
    assert.equal(response.status, 401);
    assert.equal(queried, false);
  } finally { await server.close(); }
});

test('verifyAdmin falha fechada perante erro da consulta de permissões', async () => {
  const server = await serve(createVerifyAdmin({ secret, findActiveEmployee: async () => ({ data: null, error: new Error('db unavailable') }) }));
  try {
    const response = await fetch(server.url, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(response.status, 503);
  } finally { await server.close(); }
});
