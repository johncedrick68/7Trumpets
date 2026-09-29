// Isolated component/Server Component test harness. No deployed route, no DB
// mutations, and no fabricated browser session. Not end-to-end checkout proof.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useFormStatus } from 'react-dom';

const link = ({ children, ...props }) => React.createElement('a', props, children);
const image = ({ src, alt, width, height, className }) => React.createElement('img', { src, alt, width, height, className });
function compile(path, imports) {
  const source=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const context={exports:{},React,require:name=>{if(name==='react')return imports.react??React; if(name==='./checkout.css')return {}; if(!(name in imports))throw new Error(`Unexpected harness import: ${name}`);return imports[name];}};
  vm.runInNewContext(compiled,context);
  return context.exports;
}
const money=compile('src/lib/money.ts',{});
const shipping=compile('src/lib/checkout/shipping.ts',{});
const unavailable=compile('src/app/checkout/checkout-unavailable.tsx',{'next/link':link});
const client=compile('src/app/checkout/checkout-form-client.tsx',{'next/link':link,'next/image':image,'@/lib/money':money,'react-dom':{useFormStatus}});
const loading=compile('src/app/checkout/loading.tsx',{});

export function checkoutSubmitGuardFixture(props) {
  const hooks={...React,useState:value=>[typeof value==='function'?value():value,()=>{}],useRef:value=>({current:value}),useEffect:()=>{}};
  const component=compile('src/app/checkout/checkout-form-client.tsx',{'react':hooks,'next/link':link,'next/image':image,'@/lib/money':money,'react-dom':{useFormStatus}});
  // Invoke only the actual component's synchronous submit guard. Never invoke
  // its server action, requestSubmit(), submit(), or a browser submit event.
  return component.CheckoutFormClient(props).props.onSubmit;
}

export async function checkoutRenderFixture(options={}) {
  const renderedClient=options.pending?compile('src/app/checkout/checkout-form-client.tsx',{'next/link':link,'next/image':image,'@/lib/money':money,'react-dom':{useFormStatus:()=>({pending:true})}}):client;
  const settings={fulfillment:{shipping_fee_minor:15000,free_shipping_threshold_minor:500000,allow_store_pickup:true,pickup_address:'Configured QA pickup location'},payment:{cod_enabled:true,cod_max_minor:100000,gcash_enabled:true,gcash_number:'not-rendered',gcash_account_name:'not-rendered'}};
  if(options.noPayment)settings.payment.gcash_enabled=false;
  const subtotal=options.subtotal??84999;
  const cart={id:'qa-cart',user_id:'qa-customer',subtotal_minor:subtotal,item_count:2,items:[1,2].map(n=>({id:`line-${n}`,product_name:options.longTitle?'A deliberately long 1968 product title to exercise wrapping without hiding the purchased item identity':'1968 QA Product',variant_name:'Black / M',quantity:1,line_total_minor:n===1?subtotal:0,image_path:'/images/1968-logo-cropped.webp',is_available:!options.staleStock}))};
  const addresses=options.noAddress?[]:[{id:'saved-address',recipient_name:'QA Customer',phone:'09123456789',address_line1:'1 Local QA Street',barangay:'QA Barangay',city_municipality:'Cebu City',province:'Cebu',postal_code:'6000',is_default:true}];
  const page=compile('src/app/checkout/page.tsx',{
    'node:crypto':{randomUUID},'next/navigation':{redirect:path=>{throw new Error(`REDIRECT:${path}`);}},'next/link':link,
    '@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:options.unauthenticated?undefined:'qa-customer'}}}),getUser:async()=>({data:{user:{id:'qa-customer',email:'customer@qa.1968.local'}}})}})},
    '@/lib/addresses/actions':{getCustomerAddresses:async()=>{if(options.addressError)throw new Error('READ_FAILED');return addresses;}},
    '@/lib/cart/actions':{getOrCreateCart:async()=>{if(options.cartError)throw new Error('READ_FAILED');return cart;}},
    '@/lib/checkout/actions':{processCheckout:async()=>{throw new Error('ORDER_SUBMISSION_FORBIDDEN_IN_QA');}},
    '@/lib/checkout/settings':{loadCheckoutSettings:async()=>{if(options.settingsError)throw new Error('READ_FAILED');return settings;}},
    '@/lib/checkout/shipping':shipping,'@/lib/money':money,'./checkout-form-client':renderedClient,'./checkout-unavailable':unavailable,
  });
  const tree=options.loading?React.createElement(loading.default):await page.default({searchParams:Promise.resolve({error:options.error})});
  return {tree, html:renderToStaticMarkup(tree), props: tree.props.children?.find?.(child=>child?.type===renderedClient.CheckoutFormClient)?.props};
}
