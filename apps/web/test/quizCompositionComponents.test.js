import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'vite'
import { existsSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from '../tailwind.config.js'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const key='cking.quizComposition.v1.10.1'
const hash='a'.repeat(64), uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const revision=(composed=false)=>({quizId:1,revisionId:100,revisionNo:1,latest:true,origin:composed?'CREATOR_COMPOSED':'AI_GENERATED',hashVersion:composed?'quiz-revision-v2':'quiz-revision-v1',revisionSha256:hash,canEdit:true,contentLocked:false,reviewStatus:'PENDING_REVIEW',title:'T',questionCount:5,optionCount:4,questions:Array.from({length:5},(_,i)=>({questionId:1000+i,questionNo:i,question:'문제 '+i,options:['A','B','C','D'].map((text,optionNo)=>({text,optionNo})),correctOptionIndex:0,explanation:'해설',sourceEvidence:'근거',evaluationStatus:i===0?'FAIL':'PASS'}))})
let bundle,browser,css
let contexts=[]
test.before(async()=>{const out=await build({configFile:false,plugins:[react()],css:{postcss:{plugins:[tailwindcss({...tailwindConfig,content:[fileURLToPath(new URL('../src/**/*.{js,jsx}',import.meta.url))]}),autoprefixer()]}},logLevel:'silent',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://quiz.test'),'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/quizCompositionBrowser.jsx',import.meta.url)),name:'CompositionTest',formats:['iife']}}});const output=(Array.isArray(out)?out[0]:out).output;bundle=output.find(i=>i.type==='chunk').code;css=output.find(i=>i.type==='asset'&&i.fileName.endsWith('.css')).source;const paths=[process.env.QUIZ_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);browser=await chromium.launch({headless:true,...(paths.find(existsSync)?{executablePath:paths.find(existsSync)}:{})})})
test.afterEach(async()=>{await Promise.all(contexts.map(c=>c.close()));contexts=[]})
test.after(async()=>{await browser?.close()})
async function pageIn(context,{composed=false,kind='panel',record=null,writeFailure=false,noLocks=false,locked=false,legacy=false,creatorId=10,quizId=1,baseRevisionId=100,baseHash=hash,readFailure=false}={}){
 const page=await context.newPage();await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort());await page.goto('http://localhost/composition-test')
 await page.evaluate(({fixture,key,record,writeFailure,noLocks,creatorId,quizId,readFailure})=>{window.fixtureCreatorId=creatorId;window.fixtureQuizId=quizId;window.fixtureRevision=fixture;window.serverRevisions=new Map([[fixture.revisionId,fixture]]);window.savedRevision=null;window.gets=[];window.quizView={quizId:1,publicationStatus:'NOT_PUBLISHED',revisions:[{revisionId:fixture.revisionId,title:'T',revisionNo:1}]};window.failGet=false;window.posts=[];window.failWrite=writeFailure;const store=window.localStorage;if(record)store.setItem(key,JSON.stringify(record));if(writeFailure||readFailure){Object.defineProperty(window,'localStorage',{value:{getItem:k=>{if(readFailure)throw Error('read');return store.getItem(k)},setItem:(k,v)=>{if(window.failWrite)throw Error('quota');store.setItem(k,v)}}})}if(noLocks)Object.defineProperty(navigator,'locks',{value:undefined});window.reply=(i,status,data,code='SUCCESS')=>{if(status<300&&data?.revisionId)window.serverRevisions.set(data.revisionId,{...fixture,...data});window.posts[i].resolve(new Response(JSON.stringify({code,data}),{status}));};window.lose=i=>window.posts[i].reject(TypeError('network'));window.fetch=(url,init={})=>{if(init.method==='POST')return new Promise((resolve,reject)=>window.posts.push({url,body:JSON.parse(init.body),resolve,reject}));window.gets.push(String(url));if(window.failGet)return Promise.resolve(new Response(JSON.stringify({code:'SYSTEM_ERROR',data:null}),{status:500}));const quiz=window.quizView;return Promise.resolve(new Response(JSON.stringify({code:'SUCCESS',data:String(url).includes('/revisions/')?window.serverRevisions.get(Number(String(url).match(/revisions\/(\d+)/)?.[1]))??fixture:quiz}),{status:200}))}}, {fixture: {...revision(composed),revisionId:baseRevisionId,revisionSha256:baseHash, ...(locked ? {contentLocked:true,canEdit:false} : {}), ...(legacy ? {origin:undefined,canEdit:undefined,contentLocked:undefined} : {})},key,record,writeFailure,noLocks,creatorId,quizId,readFailure});await page.addStyleTag({content:css});await page.addScriptTag({content:bundle});await page.evaluate(kind=>window.renderComposition(kind),kind);return page
}
async function context(){const c=await browser.newContext();contexts.push(c);return c}
const waitPosts=(p,n)=>p.waitForFunction(n=>window.posts.length===n,n)
const stored=p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key)
test('실제 패널은 5개 중 선택·재정렬한 현재 questionId만 저장한다',async()=>{const p=await pageIn(await context());await p.getByRole('checkbox').nth(1).uncheck();await p.getByRole('checkbox').nth(2).uncheck();await p.getByRole('checkbox').nth(3).uncheck();await p.getByRole('button',{name:'문제 4 위로',exact:true}).click();await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(p,1);const body=await p.evaluate(()=>window.posts[0].body);assert.deepEqual(body.questions,[{sourceQuestionId:1004},{sourceQuestionId:1000}]);assert.equal(body.baseRevisionSha256,hash)})
test('응답 유실과 새로고침은 같은 UUID/body로 복구한다',async()=>{const c=await context();const p=await pageIn(c);await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(p,1);const first=await stored(p);await p.evaluate(()=>window.lose(0));await p.getByRole('button',{name:'기존 저장 요청 다시 확인'}).click();await waitPosts(p,2);assert.equal(await p.evaluate(()=>window.posts[1].body.requestId),first.requestId);await p.evaluate(()=>window.lose(1));const second=await pageIn(c);await second.getByRole('button',{name:'기존 저장 요청 다시 확인'}).click();await waitPosts(second,1);assert.deepEqual(await second.evaluate(()=>window.posts[0].body),{...first.body,requestId:first.requestId})})
test('두 탭은 같은 공유 UUID를 쓰고 늦은 R1은 R2를 덮어쓰지 않는다',async()=>{const c=await context(),a=await pageIn(c);await a.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(a,1);const r1=await stored(a),b=await pageIn(c);await b.getByRole('button',{name:'기존 저장 요청 다시 확인'}).click();await waitPosts(b,1);assert.equal(await b.evaluate(()=>window.posts[0].body.requestId),r1.requestId);await b.evaluate(()=>window.reply(0,201,{revisionId:101,revisionSha256:'b'.repeat(64)}));await b.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).result?.revisionId===101,key);await b.evaluate(({key,r1})=>localStorage.setItem(key,JSON.stringify({...r1,requestId:'00000000-0000-4000-8000-000000000002',result:{revisionId:102,revisionSha256:'c'.repeat(64)}})),{key,r1});await a.evaluate(()=>window.reply(0,201,{revisionId:101,revisionSha256:'b'.repeat(64)}));await a.getByText('다른 탭의 최신 저장 정보를 보호했어요.',{exact:false}).waitFor();assert.equal((await stored(a)).result.revisionId,102)})
test('저장소 쓰기 실패와 Web Locks 미지원은 POST를 보내지 않는다',async()=>{for(const options of [{writeFailure:true},{noLocks:true}]){const p=await pageIn(await context(),options);await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await p.getByText('저장 정보를 예약하지 못했어요.',{exact:false}).waitFor();assert.equal(await p.evaluate(()=>window.posts.length),0)}})
test('stale 409는 작성 내용을 보존한다',async()=>{const p=await pageIn(await context());await p.getByRole('textbox',{name:'문제 source:1000',exact:true}).fill('내가 편집한 문제');await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(p,1);await p.evaluate(()=>window.reply(0,409,null,'QUIZ_REVISION_CONFLICT'));await p.getByText('기준 문항 버전이 바뀌었어요.',{exact:false}).waitFor();assert.equal(await p.getByRole('textbox',{name:'문제 source:1000',exact:true}).inputValue(),'내가 편집한 문제');assert.equal((await stored(p)).body.questions[0].content.sourceEvidence,'')})
test('구성본은 Judge 없이 책임 확인과 서버 hash로 승인한다',async()=>{const p=await pageIn(await context(),{composed:true,kind:'sheet'});await p.getByRole('button',{name:'크리에이터 책임 승인',exact:true}).click();const confirm=p.getByRole('button',{name:'승인 확정',exact:true});assert.equal(await confirm.isDisabled(),true);await p.getByRole('checkbox').check();await confirm.click();await waitPosts(p,1);const body=await p.evaluate(()=>window.posts[0].body);assert.deepEqual(body,{revisionSha256:hash,acknowledgeResponsibility:true});assert.match(await p.evaluate(()=>String(window.posts[0].url)),/creator-approval$/)})
test('직접 추가는 문자열 보기·정답·빈 근거로 저장하며 이전 PASS가 유지되지 않는다',async()=>{const p=await pageIn(await context());await p.getByRole('checkbox').nth(4).uncheck();await p.getByRole('button',{name:'직접 문항 추가',exact:false}).click();const added=p.locator('article').last();await added.getByRole('textbox').nth(0).fill('추가 문항');for(let i=0;i<4;i++)await added.getByRole('textbox').nth(i+1).fill('추가 보기 '+i);await added.getByRole('radio').nth(2).check();await added.getByRole('textbox').nth(5).fill('추가 해설');await p.getByRole('textbox',{name:'문제 source:1000',exact:true}).fill('수정 문제');await p.getByText('수정됨 · 재검증 안 됨',{exact:true}).waitFor();await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(p,1);const body=await p.evaluate(()=>window.posts[0].body);assert.equal(body.questions.length,5);assert.equal(body.questions[4].sourceQuestionId,undefined);assert.equal(body.questions[4].content.correctOptionIndex,2);assert.equal(body.questions[0].content.sourceEvidence,'')})
test('서버 저장 성공 후 재조회 실패는 성공 기록을 보존하고 재POST하지 않는다',async()=>{const p=await pageIn(await context());await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(p,1);await p.evaluate(()=>{window.failGet=true;window.reply(0,201,{revisionId:101,revisionSha256:'b'.repeat(64)})});await p.getByText('문항은 저장됐어요.',{exact:false}).waitFor();assert.equal((await stored(p)).result.revisionId,101);await p.getByRole('button',{name:'저장된 문항 버전 다시 열기'}).click();assert.equal(await p.evaluate(()=>window.posts.length),1)})
test('게시 잠금과 구버전 DTO에서는 편집 진입이 없다',async()=>{for(const flags of [{locked:true},{legacy:true}]){const p=await pageIn(await context(),{...flags,kind:'sheet'});await p.getByText('문항 버전 1',{exact:false}).first().waitFor();assert.equal(await p.getByRole('button',{name:'최종 문항 선택·편집',exact:true}).count(),0)}})
test('미확정 요청의 본문을 바꾸면 새 UUID POST를 막고 5xx 후 같은 본문만 복구한다',async()=>{const p=await pageIn(await context());await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(p,1);const first=await stored(p);await p.evaluate(()=>window.reply(0,500,null,'SYSTEM_ERROR'));await p.getByRole('button',{name:'최종 문항 저장',exact:true}).waitFor({state:'visible'});await p.getByRole('textbox',{name:'문제 source:1000',exact:true}).fill('다른 요청 내용');await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await p.getByText('저장 정보를 예약하지 못했어요.',{exact:false}).waitFor();assert.equal(await p.evaluate(()=>window.posts.length),1);await p.getByRole('button',{name:'기존 저장 요청 다시 확인'}).click();await waitPosts(p,2);assert.deepEqual(await p.evaluate(()=>window.posts[1].body),{...first.body,requestId:first.requestId})})

// 설치된 빌드 CSS와 실제 편집 컴포넌트로 모바일 두 테마의 기본 배치를 검증한다.
test('모바일 360px 일반/다크 모드에서 편집·미리보기의 가로 넘침이 없다',async()=>{
 const p=await pageIn(await context());await p.setViewportSize({width:360,height:800})
 for(const theme of ['light','dark']){await p.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await p.getByRole('button',{name:'최종 미리보기',exact:true}).click();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await p.getByRole('button',{name:'최종 미리보기',exact:true}).click()}
})

test('서로 다른 편집본의 두 탭: 다른 탭 성공을 오인하지 않고 내용을 보존해 명시적으로 최신 기준을 연다',async()=>{
 const c=await context(),a=await pageIn(c),b=await pageIn(c)
 await b.getByRole('textbox',{name:'문제 source:1000',exact:true}).fill('B가 작성한 문제')
 await a.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(a,1)
 await a.evaluate(()=>window.reply(0,201,{revisionId:101,revisionNo:2,revisionSha256:'b'.repeat(64)}))
 await b.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).result?.revisionId===101,key)
 // storage 이벤트가 React에 전달된 뒤에도 B의 본문은 유지되어야 한다.
 await b.evaluate(key=>window.dispatchEvent(new StorageEvent('storage',{key})),key)
 const server=await a.evaluate(()=>[...window.serverRevisions.entries()])
 await b.evaluate(server=>{window.serverRevisions=new Map(server);window.quizView={...window.quizView,revisions:[{revisionId:100,revisionNo:1,title:'T'},{revisionId:101,revisionNo:2,title:'T'}]}},server)
 assert.equal(await b.getByRole('textbox',{name:'문제 source:1000',exact:true}).inputValue(),'B가 작성한 문제')
 assert.equal(await b.getByRole('button',{name:'저장된 문항 버전 다시 열기',exact:true}).count(),0)
 await b.getByRole('button',{name:'최신 문항 버전 확인',exact:true}).click()
 await b.getByText('최신 문항 버전 2',{exact:false}).waitFor()
 assert.equal(await b.evaluate(()=>window.posts.length),0)
 assert.equal((await stored(b)).result.revisionId,101)
 await b.getByRole('button',{name:'최신 기준으로 다시 시작',exact:true}).click()
 const restart=b.getByRole('dialog',{name:'최신 기준으로 다시 시작할까요?',exact:true})
 await restart.getByRole('button',{name:'취소',exact:true}).click()
 await restart.waitFor({state:'detached'})
 await b.getByRole('button',{name:'최신 기준으로 다시 시작',exact:true}).click()
 await b.getByRole('dialog',{name:'최신 기준으로 다시 시작할까요?',exact:true}).getByRole('button',{name:'다시 시작',exact:true}).click()
 await b.waitForFunction(()=>window.savedRevision?.revisionId===101)
 assert.equal((await stored(b)).result.revisionId,101)
})
for(const code of ['QUIZ_REVISION_CONFLICT','QUIZ_CONTENT_LOCKED'])test(`책임 승인 ${code}: 최신 상세 재조회·확인 해제·오래된 승인 차단`,async()=>{
 const p=await pageIn(await context(),{composed:true,kind:'sheet'})
 await p.getByRole('button',{name:'크리에이터 책임 승인',exact:true}).click();await p.getByRole('checkbox').check();await p.getByRole('button',{name:'승인 확정',exact:true}).click();await waitPosts(p,1)
 const before=await p.evaluate(()=>window.gets.length)
 await p.evaluate(code=>{const old=window.serverRevisions.get(100);window.serverRevisions.set(100,{...old,latest:code==='QUIZ_CONTENT_LOCKED',canEdit:false,contentLocked:code==='QUIZ_CONTENT_LOCKED'});window.serverRevisions.set(101,{...old,revisionId:101,revisionNo:2,revisionSha256:'b'.repeat(64)});window.quizView={...window.quizView,revisions:[{revisionId:100,revisionNo:1,title:'T'},{revisionId:101,revisionNo:2,title:'T'}]};window.reply(0,409,null,code)},code)
 await p.waitForFunction(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='승인 확정');return !button||!button.disabled})
 assert.equal(await p.getByRole('button',{name:'승인 확정',exact:true}).count(),0)
 await p.waitForFunction(before=>window.gets.length>=before+2,before)
 assert.equal(await p.getByRole('button',{name:'크리에이터 책임 승인',exact:true}).isDisabled(),true)
 if(code==='QUIZ_CONTENT_LOCKED')await p.getByText('최초 게시된 Quiz는 게시를 취소해도 읽기 전용이에요.',{exact:false}).waitFor()
 assert.equal(await p.evaluate(()=>window.posts.length),1)
})

