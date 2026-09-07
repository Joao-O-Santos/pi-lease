export const defaultPurchasePolicy = Object.freeze({
  allowPurchases: true,
  requirePurchaseConfirm: true,
  ceiling: 20,
  currencies: ['USD', 'EUR', 'GBP']
});

/** Guidance only: arbitrary browser_execute JavaScript cannot be intercepted. */
export function purchaseDecision({ amount, currency }, policy = defaultPurchasePolicy) {
  if (!policy.allowPurchases) return 'refuse';
  const number = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(number) || number < 0 || !policy.currencies.includes(String(currency || '').toUpperCase())) return 'confirm';
  return policy.requirePurchaseConfirm && number >= policy.ceiling ? 'confirm' : 'allow';
}
