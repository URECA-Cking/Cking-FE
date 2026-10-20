import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {build} from 'vite'
import react from '@vitejs/plugin-react'
import {chromium} from '@playwright/test'
let browser,bundle,styles
const errors=[]
test.before(async()=>{
 const output=await build({configFile:false,plugins:[react()],logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production'),'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://event.test')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/eventDetailBrowser.jsx',import.meta.url)),name:'EventTest',formats:['iife']}}})
 const parts=(Array.isArray(output)?output[0]:output).output
 bundle=parts.find(x=>x.type==='chunk').code;styles=parts.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n')
 const executablePath=[process.env.HOME_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(existsSync)
 browser=await chromium.launch({headless:true,...executablePath?{executablePath}:{}})
})
test.after(async()=>{await browser?.close();assert.deepEqual(errors,[])})
async function screen({balance=5,description='Event introduction',status='OPEN',displayStatus='IN_PROGRESS',failDetail=false,width=375}={}){
 const p=await browser.newPage({viewport:{width,height:1000}})
 p.on('pageerror',e=>errors.push(e.message))
 await p.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
 await p.goto('http://localhost/event-test')
 await p.evaluate(({balance,description,status,displayStatus,failDetail})=>{
  window.calls=[];window.toasts=[];window.entryCode='SUCCESS';window.holdEntry=false
  const record={eventId:16,creatorId:1,title:'Event title',description,status,displayStatus,startAt:'2026-01-01T00:00:00Z',endAt:'2099-01-01T00:00:00Z',winnerCount:1,drawMethod:'WEIGHTED',myTicketBalance:balance,myCommonTicketBalance:0,prizes:[{prizeKey:'GRAND',displayName:'Grand prize',quantity:2,weight:99}]}
  window.fetch=async(url,options={})=>{
   const path=new URL(String(url),location.href).pathname,method=options.method??'GET'
   window.calls.push({path,method,body:options.body&&JSON.parse(options.body)})
   const reply=(data,code='SUCCESS',http=200)=>new Response(JSON.stringify({code,data}),{status:http})
   if(path==='/api/events/16/entries'){
    if(window.holdEntry)await new Promise(resolve=>window.releaseEntry=resolve)
    return reply({},window.entryCode)
   }
   if(path==='/api/events/16')return failDetail?reply(null,'SYSTEM_ERROR',500):reply(record)
   if(path==='/api/events/16/entry-status')return reply({eventId:16,participantCount:7,totalTicketCount:20,myTicketCount:0,realtime:true})
   if(path==='/api/creators')return reply({items:[{creatorId:1,creatorName:'Creator',slug:'creator',profileImageUrl:null}],totalPages:1})
   return reply(null)
  }
 },{balance,description,status,displayStatus,failDetail})
 await p.addStyleTag({content:styles});await p.addScriptTag({content:bundle})
 await p.getByRole('button',{name:failDetail?'다시 시도':'뒤로가기',exact:true}).waitFor()
 return p
}
const mainButton=p=>p.getByRole('button',{name:/장으로 응모하기|응모할 수 없는 상태예요/})
async function openConfirm(p){await mainButton(p).click();await p.getByRole('button',{name:/최종 응모하기/}).waitFor()}
const posts=p=>p.evaluate(()=>window.calls.filter(x=>x.method==='POST'))
test('detail UI removes decorations and keeps title/date/introduction/prizes on mobile and desktop',async()=>{
 for(const width of [375,1280]){
  const p=await screen({width})
  try{
   await p.getByText('Event title',{exact:true}).waitFor()
   for(const text of ['Raffle Detail','공식 아티스트 래플 이벤트','가중 난수 추첨','응모 상세 혜택','응모권 더 받기','당첨 발표는 앱 알림으로 개별 안내됩니다.'])assert.equal(await p.getByText(text,{exact:true}).count(),0,text)
   assert.equal(await p.getByText('이벤트 경품',{exact:true}).count(),1)
   assert.equal(await p.getByText('Grand prize',{exact:true}).count(),1)
   assert.equal(await p.getByText('2개',{exact:true}).count(),1)
   assert.equal(await p.getByText(/가중치/).count(),0)
   assert.equal(await p.getByText('응모 현황',{exact:true}).count(),0)
   assert.equal(await mainButton(p).textContent().then(x=>x.includes('🎟')),false)
    assert.equal(await p.getByText('크리에이터',{exact:true}).count(),0)
    assert.equal(await p.getByText('공용',{exact:true}).count(),0)
   const order=await p.getByText('Event introduction',{exact:true}).evaluate(el=>{const heading=document.querySelector('h2');return Boolean(heading.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)&&el.previousElementSibling.textContent.includes('마감')})
   assert.equal(order,true)
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   await openConfirm(p)
   assert.equal(await p.getByText('Raffle Confirmation',{exact:true}).count(),0)
   assert.equal(await p.getByRole('heading',{name:'응모 확인',exact:true}).count(),1)
   assert.equal(await p.getByRole('button',{name:'취소',exact:true}).isEnabled(),true)
    assert.equal(await p.getByRole('heading',{name:'응모 확인'}).evaluate(el=>el.closest('.fixed').querySelectorAll('img').length),1)
   assert.equal(await p.getByText('응모 완료 시 사용된 응모권은 취소 또는 환불이 불가합니다.',{exact:true}).count(),2)
   await p.getByRole('button',{name:'취소',exact:true}).click();assert.equal((await posts(p)).length,0)
  }finally{await p.close()}
 }
})
test('empty introduction and zero tickets keep empty layout and prevent requests',async()=>{
 const p=await screen({balance:0,description:null})
 try{
  await p.getByText('보유한 응모권이 없어 응모할 수 없어요.',{exact:true}).waitFor()
  assert.equal(await mainButton(p).isDisabled(),true)
  for(const label of ['크리에이터 미션 하러 가기','출석 미션 하러 가기'])assert.equal(await p.getByRole('link',{name:label}).count(),0)
  assert.equal(await p.getByText('Event introduction',{exact:true}).count(),0)
  assert.equal((await posts(p)).length,0)
 }finally{await p.close()}
})
test('submission stays explicit, prevents clicks while pending and preserves API body and success feedback',async()=>{
 const p=await screen()
 try{
  await p.getByText('Event title',{exact:true}).waitFor();await openConfirm(p)
  assert.equal((await posts(p)).length,0)
  await p.evaluate(()=>window.holdEntry=true)
  await p.getByRole('button',{name:/최종 응모하기/}).click()
  await p.getByText('응모 처리 중...',{exact:true}).waitFor()
  assert.equal(await p.getByRole('button',{name:/최종 응모하기|다시 시도/}).count(),0)
  assert.equal((await posts(p)).length,1)
  const request=(await posts(p))[0]
  assert.equal(request.path,'/api/events/16/entries');assert.equal(request.body.ticketCount,1);assert.equal(request.body.couponType,'CREATOR');assert.match(request.body.requestId,/^[0-9a-f-]{36}$/i)
  await p.evaluate(()=>window.releaseEntry())
  await p.waitForFunction(()=>window.toasts.includes('응모가 정상 완료되었습니다!'))
  assert.equal(await p.getByText('응모가 정상 완료되었습니다!',{exact:true}).count(),0)
  assert.equal(await p.getByRole('heading',{name:'응모 확인'}).evaluate(el=>el.closest('.fixed').querySelector('.bg-berry-tint')),null)
  assert.equal(await p.getByText('결과 코드: SUCCESS',{exact:true}).count(),0)
  assert.ok(await p.evaluate(()=>window.toasts.includes('응모가 정상 완료되었습니다!')))
 }finally{await p.close()}
})
test('uncertain failure can close and reopen then replay the same request',async()=>{
 const p=await screen()
 try{
  await p.getByText('Event title',{exact:true}).waitFor();await openConfirm(p)
  await p.evaluate(()=>window.entryCode='SYSTEM_ERROR')
  await p.getByRole('button',{name:/최종 응모하기/}).click()
  await p.getByText('서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',{exact:true}).waitFor()
  const first=(await posts(p))[0]
  await p.getByRole('button',{name:'닫기',exact:true}).last().click();await mainButton(p).click()
  await p.getByRole('button',{name:'다시 시도',exact:true}).waitFor()
  await p.evaluate(()=>window.entryCode='DUPLICATE_REPLAY')
  await p.getByRole('button',{name:'다시 시도',exact:true}).click()
  await p.waitForFunction(()=>window.toasts.includes('이미 접수된 응모예요. 중복으로 차감되지 않았습니다.'))
  assert.equal(await p.getByText('이미 접수된 응모예요. 중복으로 차감되지 않았습니다.',{exact:true}).count(),0)
  assert.deepEqual((await posts(p))[1],first)
 }finally{await p.close()}
})
for(const [status,displayStatus] of [['SCHEDULED','UPCOMING'],['CLOSED','CLOSED']])test(`unavailable ${displayStatus} keeps entry blocked`,async()=>{
 const p=await screen({status,displayStatus})
 try{await p.getByText('Event title',{exact:true}).waitFor();assert.equal(await mainButton(p).isDisabled(),true);assert.equal((await posts(p)).length,0)}finally{await p.close()}
})
test('detail request error keeps retry feedback',async()=>{
 const p=await screen({failDetail:true})
 try{await p.getByRole('button',{name:'다시 시도',exact:true}).waitFor();assert.equal((await posts(p)).length,0)}finally{await p.close()}
})

test('business rejection retains failure message and retry controls',async()=>{
 const p=await screen()
 try{
  await p.getByText('Event title',{exact:true}).waitFor();await openConfirm(p)
  await p.evaluate(()=>window.entryCode='INSUFFICIENT_BALANCE')
  await p.getByRole('button',{name:/최종 응모하기/}).click()
  await p.getByText('보유한 응모권이 부족해요.',{exact:true}).waitFor()
  assert.equal(await p.getByRole('button',{name:'다시 시도',exact:true}).isEnabled(),true)
  assert.equal((await posts(p)).length,1)
 }finally{await p.close()}
})
test('header back action remains available without its old title',async()=>{
 const p=await screen()
 try{
  await p.getByText('Event title',{exact:true}).waitFor()
  await p.getByRole('button',{name:'뒤로가기',exact:true}).click()
  await p.getByText('Previous page',{exact:true}).waitFor()
  assert.equal((await posts(p)).length,0)
 }finally{await p.close()}
})