test('다른 본문의 미확정 요청 복구가 성공해도 현재 편집본을 성공으로 오인하지 않는다',async()=>{
 const c=await context(),a=await pageIn(c),b=await pageIn(c)
 await b.getByRole('textbox',{name:'문제 source:1000',exact:true}).fill('B의 다른 내용')
 await a.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(a,1)
 await b.getByRole('button',{name:'기존 저장 요청 다시 확인',exact:true}).click();await waitPosts(b,1)
 assert.equal(await b.evaluate(()=>window.posts[0].body.requestId),(await stored(a)).requestId)
 await b.evaluate(()=>window.reply(0,201,{revisionId:101,revisionSha256:'b'.repeat(64)}))
 await b.getByText('다른 탭이 다른 내용으로 저장했어요.',{exact:false}).first().waitFor()
 assert.equal(await b.getByRole('textbox',{name:'문제 source:1000',exact:true}).inputValue(),'B의 다른 내용')
 assert.equal(await b.evaluate(()=>window.savedRevision),null)
 assert.equal(await b.getByRole('button',{name:'저장된 문항 버전 다시 열기',exact:true}).count(),0)
 assert.equal((await stored(b)).result.revisionId,101)
})

test('저장 성공 뒤 재조회 실패·페이지 재진입은 성공 본문을 복원하고 추가 POST 없이 결과를 연다',async()=>{
 const c=await context(),p=await pageIn(c)
 await p.getByRole('textbox',{name:'문제 source:1000',exact:true}).fill('복원할 편집 문제')
 await p.getByRole('checkbox').nth(4).uncheck()
 await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click();await waitPosts(p,1)
 await p.evaluate(()=>{window.failGet=true;window.reply(0,201,{revisionId:101,revisionSha256:'b'.repeat(64)})})
 await p.getByText('문항은 저장됐어요.',{exact:false}).waitFor()
 const record=await stored(p),reopened=await pageIn(c)
 assert.equal(await reopened.getByRole('textbox',{name:'문제 source:1000',exact:true}).inputValue(),'복원할 편집 문제')
 assert.equal(await reopened.getByRole('checkbox').count(),4)
 assert.equal(await reopened.getByText('다른 탭이 다른 내용으로 저장했어요.',{exact:false}).count(),0)
 await reopened.evaluate(saved=>window.serverRevisions.set(saved.revisionId,{...window.fixtureRevision,...saved}),record.result)
 await reopened.getByRole('button',{name:'저장된 문항 버전 다시 열기',exact:true}).click()
 await reopened.waitForFunction(()=>window.savedRevision?.revisionId===101)
 assert.equal(await reopened.evaluate(()=>window.posts.length),0)
 assert.equal((await stored(reopened)).result.revisionSha256,'b'.repeat(64))
})

