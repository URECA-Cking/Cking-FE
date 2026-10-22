import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const validKey = /^PRIZE_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
let browser, bundle, css
const pageErrors=[]
test.before(async()=>{
  const output=await build({configFile:false,plugins:[react()],logLevel:'silent',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://event.test'),'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/eventPrizeKeysBrowser.jsx',import.meta.url)),name:'EventTest',formats:['iife']}}})
  const assets=(Array.isArray(output)?output[0]:output).output
  bundle=assets.find(x=>x.type==='chunk').code
  css=assets.find(x=>x.type==='asset' && x.fileName.endsWith('.css')).source
  const paths=[process.env.QUIZ_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean)
  browser=await chromium.launch({headless:true,...paths.find(existsSync)?{executablePath:paths.find(existsSync)}:{}})
})
test.after(async()=>{await browser?.close();assert.deepEqual(pageErrors,[])})
/** 실제 Web 스타일과 모의 API로 이벤트 생성·수정 화면을 연다. */
async function screen(prizes=null) {
  const page=await browser.newPage()
  page.on('pageerror',error=>pageErrors.push(error.message))
  await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
  await page.goto('http://localhost/event-form')
  await page.evaluate(prizes=>{
    window.eventPath=prizes===null?'/creator/events/new':'/creator/events/16/edit'
    window.calls=[];window.toasts=[];window.failWrites=true;window.uuidSequence=[];window.uuidCalls=0
    Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=>{
      window.uuidCalls++
      return window.uuidSequence.shift()??`00000000-0000-4000-8000-${String(window.uuidCalls).padStart(12,'0')}`
    }})
    window.fetch=async(url,options={})=>{
      const path=new URL(url).pathname,method=options.method??'GET'
      window.calls.push({path,method,body:options.body?JSON.parse(options.body):undefined})
      const response=(data,status=200,code='SUCCESS')=>new Response(JSON.stringify({code,data}),{status})
      if(method==='POST'||method==='PATCH')return window.failWrites?response(null,500,'SYSTEM_ERROR'):response({eventId:16})
      if(path==='/api/creator/space')return response(null)
      if(path==='/api/creator/events' && window.eventRead) {
        const data=await window.eventRead()
        window.completedEventReads=(window.completedEventReads??0)+1
        return response(data)
      }
      if(path==='/api/creator/events')return response({items:[{eventId:16,title:'기존 이벤트',description:'기존 설명',drawMethod:'UNIFORM',prizeAlgorithmVersion:'PRIZE_WEIGHTED_V1',winnerCount:1,startAt:'2030-01-01T01:00:00Z',endAt:'2030-02-01T01:00:00Z',prizes}],hasNext:false})
      throw Error(path)
    }
  },prizes)
  await page.addStyleTag({content:css})
  await page.addScriptTag({content:bundle})
  await page.getByRole('textbox',{name:'상품 1 이름',exact:true}).waitFor()
  if(prizes===null)await page.getByRole('textbox',{name:'제목',exact:false}).fill('새 이벤트')
  return page
}
const field=(p,n,name)=>p.getByRole(name==='이름'?'textbox':'spinbutton',{name:`상품 ${n} ${name}`,exact:true})
/** 새 상품의 필수 숫자 항목을 유효한 값으로 채운다. */
async function fillPrizeNumbers(p,n,priority='1',weight='100',quantity='1') {
  await field(p,n,'순위').fill(priority)
  await field(p,n,'가중치').fill(weight)
  await field(p,n,'수량').fill(quantity)
}
const writes=p=>p.evaluate(()=>window.calls.filter(c=>c.method==='POST'||c.method==='PATCH'))
async function submit(p,edit=false){await p.getByRole('button',{name:edit?'수정 저장':'이벤트 초안 작성',exact:true}).click()}
async function failed(p,count,edit=false){await submit(p,edit);await p.waitForFunction(count=>window.calls.filter(c=>c.method==='POST'||c.method==='PATCH').length===count,count);await p.getByRole('button',{name:edit?'수정 저장':'이벤트 초안 작성',exact:true}).waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('button[disabled]'))}
const original=[{prizeKey:'GRAND',displayName:'대상',priority:3,weight:15,quantity:2},{prizeKey:'Silver_2',displayName:'은상',priority:7,weight:25,quantity:3}]

