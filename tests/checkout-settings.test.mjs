import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { validateCheckoutSettings, resolveCheckoutSettings, CheckoutConfigurationError } from '../src/lib/checkout/settings-contract.ts';

const rows = () => [
  { key: 'fulfillment', value: { shipping_fee_minor: 0, free_shipping_threshold_minor: 0, allow_store_pickup: false } },
  { key: 'payment', value: { cod_enabled: true, cod_max_minor: 0, gcash_enabled: false } },
];
test('checkout configuration accepts canonical zero amounts', () => assert.equal(validateCheckoutSettings(rows()).payment.cod_max_minor, 0));
test('checkout missing configuration is distinct', () => assert.throws(() => validateCheckoutSettings([]), e => e instanceof CheckoutConfigurationError && e.reason === 'missing'));
for (const value of [null, -1, 0.5, '100', Number.MAX_SAFE_INTEGER + 1]) {
  test(`checkout rejects invalid COD amount ${value}`, () => {
    const input = rows(); input[1].value.cod_max_minor = value;
    assert.throws(() => validateCheckoutSettings(input), e => e.reason === 'malformed');
  });
}
test('checkout rejects malformed fulfillment instead of defaulting shipping', () => {
  const input = rows(); input[0].value.shipping_fee_minor = undefined;
  assert.throws(() => validateCheckoutSettings(input), CheckoutConfigurationError);
});
test('checkout settings query errors fail closed without financial fallbacks', () => {
  const loader = readFileSync(new URL('../src/lib/checkout/settings.ts', import.meta.url), 'utf8');
  assert.match(loader, /resolveCheckoutSettings/);
  assert.match(loader, /catch[\s\S]*throw new CheckoutConfigurationError\("query"\)/);
  assert.doesNotMatch(loader, /fallback|getStoreSetting/);
});
test('checkout query succeeds with validated rows', async () => assert.equal((await resolveCheckoutSettings(async () => ({ data: rows(), error: null }))).payment.cod_max_minor, 0));
test('checkout database query error fails closed', async () => assert.rejects(resolveCheckoutSettings(async () => ({ data: rows(), error: new Error('internal') })), e => e.reason === 'query'));
test('checkout thrown query error fails closed', async () => assert.rejects(resolveCheckoutSettings(async () => { throw new Error('internal'); }), e => e.reason === 'query'));
test('privileged client remains server-only and cookie independent', () => {
  const source = readFileSync(new URL('../src/lib/supabase/server.ts', import.meta.url), 'utf8');
  assert.match(source, /import "server-only"/);
  const client = source.slice(source.indexOf('export function createServiceClient'));
  assert.match(client, /persistSession: false/);
  assert.match(client, /autoRefreshToken: false/);
  assert.doesNotMatch(client, /cookies\(|getSession|setSession/);
});

function actionHarness({ authenticated = true, configurationFailure = false } = {}) {
  const calls = [];
  const user = { id: 'canonical-customer', email: 'customer@example.test' };
  const configuration = validateCheckoutSettings(rows());
  configuration.fulfillment.shipping_fee_minor = 500;
  const sessionClient = {
    auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: user.id } : {} } }), getUser: async () => ({ data: { user } }) },
    rpc: async () => ({ data: true, error: null }),
    from(table) {
      const chain = { select: () => chain, eq: (key, value) => { calls.push({ table, key, value }); return chain; }, single: async () => ({ data: { recipient_name: 'Customer', phone: '1', address_line1: 'Street', city_municipality: 'City', province: 'Province', postal_code: '1000' }, error: null }), delete: () => chain };
      return chain;
    },
  };
  const imports = {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(path) { throw new Error(path); } },
    '@/lib/cart/actions': { getOrCreateCart: async () => ({ id: 'cart', subtotal_minor: 10000, items: [{ variant_id: 'canonical-variant', quantity: 1 }] }) },
    '@/lib/server-log': { logServerError() {} },
    '@/lib/supabase/server': { createClient: async () => sessionClient, createServiceClient() { calls.push({ privileged: true }); return { rpc: async (name, payload) => { calls.push({ name, payload }); return { data: { id: 'confirmed-order' }, error: null }; } }; } },
    '@/lib/checkout/settings': { loadCheckoutSettings: async () => { if (configurationFailure) throw new CheckoutConfigurationError('query'); return configuration; } },
    '@/lib/checkout/shipping': { calculateShippingMinor: (_subtotal, _mode, settings) => settings.shipping_fee_minor },
  };
  const source = readFileSync(new URL('../src/lib/checkout/actions.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: name => { assert.ok(imports[name], `unexpected import ${name}`); return imports[name]; }, Date };
  vm.runInNewContext(compiled, context);
  const form = new FormData();
  for (const [key, value] of Object.entries({ address_id: 'selected-address', payment_method: 'COD', fulfillment_method: 'SHIPMENT', idempotency_key: 'checkout-test-stable-key', customer_id: 'spoofed', shipping_minor: '0', cod_max_minor: '999999' })) form.set(key, value);
  return { action: context.exports.processCheckout, calls, form };
}
test('authenticated server action derives identity/address/shipping before privileged call', async () => {
  const { action, calls, form } = actionHarness();
  await assert.rejects(action(form), /\/orders\/confirmed-order/);
  const rpc = calls.find(call => call.name === 'checkout_order');
  assert.equal(rpc.payload.p_customer_id, 'canonical-customer');
  assert.equal(rpc.payload.p_shipping_minor, 500);
  assert.ok(calls.some(call => call.table === 'addresses' && call.key === 'user_id' && call.value === 'canonical-customer'));
  assert.ok(calls.findIndex(call => call.table === 'addresses') < calls.findIndex(call => call.privileged));
  assert.ok(calls.some(call => call.table === 'cart_items'));
});
test('unauthenticated server action never uses privileged client', async () => {
  const { action, calls, form } = actionHarness({ authenticated: false });
  await assert.rejects(action(form), /\/login/);
  assert.ok(!calls.some(call => call.privileged));
});
test('settings failure prevents privileged checkout and cart cleanup', async () => {
  const { action, calls, form } = actionHarness({ configurationFailure: true });
  await assert.rejects(action(form), /configuration_unavailable/);
  assert.ok(!calls.some(call => call.privileged || call.table === 'cart_items'));
});
