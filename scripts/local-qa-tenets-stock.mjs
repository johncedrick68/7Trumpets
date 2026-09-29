import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assertLocalCustomerTarget } from './local-qa-customer.mjs';

const snapshotPath = fileURLToPath(new URL('../.tmp/qa-tenets-stock-snapshot.json', import.meta.url));
function guard() {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const value = env.split(/\r?\n/).find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_URL='))?.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  assertLocalCustomerTarget(value);
}
function sql(query) {
  guard();
  const result = spawnSync('docker', ['exec', 'supabase_db_7trumpets', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq', '-c', query], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('LOCAL_STOCK_QA_SQL_FAILED');
  return result.stdout.trim();
}
function validate(snapshot) {
  if (!snapshot?.rows?.length || !/^[0-9a-f-]{36}$/i.test(snapshot.productId)) throw new Error('LOCAL_STOCK_QA_BAD_SNAPSHOT');
  for (const row of snapshot.rows) {
    if (!/^[0-9a-f-]{36}$/i.test(row.variant_id) || ![row.on_hand, row.reserved, row.safety_stock].every(value => Number.isSafeInteger(value) && value >= 0)
        || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) throw new Error('LOCAL_STOCK_QA_BAD_SNAPSHOT');
  }
}
function quoted(value) { return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`; }
function current(snapshot) {
  return JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(i) order by i.variant_id),'[]'::jsonb) from public.inventory i join public.product_variants v on v.id=i.variant_id where v.product_id='${snapshot.productId}'::uuid`));
}
export function restoreTenetsStock(snapshot) {
  guard(); validate(snapshot);
  const productSlug = sql(`select slug from public.products where id='${snapshot.productId}'::uuid`);
  if (productSlug !== 'tenets-2' || current(snapshot).map(row => row.variant_id).join(',') !== snapshot.rows.map(row => row.variant_id).join(',')) throw new Error('LOCAL_STOCK_QA_SCOPE_MISMATCH');
  // Session-local trigger suppression only restores exact original timestamps.
  // Constraints still apply; no persistent trigger/RLS/grant changes are made.
  sql(`begin; set local session_replication_role=replica;
    update public.inventory i set on_hand=s.on_hand,reserved=s.reserved,safety_stock=s.safety_stock,updated_at=s.updated_at
    from jsonb_populate_recordset(null::public.inventory,${quoted(snapshot.rows)}) s where i.variant_id=s.variant_id;
    commit;`);
  if (JSON.stringify(current(snapshot)) !== JSON.stringify(snapshot.rows)) throw new Error('LOCAL_STOCK_QA_RESTORE_MISMATCH');
  if (existsSync(snapshotPath)) unlinkSync(snapshotPath);
  console.log('LOCAL_STOCK_RESTORED: exact quantities and timestamps match');
}
export function createTenetsStockFixture() {
  guard();
  if (existsSync(snapshotPath)) throw new Error('LOCAL_STOCK_QA_RECOVERY_REQUIRED: node scripts/local-qa-tenets-stock.mjs --restore');
  const product = JSON.parse(sql(`select row_to_json(p) from (select id,slug,name from public.products where slug='tenets-2' and name='Tenets #2') p`));
  const snapshot = { productId: product.id, rows: [] };
  if (!/^[0-9a-f-]{36}$/i.test(product.id)) throw new Error('LOCAL_STOCK_QA_PRODUCT_NOT_FOUND');
  snapshot.rows = current(snapshot); validate(snapshot);
  const variants = JSON.parse(sql(`select jsonb_agg(jsonb_build_object('id',id,'sku',sku) order by id) from public.product_variants where product_id='${product.id}'::uuid`));
  if (variants.length !== snapshot.rows.length) throw new Error('LOCAL_STOCK_QA_INVENTORY_INCOMPLETE');
  mkdirSync(fileURLToPath(new URL('../.tmp/', import.meta.url)), { recursive: true });
  // Non-sensitive inventory-only recovery artifact. Never contains credentials.
  writeFileSync(snapshotPath, JSON.stringify(snapshot), { flag: 'wx' });
  try {
    sql(`update public.inventory i set on_hand=i.reserved+i.safety_stock where i.variant_id in (select id from public.product_variants where product_id='${product.id}'::uuid)`);
    if (!current(snapshot).every(row => row.on_hand-row.reserved-row.safety_stock === 0)) throw new Error('LOCAL_STOCK_QA_NOT_UNAVAILABLE');
    console.log(`LOCAL_STOCK_FIXTURE: ${product.id}, ${variants.length} variants, loopback guard PASS`);
    return { snapshot, restore: () => restoreTenetsStock(snapshot) };
  } catch (error) { restoreTenetsStock(snapshot); throw error; }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv[2] !== '--restore') throw new Error('Only --restore is supported');
  restoreTenetsStock(JSON.parse(readFileSync(snapshotPath,'utf8')));
}
