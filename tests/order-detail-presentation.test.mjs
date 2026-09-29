import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../src/app/orders/[id]/page.tsx', import.meta.url), 'utf8');
async function render({ variant = 'Size S', queryError = false, missing = false, authenticated = true } = {}) {
  const calls = [];
  const order = { id: 'existing-order', user_id: 'owner', order_number: 'ORD-QA', status: 'CONFIRMED', fulfillment_method: 'SHIPMENT', total_minor: 64900, subtotal_minor: 49900, shipping_minor: 15000, placed_at: '2026-09-29T11:00:00Z' };
  const rows = {
    orders: missing ? null : order,
    order_items: [{ id: 'item', product_name: 'Rise to Defend', variant_name: variant, quantity: 1, sku: 'PRIVATE-SKU', line_total_minor: 49900 }],
    payments: { id: 'payment', method: 'COD', status: 'UNPAID' },
    inventory_reservations: [], shipments: null, return_requests: [], payment_submissions: [],
  };
  const client = { auth: { getClaims: async () => ({ data: { claims: { sub: authenticated ? 'owner' : undefined } } }) }, from(table) {
    const query = { then(resolve) { return Promise.resolve({ data: rows[table], error: table === 'orders' && queryError ? new Error('private database detail') : null }).then(resolve); } };
    for (const method of ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']) query[method] = (...args) => { calls.push({ table, method, args }); return query; };
    return query;
  } };
  const container = tag => function FixtureContainer({ children, ...props }) { delete props.asChild; return React.createElement(tag, props, children); };
  const imports = {
    'next/navigation': { redirect: path => { throw new Error(`REDIRECT:${path}`); }, notFound: () => { throw new Error('NOT_FOUND'); } },
    'next/link': container('a'),
    '@/lib/catalog/queries': { formatMinorUnitsToPHP: value => `₱${(value / 100).toFixed(2)}` },
    '@/lib/orders/status': { deriveCustomerFulfillmentStage: () => ({ label: 'Confirmed', description: 'Order confirmed', stepIndex: 1 }) },
    '@/lib/orders/courier': { getCourierDisplayName: value => value },
    '@/lib/server-log': { logServerError: () => {} },
    '@/lib/payments/actions': { getReceiptSignedUrl: () => { throw new Error('Unexpected private access'); }, submitGcashProof: () => {} },
    '@/lib/supabase/server': { createClient: async () => client },
    '@/components/ui/button': { Button: container('button') },
    '@/components/ui/card': { Card: container('section'), CardHeader: container('header'), CardTitle: container('h2'), CardContent: container('div') },
    '@/components/ui/badge': { Badge: container('span') },
    '@/components/gcash-payment-panel': { GcashPaymentPanel: () => null },
    '@/components/return-request-dialog': { ReturnRequestDialog: () => null },
    '@/components/cancel-order-dialog': { CancelOrderDialog: () => null },
    'lucide-react': Object.fromEntries(['ExternalLink', 'Store', 'Truck', 'MessageSquare'].map(name => [name, () => null])),
  };
  const context = { exports: {}, React, require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, context);
  const tree = await context.exports.default({ params: Promise.resolve({ id: order.id }), searchParams: Promise.resolve({}) });
  return { html: renderToStaticMarkup(tree), calls, metadata: context.exports.metadata };
}

test('actual owner order page renders immutable variant without case transformation or SKU', async () => {
  const { html, calls } = await render();
  assert.match(html, /Rise to Defend/);
  const label = html.match(/<div class="([^"]*)">Size S<\/div>/);
  assert.ok(label, 'snapshot reaches the actual page JSX');
  assert.doesNotMatch(label[1], /uppercase|lowercase|capitalize/);
  assert.doesNotMatch(html, /PRIVATE-SKU|SKU:|Size Size S/);
  assert.match(html, /Qty: 1/);
  assert.ok(calls.some(c => c.table === 'orders' && c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'owner'));
  assert.ok(calls.some(c => c.table === 'order_items' && c.method === 'select' && c.args[0] === '*'));
});
test('no meaningful variant leaves no placeholder or extra option row', async () => {
  const { html } = await render({ variant: null });
  assert.doesNotMatch(html, /Variant:|undefined|PRIVATE-SKU/);
  assert.match(html, /Rise to Defend/);
});
test('order query errors remain distinct from not found', async () => {
  await assert.rejects(render({ queryError: true }), /ORDER_UNAVAILABLE/);
  await assert.rejects(render({ missing: true }), /NOT_FOUND/);
});
test('anonymous order page redirects without order data', async () => {
  await assert.rejects(render({ authenticated: false }), /REDIRECT:\/login/);
});
test('one useful H1 and non-sensitive page title; no arbitrary autofocus', async () => {
  const { html, metadata } = await render();
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /Order #ORD-QA/);
  assert.equal(metadata.title, 'Order details');
  assert.doesNotMatch(source, /autoFocus|headingRef\.focus/);
});
