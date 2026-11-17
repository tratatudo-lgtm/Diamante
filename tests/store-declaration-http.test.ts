import assert from 'node:assert/strict';
import test from 'node:test';
import express, { type RequestHandler } from 'express';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import {
  createStoreDeclarationRouter,
  type StoreDeclarationRepository,
  type StoreDeclarationPurchase,
  type StoreDeclarationEvidence,
  type StoreDeclarationAccessLog,
} from '../store-declaration-router';

const ownStore = '11111111-1111-4111-8111-111111111111';
const otherStore = '22222222-2222-4222-8222-222222222222';
const purchaseId = '33333333-3333-4333-8333-333333333333';
const evidenceId = '44444444-4444-4444-8444-444444444444';
const bytes = Buffer.from('%PDF-1.7 test declaration');
const digest = createHash('sha256').update(bytes).digest('hex');

class FakeRepository implements StoreDeclarationRepository {
  purchase: StoreDeclarationPurchase | null = {
    id: purchaseId, loja_id: ownStore, declaracao_assinada_id: evidenceId,
  };
  evidence: StoreDeclarationEvidence | null = {
    id: evidenceId, storage_path: 'store/purchase/declaration.pdf',
    mime_type: 'application/pdf', tamanho_bytes: bytes.length,
    sha256: digest, versao_declaracao: 'v1',
  };
  file: Uint8Array | null = new Uint8Array(bytes);
  signedUrl = 'https://storage.test/signed/declaration?token=temporary';
  purchaseError: unknown | null = null;
  evidenceError: unknown | null = null;
  downloadError: unknown | null = null;
  signedError: unknown | null = null;
  auditError: unknown | null = null;
  calls: string[] = [];
  logs: StoreDeclarationAccessLog[] = [];

  async getPurchase(id: string) {
    this.calls.push('purchase');
    return { data: this.purchase?.id === id ? this.purchase : null, error: this.purchaseError };
  }
  async getEvidence(id: string) {
    this.calls.push('evidence');
    return { data: this.evidence?.id === id ? this.evidence : null, error: this.evidenceError };
  }
  async download(path: string) {
    this.calls.push('download:' + path);
    return { data: this.file, error: this.downloadError };
  }
  async createSignedUrl(path: string, seconds: number) {
    this.calls.push('sign:' + seconds + ':' + path);
    return { data: this.signedUrl ? { signedUrl: this.signedUrl } : null, error: this.signedError };
  }
  async recordAccess(log: StoreDeclarationAccessLog) {
    this.calls.push('audit');
    if (!this.auditError) this.logs.push(log);
    return { error: this.auditError };
  }
}

function authMiddleware(): RequestHandler {
  return (req, res, next) => {
    const token = req.headers.authorization;
    if (token === 'Bearer staff-own') {
      (req as any).authenticatedUser = { id: 'staff-1', role: 'funcionario', loja_id: ownStore, ativo: true };
      return next();
    }
    if (token === 'Bearer staff-other') {
      (req as any).authenticatedUser = { id: 'staff-2', role: 'funcionario', loja_id: otherStore, ativo: true };
      return next();
    }
    if (token === 'Bearer inactive-staff') {
      (req as any).authenticatedUser = { id: 'staff-3', role: 'funcionario', loja_id: ownStore, ativo: false };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Sessão inválida ou expirada.' });
  };
}

function adminMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (req.headers.authorization === 'Bearer admin') {
      (req as any).adminUser = { id: 'admin-1', role: 'admin' };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Sessão administrativa inválida.' });
  };
}

