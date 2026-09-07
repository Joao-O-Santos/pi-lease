import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPurchasePolicy, purchaseDecision } from '../src/policy.js';

test('default policy allows low supported-currency purchases', () => {
  assert.equal(defaultPurchasePolicy.allowPurchases, true);
  assert.equal(purchaseDecision({ amount: 19.99, currency: 'USD' }), 'allow');
  assert.equal(purchaseDecision({ amount: 19, currency: 'eur' }), 'allow');
});
test('supported currencies confirm at the inclusive ceiling', () => {
  for (const currency of ['USD', 'EUR', 'GBP']) assert.equal(purchaseDecision({ amount: 20, currency }), 'confirm');
});
test('unknown currency or amount is never automatically allowed', () => {
  assert.equal(purchaseDecision({ amount: 2, currency: 'JPY' }), 'confirm');
  assert.equal(purchaseDecision({ amount: undefined, currency: 'USD' }), 'confirm');
  assert.equal(purchaseDecision({ amount: 2, currency: 'USD' }, { ...defaultPurchasePolicy, allowPurchases: false }), 'refuse');
});
