import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { chromium } from 'playwright-core';
import axe from 'axe-core';
import { createLocalCustomerFixture, assertLocalCustomerTarget } from './local-qa-customer.mjs';
import { checkoutRenderFixture } from './checkout-render-fixtures.mjs';

export async function checkoutQa(baseUrl) {
  const target = new URL(baseUrl);
  assert.ok(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname) && !target.username && !target.password);
  const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i=l.indexOf('='); return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; }));
  const origin = assertLocalCustomerTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  const fixture = await createLocalCustomerFixture({ supabaseUrl: origin, publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, secretKey: env.SUPABASE_SECRET_KEY, options: { auth: { persistSession:false, autoRefreshToken:false } } });
  let browser;
  const artifacts = new URL('../.tmp/checkout-qa/', import.meta.url);
  mkdirSync(artifacts, { recursive:true });
  try {
    const executablePath = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync);
    browser = await chromium.launch({ executablePath, headless:true });
    const page = await browser.newPage({ viewport:{ width:1440,height:900 } });
    const errors=[];
    let checkoutPosts=0;
    // Safety tripwire: this QA never sends a checkout action to the server.
    await page.route('**/checkout*', route => {
      if(route.request().method()==='POST') { checkoutPosts++; return route.abort(); }
      return route.continue();
    });
    page.on('pageerror', e=>errors.push(e.message));
    page.on('console', m=>{ if(m.type()==='error') errors.push(m.text()); });
    page.on('response', response=>{
      const path=new URL(response.url()).pathname;
      if(path.includes('/_next/static/') && /\.(css|js)$/.test(path)) {
        const type=response.headers()['content-type']??'';
        if(response.status()!==200 || (path.endsWith('.css')?!type.includes('text/css'):!/(java|ecma)script/.test(type))) errors.push(`Invalid static asset ${response.status()} ${type} ${path}`);
      }
    });
    await page.goto(`${baseUrl}/checkout`);
    await page.waitForURL(url => url.pathname === '/login');
    assert.ok(new URL(page.url()).pathname === '/login', 'Anonymous checkout must redirect');
    const addresses = await fixture.client.from('addresses').insert([1,2].map(n=>({ user_id:fixture.userId, recipient_name:`QA Customer ${n}`, phone:'09123456789', address_line1:`${n} Local QA Street`, city_municipality:'Cebu City', province:'Cebu', postal_code:'6000', country_code:'PH', is_default:n===1 })));
    assert.ifError(addresses.error);
    const variants = await fixture.client.rpc('get_public_variant_availability');
    assert.ifError(variants.error);
    const available=variants.data.filter(v=>v.is_available).slice(0,2);
    assert.equal(available.length,2);
    for(const variant of available) assert.ifError((await fixture.client.rpc('add_authenticated_cart_item',{p_variant_id:variant.variant_id,p_quantity:1})).error);
    const { data:{ session } } = await fixture.client.auth.getSession();
    const cookies=[];
    const ssr = createServerClient(origin,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{ cookies:{ getAll:()=>cookies, setAll:values=>{ cookies.splice(0,cookies.length,...values); } } });
    assert.ifError((await ssr.auth.setSession({ access_token:session.access_token,refresh_token:session.refresh_token })).error);
    await page.context().addCookies(cookies.map(c=>({name:c.name,value:c.value,url:baseUrl, httpOnly:false,sameSite:'Lax'})));
    await page.goto(`${baseUrl}/checkout`, { waitUntil:'networkidle' });
    assert.equal(new URL(page.url()).pathname,'/checkout');
    const prefix=process.env.QA_CAPTURE_BEFORE==='1'?'before':'after';
    await page.screenshot({path:new URL(`${prefix}-desktop.png`,artifacts).pathname.replace(/^\//,''),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:new URL(`${prefix}-mobile.png`,artifacts).pathname.replace(/^\//,''),fullPage:true});
    if(process.env.QA_CAPTURE_BEFORE==='1') return;
    let scans=0, responsive=0;
    async function scan() {
      await page.addScriptTag({content:axe.source});
      const result=await page.evaluate(()=>globalThis.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
      assert.deepEqual(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
      scans++;
    }
    const viewports=[[320,568],[375,667],[390,844],[430,932],[768,1024],[820,1180],[1024,768],[1280,720],[1280,800],[1440,900],[1920,1080]];
    async function overflow() {
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),'Horizontal overflow');
      const submit=page.locator('button[type="submit"]');
      if(await submit.count()) {
        await submit.scrollIntoViewIfNeeded();
        const bounds=await submit.boundingBox();
        assert.ok(bounds && bounds.y>=-1 && bounds.y+bounds.height<=page.viewportSize().height+1,'Place Order must remain reachable');
      }
      responsive++;
    }
    await scan();
    assert.equal(await page.locator('h1').count(),1);
    assert.ok(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return new Set(ids).size===ids.length;}),'Duplicate IDs');
    for(const choice of await page.locator('.checkout-choice').all()) assert.ok((await choice.boundingBox()).height>=44);
    const addressRadio=page.locator('input[name="address_id"]').first();
    await addressRadio.focus();
    await page.keyboard.press('ArrowDown');
    assert.ok(await page.locator('input[name="address_id"]').nth(1).isChecked());
    await page.keyboard.press('ArrowUp');
    assert.ok(await addressRadio.isChecked());
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator(':focus').getAttribute('name'),'address_id');
    for(const [width,height] of viewports) {
      await page.setViewportSize({width,height});
      await overflow();
      await page.locator('input[value="MANUAL_GCASH"]').check();
      await overflow();
      const pickup=page.locator('input[value="STORE_PICKUP"]');
      if(await pickup.count()) {
        await pickup.check(); await overflow();
        assert.ok(await page.locator('input[value="CASH"]').count());
        await page.locator('input[value="SHIPMENT"]').check();
      }
    }
    await page.locator('input[value="MANUAL_GCASH"]').focus();
    await page.keyboard.press('Space');
    await scan();
    if(await page.locator('input[value="STORE_PICKUP"]').count()) {
      await page.locator('input[value="STORE_PICKUP"]').check(); await scan();
    }
    await page.getByRole('link',{name:'Back to Cart',exact:true}).first().focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(url=>url.pathname==='/cart');
    await page.goto(`${baseUrl}/checkout?error=invalid_address`,{waitUntil:'networkidle'});
    assert.equal(await page.locator(':focus').getAttribute('role'),'alert');
    await page.getByRole('link',{name:'Review selection',exact:true}).click();
    assert.equal(await page.locator(':focus').getAttribute('id'),'checkout-address');
    await scan();
    assert.equal(checkoutPosts,0);
    const orders=await fixture.client.from('orders').select('id').eq('user_id',fixture.userId);
    assert.ifError(orders.error); assert.equal(orders.data.length,0);
    // Test actual SSR components with isolated read-only inputs. These are layout,
    // accessibility and server-presentation tests, NOT hydrated/live DB UAT.
    const componentStates=[{label:'normal'}, {label:'long title',longTitle:true}, {label:'missing address',noAddress:true}, {label:'COD exact limit',subtotal:85000}, {label:'COD over limit',subtotal:85001}, {label:'no eligible payment',noPayment:true,subtotal:85001}, {label:'settings unavailable',settingsError:true}, {label:'address read failure',addressError:true}, {label:'cart read failure',cartError:true}, {label:'stale stock',staleStock:true}, {label:'validation',error:'invalid_address'}, {label:'loading',loading:true}, {label:'pending',pending:true}];
    const css=readFileSync(new URL('../src/app/checkout/checkout.css',import.meta.url),'utf8');
    for(const state of componentStates) {
      const {html}=await checkoutRenderFixture(state);
      await page.setContent(`<!doctype html><html lang="en"><head><title>Checkout component QA</title><style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial}h1,h2,p{margin-top:0}dl,dd{margin:0}${css}</style></head><body>${html}</body></html>`);
      for(const [width,height] of viewports) {await page.setViewportSize({width,height});await overflow();}
      await scan();
    }
    assert.deepEqual(errors,[]);
    console.log(`CHECKOUT_QA: ${scans} axe states, ${responsive} viewport/state checks PASS; native keyboard and error focus PASS; zero console/page errors, checkout POSTs and orders. Isolated SSR states are not end-to-end UAT.`);
  } finally { await browser?.close(); await fixture.cleanup(); }
}
if(process.argv[1]?.endsWith('checkout-qa.mjs')) await checkoutQa(process.env.QA_BASE_URL || 'http://localhost:3002');
