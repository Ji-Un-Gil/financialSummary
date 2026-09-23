import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from '../cloudflare-mcp/node_modules/miniflare/dist/src/index.js';
import {readFileSync} from 'node:fs';
test('persistent daily deduplication, independent articles, concurrent increments and request validation',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{modules:true,script:readFileSync(new URL('./worker.js',import.meta.url),'utf8'),compatibilityDate:'2026-09-18',durableObjects:{COUNTER:{className:'Counter',useSQLite:true}}}]}));
 try{
  const post=(id,article='2026-09-18',origin='https://ji-un-gil.github.io')=>mf.dispatchFetch('https://counter.test/counts',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id,post:article})});
  const id=crypto.randomUUID();
  let r=await (await post(id)).json();assert.equal(r.total,1);assert.equal(r.views,1);
  r=await (await post(id)).json();assert.equal(r.total,1);assert.equal(r.views,1);
  r=await (await post(id,'2026-09-19')).json();assert.equal(r.total,1);assert.equal(r.views,1);
  await Promise.all(Array.from({length:10},()=>post(crypto.randomUUID())));
  r=await (await mf.dispatchFetch('https://counter.test/counts?post=2026-09-18')).json();assert.equal(r.total,11);assert.equal(r.today,11);assert.equal(r.views,11);
  assert.equal((await post(id,'2026-09-18','https://other.example')).status,403);
  assert.equal((await post(id,'2026-00-00')).status,400);
  assert.equal((await post(id,'2026-02-30')).status,400);
  assert.equal((await post('bad')).status,400);
 }finally{await mf.dispose();}
});