async function withServer(
  run: (baseUrl: string, repository: FakeRepository) => Promise<void>,
  configure?: (repository: FakeRepository) => void,
) {
  const repository = new FakeRepository();
  configure?.(repository);
  const app = express();
  app.use('/api/store', createStoreDeclarationRouter({
    repository, verifyAuth: authMiddleware(), verifyAdmin: adminMiddleware(),
  }));
  const server: Server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');
  try {
    await run(`http://127.0.0.1:${address.port}`, repository);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('funcionário ativo consulta declaração da própria loja e recebe URL assinada de 60 segundos', async () => {
  await withServer(async (base, repository) => {
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer staff-own' },
    });
    const body = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.expiresInSeconds, 60);
    assert.equal(body.url, repository.signedUrl);
    assert.equal(body.sha256, digest);
    assert.deepEqual(repository.calls, [
      'purchase', 'evidence', 'download:store/purchase/declaration.pdf',
      'sign:60:store/purchase/declaration.pdf', 'audit',
    ]);
    assert.equal(repository.logs.length, 1);
    assert.equal(repository.logs[0].accessed_by, 'staff-1');
    assert.equal(repository.logs[0].accessed_role, 'funcionario');
    assert.equal(repository.logs[0].sha256_verified, true);
  });
});

test('administrador ativo consulta declaração de outra loja', async () => {
  await withServer(async (base, repository) => {
    repository.purchase = { ...repository.purchase!, loja_id: otherStore };
    const response = await fetch(`${base}/api/store/admin/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer admin' },
    });
    assert.equal(response.status, 200);
    assert.equal(repository.logs[0].accessed_by, 'admin-1');
    assert.equal(repository.logs[0].accessed_role, 'admin');
  });
});

test('funcionário de outra loja recebe 403 antes de descarregar o documento', async () => {
  await withServer(async (base, repository) => {
    repository.purchase = { ...repository.purchase!, loja_id: otherStore };
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer staff-own' },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(repository.calls, ['purchase']);
    assert.equal(repository.logs.length, 0);
  });
});

test('sessão inválida é recusada pelo middleware antes de consultar a compra', async () => {
  await withServer(async (base, repository) => {
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`);
    assert.equal(response.status, 401);
    assert.deepEqual(repository.calls, []);
  });
});

test('funcionário inativo é recusado mesmo que o middleware o tenha anexado ao pedido', async () => {
  await withServer(async (base, repository) => {
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer inactive-staff' },
    });
    assert.equal(response.status, 403);
    assert.deepEqual(repository.calls, []);
  });
});

test('identificador inválido é recusado sem consulta à base de dados', async () => {
  await withServer(async (base, repository) => {
    const response = await fetch(`${base}/api/store/purchases/not-a-uuid/declaration`, {
      headers: { Authorization: 'Bearer staff-own' },
    });
    assert.equal(response.status, 400);
    assert.deepEqual(repository.calls, []);
  });
});

test('compra sem declaração arquivada devolve 404 e não acede ao Storage', async () => {
  await withServer(async (base, repository) => {
    repository.purchase = { ...repository.purchase!, declaracao_assinada_id: null };
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer staff-own' },
    });
    assert.equal(response.status, 404);
    assert.deepEqual(repository.calls, ['purchase']);
  });
});

test('hash divergente bloqueia a entrega e não cria URL nem auditoria', async () => {
  await withServer(async (base, repository) => {
    repository.evidence = { ...repository.evidence!, sha256: '0'.repeat(64) };
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer staff-own' },
    });
    assert.equal(response.status, 409);
    assert.deepEqual(repository.calls, ['purchase', 'evidence', 'download:store/purchase/declaration.pdf']);
    assert.equal(repository.logs.length, 0);
  });
});

test('falha ao registar auditoria impede a entrega do URL assinado', async () => {
  await withServer(async (base, repository) => {
    repository.auditError = new Error('audit unavailable');
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer staff-own' },
    });
    assert.equal(response.status, 503);
    const body = await response.json() as any;
    assert.equal(body.success, false);
    assert.equal(body.url, undefined);
    assert.equal(repository.calls.at(-1), 'audit');
  });
});

test('falha na geração de URL temporário não regista consulta', async () => {
  await withServer(async (base, repository) => {
    repository.signedError = new Error('storage unavailable');
    const response = await fetch(`${base}/api/store/purchases/${purchaseId}/declaration`, {
      headers: { Authorization: 'Bearer staff-own' },
    });
    assert.equal(response.status, 503);
    assert.equal(repository.calls.includes('audit'), false);
  });
});