test('신규 첫 상품은 자동 UUID 키를 보내며 키 입력만 제거하고 기존 네 필드를 유지한다',async()=>{
  const p=await screen();try{
    for(const [name,label] of [['이름','상품 이름'],['순위','순위'],['가중치','가중치'],['수량','수량']]){
      const text=await field(p,1,name).evaluate(el=>el.labels?.[0]?.textContent)
      assert.equal(text.replace(/\s+/g,' ').trim(),`${label} *`)
    }
    for(const name of ['순위','가중치','수량'])assert.equal(await field(p,1,name).inputValue(),'')
    await fillPrizeNumbers(p,1)
    await failed(p,1)
    const request=(await writes(p))[0]
    assert.equal(request.method,'POST');assert.equal(request.path,'/api/creator/events')
    assert.match(request.body.prizes[0].prizeKey,validKey);assert.ok(request.body.prizes[0].prizeKey.length<=100)
    assert.equal(await p.getByRole('textbox',{name:/상품 .* 키/}).count(),0)
    assert.equal(await field(p,1,'이름').inputValue(),'1등 상품')
    assert.equal(await field(p,1,'순위').inputValue(),'1');assert.equal(await field(p,1,'가중치').inputValue(),'100');assert.equal(await field(p,1,'수량').inputValue(),'1')
    await p.getByRole('button',{name:'+ 상품 등급 추가',exact:true}).click()
    for(const name of ['순위','가중치','수량'])assert.equal(await field(p,2,name).inputValue(),'')
    await field(p,2,'이름').fill('추가 상품');await fillPrizeNumbers(p,2,'2');await failed(p,2)
    const keys=(await writes(p))[1].body.prizes.map(x=>x.prizeKey)
    assert.equal(new Set(keys.map(x=>x.toLowerCase())).size,2);keys.forEach(k=>assert.match(k,validKey))
  }finally{await p.close()}
})

test('입력 변경·저장 실패·재시도는 기존 키와 생성 requestId를 유지한다',async()=>{
  const p=await screen();try{
    await fillPrizeNumbers(p,1)
    await failed(p,1);const first=(await writes(p))[0].body
    for(const [name,value] of [['이름','바뀐 상품'],['순위','8'],['가중치','36'],['수량','9']])await field(p,1,name).fill(value)
    await failed(p,2);const second=(await writes(p))[1].body
    assert.equal(second.prizes[0].prizeKey,first.prizes[0].prizeKey);assert.equal(second.requestId,first.requestId)
    assert.deepEqual({...second.prizes[0],prizeKey:undefined},{prizeKey:undefined,displayName:'바뀐 상품',priority:8,weight:36,quantity:9})
    await failed(p,3);assert.deepEqual((await writes(p))[2].body,second)
    await p.evaluate(()=>window.failWrites=false);await submit(p)
    await p.getByRole('dialog',{name:'바로 승인 요청을 보내시겠습니까?'}).getByRole('button',{name:'나중에'}).click()
    await p.getByText('저장 완료',{exact:true}).waitFor()
    assert.deepEqual((await writes(p))[3].body,second)
  }finally{await p.close()}
})
for(const prizes of [original,[...original].reverse()])test(`기존 키는 서버 배열 순서 ${prizes[0].prizeKey}와 필드 변경·반복 PATCH 후에도 유지한다`,async()=>{
  const p=await screen(prizes);try{
    await field(p,1,'이름').fill('수정 상품');await field(p,1,'순위').fill('12');await field(p,1,'가중치').fill('45');await field(p,1,'수량').fill('6')
    await failed(p,1,true);await failed(p,2,true)
    const [first,second]=await writes(p)
    assert.equal(first.method,'PATCH');assert.equal(first.path,'/api/creator/events/16');assert.equal(first.body.drawMethod,'UNIFORM');assert.equal(first.body.prizeAlgorithmVersion,'PRIZE_WEIGHTED_V1')
    assert.deepEqual(first.body.prizes.map(x=>x.prizeKey),prizes.map(x=>x.prizeKey));assert.deepEqual(first.body,second.body)
    assert.deepEqual(first.body.prizes[0],{prizeKey:prizes[0].prizeKey,displayName:'수정 상품',priority:12,weight:45,quantity:6})
  }finally{await p.close()}
})

