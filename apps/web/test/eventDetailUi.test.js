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
async function screen({guest=false,holdSpace=false,spaceFail=false,ownCreatorId=null,balance=5,description='Event introduction',status='OPEN',displayStatus='IN_PROGRESS',failDetail=false,width=375,endAt='2099-01-01T00:00:00Z',clockTime=null,myTicketCount=5,failStatus=false,prizes=[{prizeKey:'GRAND',displayName:'Grand prize',priority:1,quantity:2,weight:99}],winners=null,myWinners=[]}={}){
 const p=await browser.newPage({viewport:{width,height:1000}})
 p.on('pageerror',e=>errors.push(e.message))
 if(clockTime)await p.clock.install({time:new Date(clockTime)})
 await p.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
 await p.goto('http://localhost/event-test')
 await p.evaluate(({guest,holdSpace,spaceFail,ownCreatorId,balance,description,status,displayStatus,failDetail,endAt,myTicketCount,failStatus,prizes,winners,myWinners})=>{
  window.guest=guest;window.holdSpace=holdSpace;window.spaceFail=spaceFail;window.ownCreatorId=ownCreatorId;window.calls=[];window.toasts=[];window.entryCode='SUCCESS';window.holdEntry=false
  const record={eventId:16,creatorId:1,title:'Event title',description,status,displayStatus,startAt:'2026-01-01T00:00:00Z',endAt,winnerCount:1,drawMethod:'WEIGHTED',myTicketBalance:guest?null:balance,myCommonTicketBalance:guest?null:0,prizes}
  const acceptedRequests=new Set()
  window.fetch=async(url,options={})=>{
   const path=new URL(String(url),location.href).pathname,method=options.method??'GET'
   window.calls.push({path,method,body:options.body&&JSON.parse(options.body)})
   const reply=(data,code='SUCCESS',http=200)=>new Response(JSON.stringify({code,data}),{status:http})
   if(path==='/api/events/16/entries'){
    if(window.holdEntry)await new Promise(resolve=>window.releaseEntry=resolve)
    const request=JSON.parse(options.body)
    if(['SUCCESS','DUPLICATE_REPLAY'].includes(window.entryCode)&&!acceptedRequests.has(request.requestId)){
     acceptedRequests.add(request.requestId)
     myTicketCount+=request.ticketCount
     const balanceKey=request.couponType==='COMMON'?'myCommonTicketBalance':'myTicketBalance'
     record[balanceKey]-=request.ticketCount
    }
    return reply({},window.entryCode)
   }
   if(path==='/api/events/16'){
    if(window.holdBalance)await new Promise(resolve=>window.releaseBalance=resolve)
    return failDetail?(guest?reply(null,'UNAUTHORIZED',401):reply(null,'SYSTEM_ERROR',500)):reply({...record,myTicketBalance:window.nextBalance??record.myTicketBalance})
   }
   if(path==='/api/events/16/entry-status')return failStatus&&!window.retryStatus?reply(null,'SYSTEM_ERROR',500):reply({eventId:16,participantCount:7,totalTicketCount:20,myTicketCount,realtime:true})
   if(path==='/api/creator/space'){
    if(window.holdSpace)await new Promise(resolve=>window.releaseSpace=resolve)
    return window.spaceFail?reply(null,'SYSTEM_ERROR',500):reply({creatorId:window.ownCreatorId})
   }
   if(path==='/api/events/16/winners')return reply(winners)
   if(path==='/api/me/winners')return reply(myWinners)
   if(path==='/api/creators')return reply({items:[{creatorId:1,creatorName:'Creator',slug:'creator',profileImageUrl:null}],totalPages:1})
   return reply(null)
  }
 },{guest,holdSpace,spaceFail,ownCreatorId,balance,description,status,displayStatus,failDetail,endAt,myTicketCount,failStatus,prizes,winners,myWinners})
 await p.addStyleTag({content:styles});await p.addScriptTag({content:bundle})
 await p.getByRole('button',{name:failDetail?'다시 시도':'뒤로가기',exact:true}).waitFor()
 return p
}
const mainButton=p=>p.getByRole('button',{name:/^응모하기$|응모할 수 없는 상태예요/})
async function openConfirm(p){await mainButton(p).click();await p.getByRole('dialog').waitFor();const select=p.getByRole('button',{name:/^\d+장으로 응모하기$/});if(await select.count())await select.click();await p.getByRole('dialog',{name:'응모 확인',exact:true}).waitFor()}
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
   const order=await p.getByText('Event introduction',{exact:true}).evaluate(el=>{const heading=document.querySelector('h2');return Boolean(heading.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)})
   assert.equal(order,true)
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   await openConfirm(p)
   assert.equal(await p.getByText('Raffle Confirmation',{exact:true}).count(),0)
   assert.equal(await p.getByRole('dialog',{name:'응모 확인',exact:true}).count(),1)
   assert.equal(await p.getByRole('button',{name:'취소',exact:true}).isEnabled(),true)
    assert.equal(await p.getByRole('dialog',{name:'응모 확인'}).locator('img').count(),0)
    assert.equal(await p.getByRole('dialog',{name:'응모 확인'}).evaluate(el=>el.tagName),'DIALOG')
   assert.equal(await p.getByText('응모 완료 시 사용된 응모권은 취소 또는 환불이 불가합니다. 응모하시겠습니까?',{exact:true}).count(),1)
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
  await p.getByRole('button',{name:/응모 확정/}).click()
  await p.getByText('응모 처리 중...',{exact:true}).waitFor()
  assert.equal(await p.getByRole('button',{name:/응모 확정|다시 시도/}).count(),0)
  assert.equal((await posts(p)).length,1)
  const request=(await posts(p))[0]
  assert.equal(request.path,'/api/events/16/entries');assert.equal(request.body.ticketCount,1);assert.equal(request.body.couponType,'CREATOR');assert.match(request.body.requestId,/^[0-9a-f-]{36}$/i)
  assert.equal(await p.getByRole('dialog',{name:'응모 확인',exact:true}).isVisible(),true)
  await p.evaluate(()=>{window.holdBalance=true;window.nextBalance=3;window.releaseEntry()})
  await p.waitForFunction(()=>typeof window.releaseBalance==='function')
  await p.waitForFunction(()=>window.toasts.includes('응모가 정상 완료되었습니다!'))
  assert.equal(await p.getByText('응모가 정상 완료되었습니다!',{exact:true}).count(),0)
  await p.getByRole('dialog',{name:'응모 확인',exact:true}).waitFor({state:'hidden'})
  assert.equal(await p.getByRole('dialog',{name:'응모 확인',exact:true}).count(),0)
  assert.equal(await p.getByText('결과 코드: SUCCESS',{exact:true}).count(),0)
  assert.ok(await p.evaluate(()=>window.toasts.includes('응모가 정상 완료되었습니다!')))
  await p.evaluate(()=>{window.holdBalance=false;window.releaseBalance()})
  await mainButton(p).click()
  await p.getByRole('radio',{name:/크리에이터 응모권/}).getByText('3장',{exact:true}).waitFor()
  assert.equal((await posts(p)).length,1)
  await p.getByRole('button',{name:'취소',exact:true}).click()
 }finally{await p.close()}
})
test('uncertain failure can close and reopen then replay the same request',async()=>{
 const p=await screen()
 try{
  await p.getByText('Event title',{exact:true}).waitFor();await openConfirm(p)
  await p.evaluate(()=>window.entryCode='SYSTEM_ERROR')
  await p.getByRole('button',{name:/응모 확정/}).click()
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
  await p.getByRole('button',{name:/응모 확정/}).click()
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


test('entry selection opens separately, preserves quantity on confirmation cancel and never submits early',async()=>{
 const p=await screen()
 try{
  await p.getByText('Event title',{exact:true}).waitFor()
  assert.equal(await p.getByRole('heading',{name:'사용할 응모권 수',exact:true}).count(),0)
  await p.getByText('마감까지',{exact:true}).waitFor()
  assert.equal((await p.getByRole('region',{name:'응모기간',exact:true}).textContent()).includes('2026'),false)
  await mainButton(p).click()
  await p.getByRole('button',{name:'응모권 1장 증가',exact:true}).click()
  await p.getByRole('button',{name:'2장으로 응모하기',exact:true}).click()
  await p.getByText('응모 완료 시 사용된 응모권은 취소 또는 환불이 불가합니다. 응모하시겠습니까?',{exact:true}).waitFor()
  assert.equal((await posts(p)).length,0)
  assert.equal(await p.getByRole('dialog').count(),1)
  await p.getByRole('button',{name:'취소',exact:true}).click()
  await p.getByRole('button',{name:'2장으로 응모하기',exact:true}).waitFor()
  assert.equal((await posts(p)).length,0)
  await p.getByRole('button',{name:'취소',exact:true}).click()
  assert.equal(await p.getByRole('dialog').count(),0)
 }finally{await p.close()}
})


test('deadline disables final confirmation while its popup stays open',async()=>{
 const p=await screen({clockTime:'2026-10-20T00:00:00Z',endAt:'2026-10-20T00:01:00Z'})
 try{
  await openConfirm(p)
  const confirm=p.getByRole('button',{name:'응모 확정',exact:true})
  assert.equal(await confirm.isEnabled(),true)
  await p.clock.fastForward(61000)
  await p.waitForFunction(()=>document.querySelector('dialog button:last-child')?.disabled)
  assert.equal(await confirm.isDisabled(),true)
  await confirm.dispatchEvent('click')
  assert.equal((await posts(p)).length,0)
 }finally{await p.close()}
})

test('submission checks current deadline before POST even before countdown renders',async()=>{
 const p=await screen({clockTime:'2026-10-20T00:00:00Z',endAt:'2026-10-20T00:01:00Z'})
 try{
  await openConfirm(p)
  await p.clock.setSystemTime(new Date('2026-10-20T00:01:01Z'))
  const confirm=p.getByRole('button',{name:'응모 확정',exact:true})
  assert.equal(await confirm.isEnabled(),true)
  await confirm.click()
  await p.waitForFunction(()=>window.toasts.includes('지금은 응모할 수 있는 상태가 아니에요.'))
  assert.equal((await posts(p)).length,0)
 }finally{await p.close()}
})

for(const reopen of [false,true])test(`uncertain request preserves identical UUID retry after deadline (reopen=${reopen})`,async()=>{
 const p=await screen({clockTime:'2026-10-20T00:00:00Z',endAt:'2026-10-20T00:01:00Z'})
 try{
  await openConfirm(p)
  await p.evaluate(()=>window.entryCode='SYSTEM_ERROR')
  await p.getByRole('button',{name:'응모 확정',exact:true}).click()
  await p.getByText('서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.',{exact:true}).waitFor()
  const first=(await posts(p))[0]
  if(reopen)await p.getByRole('button',{name:'닫기',exact:true}).click()
  await p.clock.fastForward(61000)
  if(reopen){
   assert.equal(await mainButton(p).isEnabled(),true)
   await mainButton(p).click()
  }
  await p.evaluate(()=>window.entryCode='DUPLICATE_REPLAY')
  await p.getByRole('button',{name:'다시 시도',exact:true}).click()
  await p.waitForFunction(()=>window.toasts.includes('이미 접수된 응모예요. 중복으로 차감되지 않았습니다.'))
  const requests=await posts(p)
  assert.equal(requests.length,2)
  assert.deepEqual(requests[1],first)
  await p.getByRole('dialog',{name:'응모 확인',exact:true}).waitFor({state:'hidden'})
 }finally{await p.close()}
})


for(const width of [375,1280])test(`detail shows my ticket total, countdown, entry period and draggable ranked prizes ${width}px`,async()=>{
 const p=await screen({width,myTicketCount:12,prizes:[{prizeKey:'THIRD',displayName:'Third prize',priority:3,quantity:3},{prizeKey:'FIRST',displayName:'First prize',priority:1,quantity:1},{prizeKey:'SECOND',displayName:'Second prize',priority:2,quantity:2}]})
 try{
  await p.getByRole('region',{name:'내 응모',exact:true}).getByText('12장',{exact:true}).waitFor()
  assert.equal(await p.getByText(/참여자|7명 참여/).count(),0)
  const order=await p.evaluate(()=>{
   const nodes=[document.querySelector('h2'),[...document.querySelectorAll('p')].find(x=>x.textContent==='Event introduction'),document.querySelector('[aria-label="내 응모"]'),document.querySelector('[role="timer"]'),document.querySelector('[aria-label="응모기간"]'),document.querySelector('[aria-label="이벤트 경품"]')]
   return nodes.every((el,i)=>el&&(i===0||Boolean(nodes[i-1].compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)))
  })
  assert.equal(order,true)
  const period=p.getByRole('region',{name:'응모기간',exact:true})
  assert.equal((await period.textContent()).includes('26.01'),false)
  const prizes=p.getByRole('region',{name:'이벤트 경품',exact:true})
  assert.deepEqual(await prizes.getByRole('listitem').allTextContents(),['redeem1등First prize1개','redeem2등Second prize2개','redeem3등Third prize3개'])
  assert.equal(await prizes.getByText(/가중치/).count(),0)
  await prizes.scrollIntoViewIfNeeded()
  assert.equal(await prizes.getByRole('button').count(),0)
  const slider=prizes.getByRole('list',{name:'경품 목록',exact:true})
  const box=await slider.boundingBox()
  await p.mouse.move(box.x+box.width*0.85,box.y+box.height/2)
  await p.mouse.down()
  await p.mouse.move(box.x+box.width*0.15,box.y+box.height/2,{steps:8})
  assert.ok(await slider.evaluate(el=>el.scrollLeft)>0)
  await p.mouse.up()
  await p.mouse.move(box.x+box.width*0.15,box.y+box.height/2)
  await p.mouse.down()
  await p.mouse.move(box.x+box.width*0.95,box.y+box.height/2,{steps:8})
  await p.mouse.up()
  await p.waitForFunction(()=>document.querySelector('[aria-label="이벤트 경품"] ul').scrollLeft===0)
  await slider.focus()
  await slider.press('ArrowRight')
  await p.waitForFunction(()=>document.querySelector('[aria-label="이벤트 경품"] ul').scrollLeft>0)
 }finally{await p.close()}
})

test('my entry query failure does not show a false zero and supports retry',async()=>{
 const p=await screen({failStatus:true,myTicketCount:8})
 try{
  const mine=p.getByRole('region',{name:'내 응모',exact:true})
  await mine.getByText('조회하지 못했어요.',{exact:true}).waitFor()
  assert.equal(await mine.getByText('0장',{exact:true}).count(),0)
  await p.evaluate(()=>window.retryStatus=true)
  await mine.getByRole('button',{name:'다시 확인',exact:true}).click()
  await mine.getByText('8장',{exact:true}).waitFor()
 }finally{await p.close()}
})


for(const theme of ['dark','light'])test(`accepted additional entries refresh my ticket total in ${theme} mode`,async()=>{
 const p=await screen({myTicketCount:5})
 try{
  await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
  const mine=p.getByRole('region',{name:'내 응모',exact:true})
  await mine.getByText('5장',{exact:true}).waitFor()
  for(const total of [6,7]){
   await openConfirm(p)
   await p.getByRole('button',{name:'응모 확정',exact:true}).click()
   await p.getByRole('dialog',{name:'응모 확인',exact:true}).waitFor({state:'hidden'})
   await mine.getByText(`${total}장`,{exact:true}).waitFor()
  }
  assert.equal((await posts(p)).length,2)
 }finally{await p.close()}
})

test('result-published event hides the closed-entry notice, closed event keeps it',async()=>{
 const notice=/응모가 마감된 이벤트예요/
 const closed=await screen({status:'CLOSED',displayStatus:'CLOSED'})
 try{
  await closed.getByText(notice).waitFor()
 }finally{await closed.close()}
 const published=await screen({status:'PUBLISHED',displayStatus:'CLOSED'})
 try{
  await published.getByRole('heading',{name:'당첨 결과',exact:true}).waitFor()
  assert.equal(await published.getByText(notice).count(),0)
 }finally{await published.close()}
})

test('creator cannot apply to their own event and the entry API is never called',async()=>{
 const p=await screen({ownCreatorId:1})
 try{
  const button=p.getByRole('button',{name:'내 이벤트에는 응모할 수 없어요',exact:true})
  await button.waitFor()
  assert.equal(await button.isDisabled(),true)
  assert.equal(await p.getByText('내가 만든 이벤트에는 응모할 수 없어요.',{exact:true}).count(),1)
  assert.deepEqual(await posts(p),[])
 }finally{await p.close()}
})
test('creator can still apply to another creator event',async()=>{
 const p=await screen({ownCreatorId:2})
 try{
  const button=p.getByRole('button',{name:'응모하기',exact:true})
  await button.waitFor()
  assert.equal(await button.isEnabled(),true)
 }finally{await p.close()}
})

test('entry stays blocked while the own space is being checked',async()=>{
 const p=await screen({ownCreatorId:2,holdSpace:true})
 try{
  const button=p.getByRole('button',{name:'응모할 수 없는 상태예요',exact:true})
  await button.waitFor()
  assert.equal(await button.isDisabled(),true)
  assert.equal(await p.getByText('내 이벤트인지 확인하는 중이에요.',{exact:true}).count(),1)
  await button.click({force:true}).catch(()=>{})
  assert.deepEqual(await posts(p),[])
  await p.evaluate(()=>window.releaseSpace())
  await p.getByRole('button',{name:'응모하기',exact:true}).waitFor()
 }finally{await p.close()}
})
test('failed own space check explains the failure and allows retry instead of staying blocked',async()=>{
 const p=await screen({ownCreatorId:2,spaceFail:true})
 try{
  await p.getByText('내 이벤트인지 확인하지 못했어요.',{exact:true}).waitFor()
  assert.equal(await p.getByText('내 이벤트인지 확인하는 중이에요.').count(),0)
  await p.evaluate(()=>{window.spaceFail=false})
  await p.getByRole('button',{name:'다시 확인',exact:true}).click()
  await p.getByRole('button',{name:'응모하기',exact:true}).waitFor()
 }finally{await p.close()}
})

test('guest can read the event detail, and applying sends them to login without personal API calls',async()=>{
 const p=await screen({guest:true})
 try{
  await p.getByText('Event title',{exact:true}).waitFor()
  assert.equal(await p.getByText('로그인하면 확인할 수 있어요',{exact:true}).count(),1)
  assert.equal(await p.getByText('보유한 응모권이 없어 응모할 수 없어요.').count(),0)
  const paths=await p.evaluate(()=>window.calls.map(x=>x.path))
  assert.equal(paths.includes('/api/events/16/entry-status'),false)
  assert.equal(paths.includes('/api/me/winners'),false)
  await p.getByRole('button',{name:'로그인하고 응모하기',exact:true}).click()
  await p.getByText('Login page',{exact:true}).waitFor()
  assert.deepEqual(await posts(p),[])
 }finally{await p.close()}
})

test('guest whose event detail request is rejected gets a login path instead of a dead end',async()=>{
 const p=await screen({guest:true,failDetail:true})
 try{
  await p.getByRole('button',{name:'로그인하고 확인하기',exact:true}).click()
  await p.getByText('Login page',{exact:true}).waitFor()
 }finally{await p.close()}
})

const drawWinner=(winnerId,drawNo,rank,name)=>({winnerId,drawNo,drawType:drawNo===0?'INITIAL':'REDRAW',rankInDrawing:rank,name,prizeDisplayName:'Grand prize'})
const myWinner=(winnerId,status)=>({winnerId,eventId:16,drawNo:0,drawType:'INITIAL',rankInDrawing:1,winnerManagementStatus:status})

test('재추첨이 있으면 당첨 결과를 회차별로 나누고, 포기한 내 행은 강조하지 않고 상태만 붙인다',async()=>{
 const winners={eventId:16,winners:[drawWinner(100,0,1,'테*트'),drawWinner(101,0,2,'김*수'),drawWinner(200,1,1,'이*진')]}
 const p=await screen({status:'PUBLISHED',displayStatus:'CLOSED',winners,myWinners:[myWinner(100,'DECLINED')]})
 try{
  const first=p.getByRole('region',{name:'최초 추첨',exact:true}),redraw=p.getByRole('region',{name:'재추첨',exact:true})
  await first.waitFor();await redraw.waitFor()
  // 행 순서는 그대로 검증하고 순위·이름·상품·상태는 각각 따로 본다. 행 전체 문자열로 비교하면 브라우저마다 달라지는 공백과,
  // 아이콘 폰트가 없을 때 글자로 보이는 아이콘 이름(block)에 기대게 된다.
  const rows=async loc=>{const items=loc.getByRole('listitem'),out=[];for(let i=0;i<await items.count();i++){const li=items.nth(i);out.push({rank:(await li.locator('span').first().innerText()).trim(),name:(await li.locator('p').nth(0).innerText()).trim(),prize:(await li.locator('p').nth(1).innerText()).trim(),declined:await li.getByText('당첨 포기').count()>0})}return out}
  assert.deepEqual(await rows(first),[{rank:'1',name:'테*트',prize:'Grand prize',declined:true},{rank:'2',name:'김*수',prize:'Grand prize',declined:false}])
  assert.deepEqual(await rows(redraw),[{rank:'1',name:'이*진',prize:'Grand prize',declined:false}])
  assert.equal(await redraw.getByText('결원이 생겨 다시 추첨했어요.').count(),1)
  // 포기한 내 행은 "나의 당첨" 강조가 아니라 상태 표시다.
  assert.equal(await p.getByText('나의 당첨',{exact:false}).count(),0)
  assert.doesNotMatch(await first.getByRole('listitem').first().getAttribute('class'),/border-primary/)
 }finally{await p.close()}
})

test('회차가 하나뿐이면 제목 없이 보여주고, 유효한 내 당첨은 계속 강조한다',async()=>{
 const winners={eventId:16,winners:[drawWinner(100,0,1,'테*트'),drawWinner(101,0,2,'김*수')]}
 const p=await screen({status:'PUBLISHED',displayStatus:'CLOSED',winners,myWinners:[myWinner(100,'SELECTED')]})
 try{
  const list=p.getByRole('region',{name:'당첨자',exact:true})
  await list.waitFor()
  assert.equal(await p.getByRole('heading',{name:/최초 추첨|재추첨/}).count(),0)
  assert.equal(await list.getByRole('listitem').count(),2)
  assert.match(await list.getByRole('listitem').first().innerText(),/나의 당첨/)
  assert.match(await list.getByRole('listitem').first().getAttribute('class'),/border-primary/)
  assert.equal(await p.getByText('당첨 포기').count(),0)
 }finally{await p.close()}
})
