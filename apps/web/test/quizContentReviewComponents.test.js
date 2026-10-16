import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {build} from 'vite'
import react from '@vitejs/plugin-react'
import {chromium} from '@playwright/test'
import {fileURLToPath} from 'node:url'
let bundle,browser
const initial={generationId:42,status:'RUNNING',reviewStage:'AWAITING_REVIEW',title:'검토 Quiz',questionCount:3,content:{aiContentText:'  AI 원문\n',facts:[{fact:'사실',evidenceType:'SPEECH',evidence:'근거',timestampStart:null,timestampEnd:null}],maxLength:50000}}
test.before(async()=>{
 const result=await build({configFile:false,plugins:[react()],logLevel:'silent',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://quiz.test'),'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/quizContentReviewBrowser.jsx',import.meta.url)),name:'ReviewTest',formats:['iife']}}})
 bundle=(Array.isArray(result)?result[0]:result).output.find(x=>x.type==='chunk').code
 const exe=[process.env.QUIZ_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].filter(Boolean).find(existsSync)
 browser=await chromium.launch({headless:true,...exe?{executablePath:exe}:{}})
})
test.after(async()=>browser?.close())
async function screen({active=initial,stored=false,draft=null,storageFail=false,omit=false}={}){
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message))
 await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
 await page.goto('http://localhost/quiz-content-review')
 await page.evaluate(({active,stored,draft,storageFail,omit})=>{
  localStorage.clear(); window.active=active;window.calls=[];window.failure=null;window.hold=false;window.delayed=null
  if(stored)localStorage.setItem('cking.creatorQuizJobs.v1.10',JSON.stringify({generation:{requestId:'00000000-0000-4000-8000-000000000001',input:{youtubeUrl:'https://youtu.be/dQw4w9WgXcQ',title:'검토 Quiz',questionCount:3},generationId:42,savedAt:Date.now()},judges:{}}))
  if(draft)localStorage.setItem('cking.creatorQuizReviewDraft.v1.10.42',JSON.stringify({generationId:42,...draft}))
  if(storageFail)Object.defineProperty(window,'localStorage',{value:{getItem(){throw Error()},setItem(){throw Error()},removeItem(){throw Error()}}})
  window.fetch=async(url,options={})=>{
   const path=new URL(url).pathname;const body=options.body?JSON.parse(options.body):null;window.calls.push({path,body,method:options.method})
   const response=(data,status=200,code='SUCCESS')=>new Response(JSON.stringify({code,...data===undefined?{}:{data}}),{status})
   if(options.method==='POST'){
    if(window.hold)await new Promise(resolve=>window.delayed=resolve)
    if(window.failure){const f=window.failure;if(f==='network')throw TypeError('Failed to fetch');return response(null,f.status,f.code)}
    if(path.endsWith('/cancel'))window.active={...window.active,status:'FAILED',failureCode:'CANCELLED'}
    else window.active={...window.active,reviewStage:'GENERATING',contentConfirmedAt:new Date().toISOString()}
    return response(window.active)
   }
   if(path.endsWith('/current'))return response(omit ? undefined : window.active)
   return response(window.active)
  }
 },{active,stored,draft,storageFail,omit})
 await page.addScriptTag({content:bundle});await page.evaluate(()=>window.renderQuiz('generation'))
 return {page,errors}
}
async function open(page){await page.getByRole('button',{name:'원문 검토하기',exact:true}).click();await page.getByRole('textbox',{name:'검토 원문'}).waitFor()}
async function confirm(page){await page.getByRole('button',{name:'원문 확정',exact:true}).click();await page.getByRole('button',{name:'확정하고 문항 생성',exact:true}).click()}
for(const edited of [true,false])test(`검토 복구 후 ${edited?'수정':'그대로'} 확정 원문을 전송하고 생성 완료한다`,async()=>{
 const {page,errors}=await screen();try{
 await open(page);if(edited)await page.getByRole('textbox',{name:'검토 원문'}).fill('  수정 원문\r\n')
 const expected=await page.getByRole('textbox',{name:'검토 원문'}).inputValue()
 await confirm(page);await page.getByText('문항 생성 중',{exact:false}).waitFor()
 assert.equal(await page.evaluate(()=>window.calls.find(c=>c.path.endsWith('/content-confirmation')).body.contentText),expected)
 await page.evaluate(()=>window.active={...window.active,status:'SUCCEEDED',quizId:1,revisionId:100})
 await page.getByRole('button',{name:'검토하기',exact:true}).waitFor({timeout:16000});assert.deepEqual(errors,[])
 assert.equal(await page.evaluate(()=>localStorage.getItem('cking.creatorQuizReviewDraft.v1.10.42')),null)
 }finally{await page.close()}
})
test('저장된 작업은 상태 API로 복구하고 검토 대기 polling을 멈춘다',async()=>{
 const {page}=await screen({stored:true});try{await page.getByText('원문 검토 대기',{exact:false}).waitFor();const n=await page.evaluate(()=>window.calls.length);await page.waitForTimeout(11000);assert.equal(await page.evaluate(()=>window.calls.length),n);await open(page)}finally{await page.close()}
})
for(const active of [null,undefined])test(`current data ${active===null?'null':'생략'}은 빈 상태`,async()=>{
 const {page}=await screen({active:active??null,omit:active===undefined});try{await page.waitForTimeout(150);assert.equal(await page.getByRole('button',{name:'AI Quiz 만들기',exact:false}).isEnabled(),true);assert.equal(await page.getByText('원문 검토 대기').count(),0)}finally{await page.close()}
})
test('같은 작업 수정본 복구 및 취소 후 삭제·새 생성 허용',async()=>{
 const {page}=await screen({draft:{text:'저장한 수정본',pendingText:null}});try{await open(page);assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).inputValue(),'저장한 수정본');await page.getByRole('button',{name:'생성 취소',exact:true}).last().click();await page.getByText('Quiz 생성을 취소했어요.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'AI Quiz 만들기',exact:false}).isEnabled(),true);assert.equal(await page.evaluate(()=>localStorage.getItem('cking.creatorQuizReviewDraft.v1.10.42')),null)}finally{await page.close()}
})
test('503 수정본 유지 및 불확실 응답은 같은 원문으로 재확인하고 연타를 막는다',async()=>{
 const {page}=await screen();try{await open(page);await page.getByRole('textbox',{name:'검토 원문'}).fill('수정본');await page.evaluate(()=>window.failure={status:503,code:'QUIZ_GENERATION_DISABLED'});await confirm(page);await page.getByRole('alert').filter({hasText:'지금은'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).inputValue(),'수정본');await page.evaluate(()=>window.failure='network');await page.getByRole('button',{name:'확정하고 문항 생성',exact:true}).click();await page.getByRole('button',{name:'같은 원문으로 다시 확인'}).waitFor();assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).isDisabled(),true);await page.evaluate(()=>{window.failure=null;window.hold=true});await page.getByRole('button',{name:'같은 원문으로 다시 확인'}).click();assert.equal(await page.getByRole('button',{name:'처리 중...'}).isDisabled(),true);await page.evaluate(()=>window.delayed());await page.getByText('문항 생성 중',{exact:false}).waitFor();const bodies=await page.evaluate(()=>window.calls.filter(c=>c.path.endsWith('/content-confirmation')).map(c=>c.body.contentText));assert.deepEqual(bodies,['수정본','수정본','수정본'])}finally{await page.close()}
})
test('409는 상태를 재조회하고 검토 UI를 종료한다',async()=>{
 const {page}=await screen();try{await open(page);await page.evaluate(()=>{window.failure={status:409,code:'QUIZ_GENERATION_CONTENT_CONFLICT'};window.active={...window.active,reviewStage:'GENERATING'}});await confirm(page);await page.getByText('문항 생성 중',{exact:false}).waitFor();assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).count(),0);assert.ok(await page.evaluate(()=>window.calls.some(c=>c.path.endsWith('/42')&&c.method==='GET')))}finally{await page.close()}
})
test('저장소를 쓸 수 없어도 복구 작업의 검토·취소 가능',async()=>{
 const {page}=await screen({storageFail:true});try{await open(page);await page.getByRole('button',{name:'생성 취소',exact:true}).last().click();await page.getByText('Quiz 생성을 취소했어요.',{exact:false}).waitFor()}finally{await page.close()}
})
test('다시 진입하면 같은 작업 수정본을 복구하고 다른 작업에는 섞지 않는다',async()=>{
 const {page}=await screen();try{
 await open(page);await page.getByRole('textbox',{name:'검토 원문'}).fill('다시 열 수정본')
 await page.evaluate(()=>window.renderQuiz());await open(page)
 assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).inputValue(),'다시 열 수정본')
 await page.evaluate(()=>{window.active={...window.active,generationId:43};window.renderQuiz()});await open(page)
 assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).inputValue(),initial.content.aiContentText)
 }finally{await page.close()}
})
test('403 확정은 수정본과 작업 UI를 지우며 원문을 더 노출하지 않는다',async()=>{
 const {page}=await screen();try{await open(page);await page.getByRole('textbox',{name:'검토 원문'}).fill('비공개 원문');await page.evaluate(()=>window.failure={status:403,code:'FORBIDDEN'});await confirm(page);await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('cking.creatorQuizReviewDraft.v1.10.42')),null)}finally{await page.close()}
})
test('생성 요청 409는 current의 기존 작업을 복구하고 추가 생성 POST를 보내지 않는다',async()=>{
 const {page}=await screen({active:null});try{
 await page.waitForTimeout(100)
 await page.evaluate((initial)=>{const original=window.fetch;window.fetch=async(url,options)=>{
  if(new URL(url).pathname.endsWith('/generations')&&options.method==='POST'){window.calls.push({path:'/api/creator/quizzes/generations',method:'POST'});window.active=initial;return new Response(JSON.stringify({code:'QUIZ_GENERATION_IN_PROGRESS'}),{status:409})}
  return original(url,options)
 }},initial)
 await page.getByRole('button',{name:'AI Quiz 만들기',exact:false}).click()
 await page.locator('input[type="url"]').fill('https://youtu.be/dQw4w9WgXcQ');await page.locator('input[type="text"]').fill('새 Quiz')
 await page.getByRole('button',{name:'만들기',exact:true}).click();await open(page)
 assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.path==='/api/creator/quizzes/generations').length),1)
 assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).inputValue(),initial.content.aiContentText)
 }finally{await page.close()}
})
test('저장된 작업이 종료되면 해당 수정본을 삭제한다',async()=>{
 const {page}=await screen({stored:true,draft:{text:'이전 원문'},active:{...initial,status:'FAILED',failureCode:'GROUNDING_INVALID'}})
 try{await page.getByText('생성 실패',{exact:false}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('cking.creatorQuizReviewDraft.v1.10.42')),null)}finally{await page.close()}
})
test('저장된 generationId로 복구한 작업도 확정·완료 뒤 검토하기를 유지한다',async()=>{
 const {page}=await screen({stored:true});try{await open(page);await confirm(page);await page.getByText('문항 생성 중',{exact:false}).waitFor();await page.evaluate(()=>window.active={...window.active,status:'SUCCEEDED',quizId:1,revisionId:100});await page.getByRole('button',{name:'검토하기',exact:true}).waitFor({timeout:16000});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cking.creatorQuizJobs.v1.10')).generation),null)}finally{await page.close()}
})
test('409 뒤 상태 조회가 404여도 작업과 수정본을 지운다',async()=>{
 const {page}=await screen();try{await open(page);await page.getByRole('textbox',{name:'검토 원문'}).fill('남기지 않을 원문');await page.evaluate(()=>{const original=window.fetch;window.failure={status:409,code:'QUIZ_GENERATION_NOT_AWAITING_REVIEW'};window.fetch=(url,options)=>new URL(url).pathname.endsWith('/42')?Promise.resolve(new Response(JSON.stringify({code:'QUIZ_GENERATION_NOT_FOUND'}),{status:404})):original(url,options)});await confirm(page);await page.getByRole('textbox',{name:'검토 원문'}).waitFor({state:'hidden'});await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('cking.creatorQuizReviewDraft.v1.10.42')),null)}finally{await page.close()}
})