test('삭제한 키는 재사용하지 않고 남은 상품 DOM과 키를 보존한다',async()=>{
  const p=await screen();try{
    await fillPrizeNumbers(p,1)
    await p.getByRole('button',{name:'+ 상품 등급 추가',exact:true}).click();await field(p,2,'이름').fill('남길 상품');await fillPrizeNumbers(p,2,'2');await failed(p,1)
    const keys=(await writes(p))[0].body.prizes.map(x=>x.prizeKey)
    await field(p,2,'이름').evaluate(el=>window.remainingInput=el)
    await p.getByRole('button',{name:'상품 등급 삭제',exact:true}).first().click()
    assert.equal(await field(p,1,'이름').evaluate(el=>el===window.remainingInput),true)
    await p.evaluate(keys=>window.uuidSequence=[keys[0].slice(6),'00000000-0000-4000-8000-000000000099'],keys)
    await p.getByRole('button',{name:'+ 상품 등급 추가',exact:true}).click();await field(p,2,'이름').fill('다시 추가');await fillPrizeNumbers(p,2,'2');await failed(p,2)
    const next=(await writes(p))[1].body.prizes.map(x=>x.prizeKey)
    assert.equal(next[0],keys[1]);assert.equal(next[1],`PRIZE_${uuid(99)}`);assert.ok(!next.includes(keys[0]))
  }finally{await p.close()}
})
test('기존 키와 대소문자만 다른 UUID 충돌은 새 UUID로 재생성한다',async()=>{
  const key=`prize_${uuid(10)}`
  const p=await screen([{...original[0],prizeKey:key}]);try{
    await p.evaluate(()=>window.uuidSequence=['00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011'])
    await p.getByRole('button',{name:'+ 상품 등급 추가',exact:true}).click();await field(p,2,'이름').fill('신규');await fillPrizeNumbers(p,2,'2');await failed(p,1,true)
    assert.deepEqual((await writes(p))[0].body.prizes.map(x=>x.prizeKey),[key,`PRIZE_${uuid(11)}`])
  }finally{await p.close()}
})
test('UUID 충돌이 계속되면 유한 횟수 후 행 추가를 중단하고 기존 상품을 유지한다',async()=>{
  const p=await screen([{...original[0],prizeKey:`PRIZE_${uuid(10)}`}]);try{
    const before=await p.evaluate(()=>window.uuidCalls)
    await p.evaluate(()=>window.uuidSequence=Array(30).fill('00000000-0000-4000-8000-000000000010'))
    await p.getByRole('button',{name:'+ 상품 등급 추가',exact:true}).click()
    await p.getByText('상품을 추가하지 못했어요. 다시 시도해 주세요.',{exact:true}).waitFor()
    assert.equal(await p.getByRole('textbox',{name:/상품 .* 이름/}).count(),1)
    assert.equal(await p.evaluate(()=>window.uuidCalls)-before,16)
    await failed(p,1,true);assert.equal((await writes(p))[0].body.prizes[0].prizeKey,`PRIZE_${uuid(10)}`)
  }finally{await p.close()}
})