const successfulRecord=()=>({requestId:uuid(1),body:{baseRevisionId:100,baseRevisionSha256:hash,questions:[{sourceQuestionId:1000,content:{question:'저장 기록의 문제',options:['A','B','C','D'],correctOptionIndex:0,explanation:'해설',sourceEvidence:''}}]},result:{revisionId:101,revisionSha256:'b'.repeat(64)}})
test('다른 Creator/Quiz 또는 base ID/hash 성공 기록은 초기 화면에 복원하지 않는다',async()=>{
 for(const scope of [{creatorId:20},{quizId:2},{baseRevisionId:200},{baseHash:'c'.repeat(64)}]){
  const p=await pageIn(await context(),{...scope,record:successfulRecord()})
  assert.equal(await p.getByRole('textbox',{name:'문제 source:1000',exact:true}).inputValue(),'문제 0')
  assert.equal(await p.getByRole('button',{name:'저장된 문항 버전 다시 열기',exact:true}).count(),0)
  assert.equal(await p.evaluate(()=>window.posts.length),0)
 }
})
test('잘못된 성공 ID/hash와 저장소 읽기 실패는 성공 복원·POST를 차단한다',async()=>{
 const invalid=successfulRecord();invalid.result={revisionId:101,revisionSha256:'broken'}
 for(const options of [{record:invalid},{record:successfulRecord(),readFailure:true}]){
  const p=await pageIn(await context(),options)
  assert.equal(await p.getByRole('textbox',{name:'문제 source:1000',exact:true}).inputValue(),'문제 0')
  assert.equal(await p.getByRole('button',{name:'저장된 문항 버전 다시 열기',exact:true}).count(),0)
  await p.getByRole('button',{name:'최종 문항 저장',exact:true}).click()
  await p.getByText('저장소를 읽을 수 없어 저장을 중단했어요.',{exact:true}).waitFor()
  assert.equal(await p.evaluate(()=>window.posts.length),0)
 }
})
