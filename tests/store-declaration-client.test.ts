import assert from 'node:assert/strict';
import test from 'node:test';
import { requestStoreDeclarationUrl } from '../store-declaration-client';

const request = { transactionId: 'purchase/1', storeId: 'store 1', token: 'jwt-token' };
const signedUrl = 'https://ytpetuvvxbmlafsisfaf.supabase.co/storage/v1/object/sign/private/declaration.pdf?token=abc';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('requestStoreDeclarationUrl envia sessão e loja seleccionada e devolve URL HTTPS', async () => {
  
    let calledUrl = '';
    let calledAuthorization = '';
    const url = await requestStoreDeclarationUrl(request, async (input, init) => {
      calledUrl = String(input);
      calledAuthorization = new Headers(init?.headers).get('Authorization') || '';
      return response(200, { success: true, url: signedUrl });
    });
    assert.ok(calledUrl.includes('/api/store/admin/purchases/purchase%2F1/declaration?lojaId=store%201'));
    assert.equal(calledAuthorization, 'Bearer jwt-token');
    assert.equal(url, signedUrl);
});

test('recusa sessão vazia sem efectuar pedido', async () => {
    let called = false;
    await assert.rejects(requestStoreDeclarationUrl({ ...request, token: ' ' }, async () => {
      called = true;
      return response(200, { success: true, url: signedUrl });
    }), /Sessão administrativa expirada/);
    assert.equal(called, false);
});

test('propaga recusa de acesso da API sem devolver URL', async () => {
    await assert.rejects(requestStoreDeclarationUrl(request, async () =>
      response(403, { success: false, message: 'Não autorizado para esta loja.' }),
    ), /Não autorizado para esta loja./);
});

test('recusa resposta sem URL válida', async () => {
    await assert.rejects(requestStoreDeclarationUrl(request, async () =>
      response(200, { success: true, url: null }),
    ), /Não foi possível validar ou abrir a declaração./);
});

test('recusa URL HTTP, host externo e URLs com credenciais', async () => {
    await assert.rejects(requestStoreDeclarationUrl(request, async () =>
      response(200, { success: true, url: 'http://example.com/document.pdf' }),
    ), /endereço temporário do documento não é seguro/);
    await assert.rejects(requestStoreDeclarationUrl(request, async () =>
      response(200, { success: true, url: 'https://attacker.example/storage/v1/object/sign/file.pdf' }),
    ), /endereço temporário do documento não é seguro/);
    await assert.rejects(requestStoreDeclarationUrl(request, async () =>
      response(200, { success: true, url: 'https://user:pass@ytpetuvvxbmlafsisfaf.supabase.co/storage/v1/object/sign/file.pdf' }),
    ), /endereço temporário do documento não é seguro/);
});