test('상품 없는 기존 이벤트의 첫 상품도 자동 키로 추가하며 PATCH 계약을 유지한다',async()=>{
  const p=await screen([]);try{
    await fillPrizeNumbers(p,1)
    await failed(p,1,true)
    const request=(await writes(p))[0]
    assert.match(request.body.prizes[0].prizeKey,validKey)
    assert.deepEqual(Object.keys(request.body.prizes[0]).sort(),['displayName','priority','prizeKey','quantity','weight'])
    assert.equal(request.body.requestId,undefined)
  }finally{await p.close()}
})
test('기존 이름·양수·총 수량 validation과 재렌더의 키 안정성을 유지한다',async()=>{
  const p=await screen();try{
    const calls=await p.evaluate(()=>window.uuidCalls)
    await field(p,1,'이름').fill('');await submit(p);await p.getByText('상품 이름을 입력해주세요.',{exact:true}).waitFor()
    await field(p,1,'이름').fill('확인 상품')
    await submit(p);await p.getByText('상품의 순위·가중치·수량을 모두 입력해주세요.',{exact:true}).waitFor()
    await fillPrizeNumbers(p,1)
    for(const name of ['순위','가중치','수량']){
      const old=await field(p,1,name).inputValue()
      await field(p,1,name).fill('0');await submit(p)
      await p.getByText('상품의 순위·가중치·수량은 1 이상의 정수여야 해요.',{exact:true}).waitFor()
      await field(p,1,name).fill(old)
    }
    await p.getByRole('spinbutton',{name:'당첨 인원',exact:false}).fill('2');await submit(p)
    await p.getByText('상품 총 수량(1개)이 당첨 인원(2명)보다 적어요.',{exact:true}).waitFor()
    assert.equal((await writes(p)).length,0)
    await field(p,1,'수량').fill('2');await failed(p,1)
    assert.equal(await p.evaluate(()=>window.uuidCalls),calls)
    const body=(await writes(p))[0].body
    assert.equal(body.drawMethod,'WEIGHTED');assert.equal(body.winnerCount,2);assert.match(body.requestId,/^[0-9a-f-]{36}$/)
  }finally{await p.close()}
})

test('신규 상품의 빈 숫자·소수 입력은 API 요청 전에 막고 수정 상품 값은 유지한다',async()=>{
  const p=await screen();try{
    for(const name of ['순위','가중치','수량']){
      await fillPrizeNumbers(p,1)
      await field(p,1,name).fill('')
      await submit(p)
      await p.getByText('상품의 순위·가중치·수량을 모두 입력해주세요.',{exact:true}).waitFor()
    }
    await fillPrizeNumbers(p,1,'1.5')
    await submit(p)
    await p.getByText('상품의 순위·가중치·수량은 1 이상의 정수여야 해요.',{exact:true}).waitFor()
    assert.equal((await writes(p)).length,0)
  }finally{await p.close()}

  const edit=await screen(original);try{
    assert.equal(await field(edit,1,'순위').inputValue(),'3')
    assert.equal(await field(edit,1,'가중치').inputValue(),'15')
    assert.equal(await field(edit,1,'수량').inputValue(),'2')
  }finally{await edit.close()}
})

test('기존 상품 숫자에 null 또는 undefined가 들어와도 빈 값 안내를 우선한다',async()=>{
  for(const value of [null,undefined]){
    const p=await screen([{...original[0],priority:value}]);try{
      await submit(p,true)
      await p.getByText('상품의 순위·가중치·수량을 모두 입력해주세요.',{exact:true}).waitFor()
      assert.equal((await writes(p)).length,0)
    }finally{await p.close()}
  }
})