async function createNew(page){
 await page.getByRole('button',{name:'AI Quiz 만들기',exact:false}).click()
 await page.locator('input[type="url"]').fill('https://youtu.be/dQw4w9WgXcQ')
 await page.locator('input[type="text"]').fill('새 요청')
 await page.getByRole('button',{name:'만들기',exact:true}).click()
}
test('복구 작업 취소 후 실제 새 생성 POST를 한 번 보낸다',async()=>{
 const {page}=await screen();try{
 await page.getByRole('button',{name:'생성 취소',exact:true}).click()
 await page.getByText('Quiz 생성을 취소했어요.',{exact:false}).waitFor()
 await createNew(page)
 await page.waitForFunction(()=>window.calls.filter(c=>c.path.endsWith('/generations')&&c.method==='POST').length===1,{},{timeout:2000})
 }finally{await page.close()}
})
test('확정 응답 유실 후 SUCCEEDED replay는 완료 UI와 기록 정리를 수행한다',async()=>{
 const {page}=await screen({stored:true});try{
 await open(page);await page.evaluate(()=>window.failure='network');await confirm(page)
 await page.getByRole('button',{name:'같은 원문으로 다시 확인'}).waitFor()
 await page.evaluate(()=>{window.failure=null;window.active={...window.active,status:'SUCCEEDED',quizId:1,revisionId:100}})
 await page.getByRole('button',{name:'같은 원문으로 다시 확인'}).click()
 await page.getByRole('button',{name:'검토하기',exact:true}).waitFor({timeout:2000})
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('cking.creatorQuizJobs.v1.10')).generation),null)
 assert.equal(await page.evaluate(()=>window.completed.length),1)
 }finally{await page.close()}
})
test('종료된 로컬 작업이 있어도 생성 409 후 다른 서버 작업을 복구한다',async()=>{
 const {page}=await screen({stored:true,active:{...initial,status:'FAILED',failureCode:'PROVIDER_ERROR'}});try{
 await page.getByText('생성 실패',{exact:false}).waitFor()
 await page.evaluate(initial=>{const original=window.fetch;window.fetch=async(url,options={})=>{
 if(new URL(url).pathname.endsWith('/generations')&&options.method==='POST'){
 window.calls.push({path:'/api/creator/quizzes/generations',method:'POST'});window.active={...initial,generationId:43,title:'다른 기기의 작업',content:{...initial.content,aiContentText:'작업 B의 원문'}}
 return new Response(JSON.stringify({code:'QUIZ_GENERATION_IN_PROGRESS'}),{status:409})
 }return original(url,options)
 }},initial)
 await createNew(page);await page.getByRole('button',{name:'원문 검토하기',exact:true}).waitFor({timeout:2000})
 await open(page)
 assert.equal(await page.getByRole('textbox',{name:'검토 원문'}).inputValue(),'작업 B의 원문')
 assert.ok(await page.evaluate(()=>window.calls.some(c=>c.path.endsWith('/current'))))
 assert.equal(await page.evaluate(()=>window.active.generationId),43)
 }finally{await page.close()}
})
