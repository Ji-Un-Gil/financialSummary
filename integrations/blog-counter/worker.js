const ORIGIN = 'https://ji-un-gil.github.io';
const dayOf = () => new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export class Counter {
  constructor(ctx) {
    this.storage=ctx.storage;
    this.sql=ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS counts (key TEXT PRIMARY KEY, value INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS seen (day TEXT, key TEXT, id TEXT, PRIMARY KEY(day,key,id))');
  }
  async fetch(request) {
    const url=new URL(request.url), day=dayOf();
    const input=request.method==='POST'?await request.json():null;
    const post=input?.post || url.searchParams.get('post');
    if(input) this.storage.transactionSync(()=>{
      this.sql.exec('DELETE FROM seen WHERE day < ?', day);
      for(const key of ['site',...(post?[`post:${post}`]:[])]) {
        const found=this.sql.exec('SELECT 1 FROM seen WHERE day=? AND key=? AND id=?',day,key,input.id).toArray();
        if(found.length) continue;
        this.sql.exec('INSERT INTO seen VALUES (?,?,?)',day,key,input.id);
        for(const countKey of [key,`${day}:${key}`])
          this.sql.exec('INSERT INTO counts VALUES (?,1) ON CONFLICT(key) DO UPDATE SET value=value+1',countKey);
      }
    });
    const count=key=>this.sql.exec('SELECT value FROM counts WHERE key=?',key).toArray()[0]?.value||0;
    return Response.json({day,total:count('site'),today:count(`${day}:site`),views:post?count(`post:${post}`):null});
  }
}
export default {
  async fetch(request,env) {
    const headers={'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Cache-Control':'no-store'};
    const reply=(body,status=200)=>new Response(body,{status,headers});
    const url=new URL(request.url);
    if(url.pathname!=='/counts')return reply('Not found',404);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
    if(!['GET','POST'].includes(request.method))return reply('Method not allowed',405);
    let post=url.searchParams.get('post');
    if(request.method==='POST') {
      if(request.headers.get('Origin')!==ORIGIN)return reply('Forbidden',403);
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply('JSON required',415);
      const raw=await request.text();if(raw.length>256)return reply('Too large',413);
      let input;try{input=JSON.parse(raw);}catch{return reply('Invalid JSON',400);}
      if(!input||!/^[a-f0-9-]{36}$/.test(input.id||''))return reply('Invalid ID',400);
      post=input.post;
      request=new Request(request.url,{method:'POST',body:JSON.stringify({id:input.id,post})});
    }
    if(post && (!/^20\d{2}-\d{2}-\d{2}$/.test(post)||post<'2026-09-15'||post>dayOf()||!Number.isFinite(Date.parse(post))||new Date(post).toISOString().slice(0,10)!==post))return reply('Invalid post',400);
    const result=await env.COUNTER.get(env.COUNTER.idFromName('financial-notes')).fetch(request);
    return new Response(result.body,{status:result.status,headers:{...headers,'Content-Type':'application/json'}});
  }
};