test('좁은 화면에서 시작·종료의 날짜와 시간을 각 한 줄에 표시한다',async()=>{
  const p=await screen();try{
    await p.setViewportSize({width:320,height:740})
    const start=p.locator('#event-start'),end=p.locator('#event-end')
    const startBox=await start.boundingBox(),endBox=await end.boundingBox()
    assert.match(await start.inputValue(),/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    assert.ok(startBox.width>=250)
    assert.ok(endBox.y>startBox.y+startBox.height)
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  }finally{await p.close()}
})

async function navigateEvent(p, path) {
  await p.evaluate(path => window.navigateEvent(path), path)
  await p.waitForFunction(path => window.eventLocation === path, path)
}
const eventRecord = (id, key) => ({eventId:id,title:`Event ${id}`,description:'description',drawMethod:'UNIFORM',winnerCount:1,startAt:'2030-01-01T01:00:00Z',endAt:'2030-02-01T01:00:00Z',prizes:[{...original[0],prizeKey:key}]})

test('router event 16 -> 17 PATCH preserves EVENT17 instead of GRAND', async()=>{
  const p=await screen(original)
  try {
    await p.evaluate(events=>window.eventRead=async()=>({items:events,hasNext:false}),[eventRecord(16,'GRAND'),eventRecord(17,'EVENT17')])
    // Reload the list while retaining the same Router and component identity.
    await navigateEvent(p,'/creator/events/new')
    await navigateEvent(p,'/creator/events/16/edit')
    await field(p,1,'이름').waitFor()
    await navigateEvent(p,'/creator/events/17/edit')
    await field(p,1,'이름').waitFor()
    await failed(p,1,true)
    const request=(await writes(p))[0]
    assert.equal(request.path,'/api/creator/events/17')
    assert.equal(request.body.prizes[0].prizeKey,'EVENT17')
    assert.ok(!request.body.prizes.some(x=>x.prizeKey==='GRAND'))
  } finally {await p.close()}
})

test('router create/edit lifetimes isolate generated and reserved keys',async()=>{
  const p=await screen()
  try {
    await fillPrizeNumbers(p,1)
    await failed(p,1)
    const created=(await writes(p))[0].body
    await p.evaluate(events=>window.eventRead=async()=>({items:events,hasNext:false}),[eventRecord(16,`PRIZE_${uuid(10)}`),eventRecord(17,'Event17_Mixed')])
    await navigateEvent(p,'/creator/events/16/edit');await field(p,1,'이름').waitFor()
    await navigateEvent(p,'/creator/events/17/edit');await field(p,1,'이름').waitFor()
    await p.evaluate(()=>window.uuidSequence=['00000000-0000-4000-8000-000000000010'])
    await p.getByRole('button',{name:'+ 상품 등급 추가',exact:true}).click()
    await field(p,2,'이름').fill('new prize');await fillPrizeNumbers(p,2,'2');await failed(p,2,true)
    assert.deepEqual((await writes(p))[1].body.prizes.map(x=>x.prizeKey),['Event17_Mixed',`PRIZE_${uuid(10)}`])
    await navigateEvent(p,'/creator/events/new');await field(p,1,'이름').waitFor()
    await p.getByRole('textbox',{name:'제목',exact:false}).fill('new event')
    await fillPrizeNumbers(p,1)
    await failed(p,3)
    const next=(await writes(p))[2].body
    assert.equal(next.prizes.length,1)
    assert.notEqual(next.prizes[0].prizeKey,created.prizes[0].prizeKey)
    assert.notEqual(next.requestId,created.requestId)
  }finally{await p.close()}
})

test('late event 16 lookup cannot replace event 17 and loading exposes no old form',async()=>{
  const p=await screen()
  try {
    await p.evaluate(()=>window.eventRead=()=>new Promise(resolve=>{window.pendingReads??=[];window.pendingReads.push(resolve)}))
    await navigateEvent(p,'/creator/events/16/edit')
    await p.waitForFunction(()=>window.pendingReads?.length===1)
    assert.equal(await field(p,1,'이름').count(),0)
    await navigateEvent(p,'/creator/events/17/edit')
    await p.waitForFunction(()=>window.pendingReads.length===2)
    assert.equal(await field(p,1,'이름').count(),0)
    await p.evaluate(event=>window.pendingReads[1]({items:[event],hasNext:false}),eventRecord(17,'EVENT17'))
    await field(p,1,'이름').waitFor()
    await p.evaluate(event=>{window.pendingReads[0]({items:[event],hasNext:false})},eventRecord(16,'GRAND'))
    await p.waitForFunction(()=>window.completedEventReads===2)
    await failed(p,1,true)
    assert.equal((await writes(p))[0].body.prizes[0].prizeKey,'EVENT17')
    assert.equal(await p.getByRole('textbox',{name:'제목',exact:false}).inputValue(),'Event 17')
  }finally{await p.close()}
})
