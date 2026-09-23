'use strict';
// Anonymous daily browser ID; no IP address or personal profile is stored by our counter.
const COUNTER_URL='https://financial-notes-counter.lak2577.workers.dev/counts';
let ephemeralCounterID;
function counterID(){
  const day=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  try{
    const old=JSON.parse(localStorage.getItem('finance-visit')||'null');
    if(old?.day===day&&typeof old.id==='string')return old.id;
    const record={day,id:crypto.randomUUID()};localStorage.setItem('finance-visit',JSON.stringify(record));return record.id;
  }catch{return ephemeralCounterID ||= crypto.randomUUID();}
}
async function updateCounter(post){
  const target=document.getElementById('post-views');
  try{
    const response=await fetch(COUNTER_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:counterID(),...(post?{post}:{})}),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('counter unavailable');
    const data=await response.json();
    if(![data.today,data.total].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('invalid counts');
    const site=document.getElementById('visit-counts');
    if(site)site.textContent=`오늘 방문 ${data.today.toLocaleString('ko-KR')} · 누적 방문 ${data.total.toLocaleString('ko-KR')}`;
    if(post&&target?.isConnected&&Number.isSafeInteger(data.views))target.textContent=`조회 ${data.views.toLocaleString('ko-KR')}`;
  }catch{
    const site=document.getElementById('visit-counts');if(site)site.textContent='방문 집계 연결 중단';
    if(target?.isConnected)target.textContent='조회수 일시 확인 불가';
  }
}
updateCounter();
