'use strict';
const RAW = 'https://raw.githubusercontent.com/Ji-Un-Gil/financialSummary/master/';
const REPO = 'https://github.com/Ji-Un-Gil/financialSummary/blob/master/';
const main = document.getElementById('main');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache = new Map();
let posts = [], revision = 0, archivePage = 1, searchTerm = '', month = '';
async function read(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = (async () => {
    const response = await fetch(RAW + path, {cache:'no-cache', signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new Error(`문서를 불러오지 못했습니다 (${response.status}).`);
    return response.text();
  })();
  cache.set(path,promise);
  try { return await promise; } catch (error) { cache.delete(path); throw error; }
}
function parseIndex(text) {
  const result = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(20\d{2}-\d{2}-\d{2})\s*\|\s*\[([^\]]+)\]\((\d{4}\/\d{2}\/20\d{2}-\d{2}-\d{2}\.md)\)\s*\|\s*([^|]+)\|/);
    if (!m || m[3] !== `${m[1].slice(0,4)}/${m[1].slice(5,7)}/${m[1]}.md`) continue;
    result.set(m[1], {date:m[1],title:m[2],path:'briefings/'+m[3],status:m[4].trim()});
  }
  return [...result.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
function plain(markdown) {
  const el=document.createElement('div');
  el.innerHTML=DOMPurify.sanitize(marked.parse(markdown));
  return el.textContent.trim();
}
function details(post,text) {
  const status=text.match(/^- 수집 상태:\s*(.+)$/m)?.[1];
  const summary=text.match(/(?:^|\n)## 오늘의 핵심[^\S\n]*\n([\s\S]*?)(?=\n## |$)/)?.[1] || '';
  const headings=[...text.matchAll(/^##\s+\d+[.)]\s*(.+)$/gm)].map(m=>m[1]);
  return {...post,status:status?plain(status):post.status,summary:plain(summary),summaryMarkdown:summary,headline:post.title==='금융 뉴스'&&headings.length?headings.join(' · '):post.title};
}
function shortStatus(status) {return status.includes('부분')?'부분 수집':status.includes('없음')?'확인 가능 항목 없음':status.includes('정상')?'정상 수집':'수집 상태는 본문 참조';}
function postURL(date,evidence=false){return `#/${evidence?'evidence':'post'}/${date}`;}
function title(text){document.title=text+' · 금융 노트';}
function setNav(route){document.querySelectorAll('[data-nav]').forEach(a=>{a.removeAttribute('aria-current');if(a.dataset.nav===route)a.setAttribute('aria-current','page');});}
function renderMarkdown(text,path,container){
  container.innerHTML=DOMPurify.sanitize(marked.parse(text),{FORBID_TAGS:['style','iframe','form','input','button'],FORBID_ATTR:['style']});
  container.querySelectorAll('a[href]').forEach(a=>{
    const original=a.getAttribute('href');
    if(original.startsWith('#')) return;
    const url=new URL(original,RAW+path);
    const match=url.pathname.match(/\/(briefings|evidence)\/\d{4}\/\d{2}\/(20\d{2}-\d{2}-\d{2})\.md$/);
    if(url.origin==='https://raw.githubusercontent.com'&&url.pathname.startsWith('/Ji-Un-Gil/financialSummary/master/')&&match){a.href=postURL(match[2],match[1]==='evidence');}
    else { a.href=url.href; a.rel='noopener noreferrer'; }
  });
  container.querySelectorAll('table').forEach(table=>{const wrap=document.createElement('div');wrap.className='table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','표 · 가로로 스크롤할 수 있습니다');table.before(wrap);wrap.append(table);});
  container.querySelectorAll('img').forEach(img=>{const url=new URL(img.getAttribute('src'),RAW+path);if(url.origin!==location.origin)img.replaceWith(document.createTextNode(img.alt||'[외부 이미지: 원문에서 확인]'));});
}
async function home(token){
  setNav('home');title('오늘의 금융을 차근차근');
  main.innerHTML=`<section class="hero"><div><div class="eyebrow">A LITTLE CLEARER, EVERY DAY</div><h1>오늘의 금융을<br><em>차근차근</em> 읽는 시간.</h1><p>핵심 뉴스부터 낯선 용어까지.<br>확인한 사실과 쉬운 설명을 한 장의 노트에 담습니다.</p></div><aside class="hero-note"><strong>매일 저녁, 금융 노트</strong><p>18:30 수집 시작 · 한국시간<br>원문을 확인한 뒤 발행합니다.<br>근거가 부족한 내용은 싣지 않습니다.</p></aside></section><div id="latest"><div class="loading">최신 글을 불러오는 중…</div></div><section aria-labelledby="archive-title"><div class="section-heading"><h2 id="archive-title">지난 금융 노트</h2><span>날짜별로 차곡차곡</span></div><div class="filters"><label class="search"><span class="sr-only">목록 제목 또는 날짜 검색</span><input id="search" type="search" placeholder="목록 제목 또는 날짜 검색" value="${esc(searchTerm)}"></label><label><span class="sr-only">발행 월</span><select id="month"><option value="">모든 달</option>${[...new Set(posts.map(p=>p.date.slice(0,7)))].map(m=>`<option value="${m}" ${m===month?'selected':''}>${m.replace('-','년 ')}월</option>`).join('')}</select></label></div><div id="results" aria-live="polite"></div><div class="cards" id="cards"></div><div class="pagination" id="pagination"></div></section><aside class="notice"><strong>확인한 만큼만 씁니다.</strong><p>일부 자료만 확인한 날은 ‘부분 수집’으로 표시합니다. 각 글의 출처와 수집 한계, 검증 기록을 함께 읽어주세요.</p></aside>`;
  document.getElementById('search').addEventListener('input',e=>{searchTerm=e.target.value;archivePage=1;renderCards();});
  document.getElementById('month').addEventListener('change',e=>{month=e.target.value;archivePage=1;renderCards();});
  renderCards();
  if(!posts.length){document.getElementById('latest').innerHTML='<p class="empty">아직 발행된 금융 노트가 없습니다.</p>';return;}
  const p=posts[0];let d=p;
  try{d=details(p,await read(p.path));}catch{d={...p,summary:'본문을 불러오지 못했습니다. 글을 열어 다시 확인해주세요.'};}
  if(token!==revision)return;
  document.getElementById('latest').innerHTML=`<div class="issue-label"><span>가장 최근의 노트</span><span>${esc(p.date.replaceAll('-','.'))}</span></div><article class="featured"><div class="feature-content"><span class="date">${esc(p.date)}</span><span class="badge">${esc(shortStatus(d.status))}</span><h2><a href="${postURL(p.date)}">${esc(d.headline||p.title)}</a></h2><div class="feature-summary" id="feature-summary"></div><a class="read-link" href="${postURL(p.date)}">오늘의 노트 읽기 <span aria-hidden="true">↗</span></a></div><div class="feature-art" aria-hidden="true"><div class="paper-stack"><b>${p.date.slice(5,7)} /<br>${p.date.slice(8)}</b><span>FINANCE NOTES</span><i class="paper-line"></i><i class="paper-line"></i><div class="seal">금융 노트</div></div></div></article>`;
  const summaryBox=document.getElementById('feature-summary');
  if(d.summaryMarkdown)renderMarkdown(d.summaryMarkdown,p.path,summaryBox);else summaryBox.textContent=d.summary||'';
}
function renderCards(){
  const list=posts.filter(p=>(p.title+' '+p.date).toLowerCase().includes(searchTerm.toLowerCase())&&p.date.startsWith(month));
  const pages=Math.max(1,Math.ceil(list.length/9));archivePage=Math.min(archivePage,pages);
  document.getElementById('results').textContent=`${list.length}개의 노트`;
  document.getElementById('results').className='eyebrow';
  document.getElementById('cards').innerHTML=list.length?list.slice((archivePage-1)*9,archivePage*9).map(p=>`<article class="card"><div class="card-meta"><time class="date" datetime="${p.date}">${p.date.replaceAll('-','.')}</time><span class="badge">${esc(shortStatus(p.status))}</span></div><h3><a href="${postURL(p.date)}">${esc(p.title)}</a></h3><p>핵심 소식과 쉬운 설명, 출처를 함께 읽어보세요.</p><a class="card-bottom" href="${postURL(p.date)}">노트 펼쳐보기 ↗</a></article>`).join(''):'<p class="empty">검색 결과가 없습니다. 다른 날짜나 제목으로 찾아보세요.</p>';
  document.getElementById('pagination').innerHTML=pages>1?`<button id="prev" ${archivePage===1?'disabled':''}>이전</button><span>${archivePage} / ${pages}</span><button id="next" ${archivePage===pages?'disabled':''}>다음</button>`:'';
  document.getElementById('prev')?.addEventListener('click',()=>{archivePage--;renderCards();});document.getElementById('next')?.addEventListener('click',()=>{archivePage++;renderCards();});
}
async function article(date,isEvidence,token){
  const post=posts.find(p=>p.date===date);if(!post)throw new Error('발행 목록에 없는 날짜입니다. 목록에서 글을 선택해주세요.');
  const path=isEvidence?post.path.replace('briefings/','evidence/'):post.path;
  const text=await read(path);if(token!==revision)return;
  const d=isEvidence?post:details(post,text),heading=isEvidence?`${date} 검증 기록`:(d.headline||d.title);
  title(heading);setNav('');
  main.innerHTML=`<a class="back" href="#/">← 모든 금융 노트</a><div class="article-shell"><article><header class="article-top"><div class="eyebrow">${isEvidence?'SOURCES & EVIDENCE':'DAILY FINANCE NOTE'}</div><time class="date">${date}</time><h1>${esc(heading)}</h1>${!isEvidence?`<span class="badge">${esc(d.status)}</span>`:''}<div class="article-actions"><a class="button" href="${postURL(date,!isEvidence)}">${isEvidence?'← 보고서 읽기':'검증 기록 보기'}</a><a class="button" href="${REPO+path}">GitHub 원문 ↗</a><button class="button" id="copy-link">링크 복사</button><button class="button" id="print">인쇄</button><span id="copy-status" role="status"></span></div></header><div class="prose" id="article-body"></div><nav class="article-neighbors" aria-label="다른 날짜의 글"></nav></article><aside class="sidebar"><div class="sticky"><h2>이 노트의 목차</h2><ul class="toc" id="toc"></ul><div class="side-note">출처는 각 문장 가까이에 있습니다. 수집 한계와 정정 기록도 함께 확인해주세요.</div></div></aside></div>`;
  const body=document.getElementById('article-body');renderMarkdown(text.replace(/^# .+\n/,''),path,body);
  const headings=[...body.querySelectorAll('h2')];headings.forEach((h,i)=>h.id=`section-${i}`);
  document.getElementById('toc').innerHTML=headings.map((h,i)=>`<li><a href="#section-${i}" data-section="section-${i}">${esc(h.textContent)}</a></li>`).join('');
  document.querySelectorAll('[data-section]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();document.getElementById(a.dataset.section).scrollIntoView();}));
  const i=posts.indexOf(post);document.querySelector('.article-neighbors').innerHTML=`<span>${posts[i+1]?`<a href="${postURL(posts[i+1].date)}">← ${posts[i+1].date} 노트</a>`:''}</span><span>${posts[i-1]?`<a href="${postURL(posts[i-1].date)}">${posts[i-1].date} 노트 →</a>`:''}</span>`;
  document.getElementById('copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);document.getElementById('copy-status').textContent='복사했습니다.';}catch{document.getElementById('copy-status').textContent='주소창의 링크를 복사해주세요.';}};
  document.getElementById('print').onclick=()=>window.print();
}
async function about(token){
  title('읽기 안내');setNav('about');
  const policy=await read('docs/editorial-policy.md');if(token!==revision)return;
  main.innerHTML='<section class="about"><div class="eyebrow">ABOUT FINANCE NOTES</div><h1>쉽게 읽고, 근거를 확인하는<br>금융 노트.</h1><p class="about-intro">매일 저장한 금융 요약을 모았습니다. 어려운 용어는 풀어 쓰고, 확인한 사실에는 출처를 붙입니다.</p><div class="notice"><p>매일 18:30(한국시간)에 수집을 시작합니다. 기본 마감은 18:00이며 실제 발행은 검증이 끝난 뒤입니다. 자료가 부족하거나 실행이 지연된 경우 글에 그 범위를 밝힙니다.</p></div><div class="prose" id="policy"></div></section>';
  renderMarkdown(policy,'docs/editorial-policy.md',document.getElementById('policy'));
}
async function route(){
  const token=++revision;main.innerHTML='<div class="loading" role="status">금융 노트를 불러오고 있습니다…</div>';
  try{
    if(!posts.length)posts=parseIndex(await read('briefings/README.md'));
    if(token!==revision)return;
    const hash=location.hash||'#/';const match=hash.match(/^#\/(post|evidence)\/(20\d{2}-\d{2}-\d{2})$/);
    if(match)await article(match[2],match[1]==='evidence',token);
    else if(hash==='#/about')await about(token);
    else if(hash==='#/'||hash==='#')await home(token);
    else throw new Error('찾을 수 없는 페이지입니다.');
    if(token===revision){window.scrollTo(0,0);main.focus({preventScroll:true});}
  }catch(error){if(token!==revision)return;main.innerHTML=`<div class="error" role="alert"><h1>잠시 읽어오지 못했어요.</h1><p>${esc(error.message)}</p><button class="button" id="retry">다시 불러오기</button> <a class="button" href="#/">목록으로</a><p><a href="${REPO}briefings/README.md">GitHub에서 발행 목록 보기 ↗</a></p></div>`;document.getElementById('retry').onclick=()=>{cache.clear();posts=[];route();};}
}
document.querySelector('.skip').addEventListener('click',e=>{e.preventDefault();main.focus();});
window.addEventListener('hashchange',route);
route();
