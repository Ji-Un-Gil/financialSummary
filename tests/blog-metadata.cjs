const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context=vm.createContext({document:{getElementById:()=>({}),createElement:()=>({set innerHTML(value){this.textContent=value;}})},DOMPurify:{sanitize:x=>x},marked:{parse:x=>x}});
let code=fs.readFileSync('assets/app.js','utf8').split("document.querySelector('.skip')")[0];
vm.runInContext(code,context);
function details(title,text){return vm.runInContext(`details(${JSON.stringify({title,status:'본문 수집 상태 참조'})},${JSON.stringify(text)})`,context);}
test('Writer generic title becomes actual topic titles',()=>{assert.equal(details('금융 뉴스','# 보고서\n- 수집 상태: 부분 수집\n## 1. 첫째 주제\n## 2. 둘째 주제').headline,'첫째 주제 · 둘째 주제');});
test('empty issue has an honest descriptive title',()=>{const d=details('금융 뉴스','- 수집 상태: 확인 가능 항목 없음');assert.equal(d.headline,'새 소식 검증 결과 · 수집 한계');assert.equal(d.status,'확인 가능 항목 없음');});
test('descriptive index remains fallback without article headings',()=>{assert.equal(details('정책 변경','## 오늘의 핵심\n본문').headline,'정책 변경');});
test('actual September reports yield specific archive titles',()=>{for(const date of ['18','19','20']){const d=details('금융 뉴스',fs.readFileSync(`briefings/2026/09/2026-09-${date}.md`,'utf8'));assert.notEqual(d.headline,'금융 뉴스');}});
