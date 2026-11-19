import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPortalMode,
  getPortalUrlForRole,
  isRoleAllowedOnPortal,
} from '../src/config/portal-routing';

test('identifica os três domínios DuckDNS sem distinguir maiúsculas', () => {
  assert.equal(getPortalMode('diamantedouro.duckdns.org'), 'public');
  assert.equal(getPortalMode('LOJA-DIAMANTEDOURO.DUCKDNS.ORG'), 'store');
  assert.equal(getPortalMode('admin-diamantedouro.duckdns.org'), 'admin');
});

test('normaliza um ponto final e mantém hosts de desenvolvimento no modo app', () => {
  assert.equal(getPortalMode('diamantedouro.duckdns.org.'), 'public');
  assert.equal(getPortalMode('localhost'), 'app');
  assert.equal(getPortalMode('127.0.0.1'), 'app');
});

test('só administradores entram no portal administrativo', () => {
  assert.equal(isRoleAllowedOnPortal('admin', 'admin'), true);
  assert.equal(isRoleAllowedOnPortal('admin', ' ADMIN '), true);
  assert.equal(isRoleAllowedOnPortal('admin', 'funcionario'), false);
  assert.equal(isRoleAllowedOnPortal('admin', null), false);
});

test('o portal de loja aceita funcionários, gestores e administradores', () => {
  assert.equal(isRoleAllowedOnPortal('store', 'funcionario'), true);
  assert.equal(isRoleAllowedOnPortal('store', 'gestor'), true);
  assert.equal(isRoleAllowedOnPortal('store', 'admin'), true);
  assert.equal(isRoleAllowedOnPortal('store', undefined), false);
});

test('resolve o portal correcto de acordo com a função autenticada', () => {
  assert.equal(getPortalUrlForRole('admin'), 'https://admin-diamantedouro.duckdns.org');
  assert.equal(getPortalUrlForRole('funcionario'), 'https://loja-diamantedouro.duckdns.org');
});
