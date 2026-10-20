import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
let browser, bundle
const pageErrors=[]
test.before(async () => {
  const out = await build({configFile:false,plugins:[react()],logLevel:'silent',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://quiz.test'),'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/quizCloseBrowser.jsx',import.meta.url)),name:'CloseTest',formats:['iife']}}})
  bundle=(Array.isArray(out)?out[0]:out).output.find(x=>x.type==='chunk').code
  const paths=[process.env.QUIZ_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean)
  browser=await chromium.launch({headless:true,...paths.find(existsSync)?{executablePath:paths.find(existsSync)}:{}})
})
test.after(async()=>{await browser?.close();assert.deepEqual(pageErrors,[])})
async function screen(status='PUBLISHED',kind='sheet',review='APPROVED',origin='AI_GENERATED',multiple=false) {
  const page=await browser.newPage()
  page.on('pageerror',error=>pageErrors.push(error.message))
  await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
  await page.goto('http://localhost/close')
  await page.evaluate(({status,review,origin,multiple})=>{
    localStorage.clear();window.calls=[];window.toasts=[];window.changed=0;window.fail=null;window.hold=false;window.failGet=false;window.detail404=false;window.attempt=null
    window.quiz={quizId:1,creatorId:10,publicationStatus:status,publishedRevisionId:status==='PUBLISHED'?100:null,closedAt:status==='CLOSED'?'2026-10-19T01:00:00Z':null,revisions:[{revisionId:100,revisionNo:1,title:'검토 Quiz',reviewStatus:review}],latestRevisionId:100,latestRevisionNo:1,latestReviewStatus:review,title:'검토 Quiz'}
    window.revision={revisionId:100,revisionNo:1,title:'검토 Quiz',latest:true,reviewStatus:review,origin,canEdit:true,contentLocked:false,revisionSha256:'a'.repeat(64),questions:[{questionId:1000,questionNo:0,question:'질문',options:[{optionNo:0,text:'보기 A'},{optionNo:1,text:'보기 B'},{optionNo:2,text:'보기 C'},{optionNo:3,text:'보기 D'}],correctOptionIndex:0,explanation:'해설',sourceEvidence:'근거'}]}
    if(multiple)window.quiz.revisions.push({revisionId:101,revisionNo:2,title:'두 번째 Revision',reviewStatus:'PENDING_REVIEW'})
    window.quizGets=[]
    window.fetch=async(url,options={})=>{
      const path=new URL(url).pathname, method=options.method??'GET';window.calls.push({path,method,body:options.body})
      const response=(data,status=200,code='SUCCESS')=>new Response(JSON.stringify({code,data}),{status})
      if(method==='POST'){
        if(window.hold)await new Promise(resolve=>window.reply=resolve)
        if(window.fail){if(window.fail==='network')throw TypeError('Failed to fetch');return response(null,window.fail.status,window.fail.code)}
        if(path.endsWith('/close'))window.quiz={...window.quiz,publicationStatus:'CLOSED',closedAt:'2026-10-19T01:00:00Z'}
        if(path.endsWith('/unpublish'))window.quiz={...window.quiz,publicationStatus:'UNPUBLISHED',publishedRevisionId:null}
        if(path.endsWith('/publish'))window.quiz={...window.quiz,publicationStatus:'PUBLISHED',publishedRevisionId:100}
        return response(window.quiz)
      }
      if(path.endsWith('/current'))return response(null)
      if(path.endsWith('/my-attempt'))return window.attempt?response(window.attempt):response(null,404,'QUIZ_ATTEMPT_NOT_FOUND')
      if(path.endsWith('/quizzes'))return response({items:[{...window.quiz,questionCount:1}],hasNext:false})
      const revisionMatch=path.match(/\/revisions\/(100|101|200)$/)
      if(revisionMatch)return response({...window.revision,revisionId:Number(revisionMatch[1]),revisionNo:revisionMatch[1]==='101'?2:1,latest:!multiple||revisionMatch[1]!=='100',reviewStatus:revisionMatch[1]==='101'?'PENDING_REVIEW':window.revision.reviewStatus})
      if(path==='/api/creator/quizzes/1'){
        if(window.holdQuizGet){window.holdQuizGet=false;return new Promise(resolve=>window.quizGets.push(data=>resolve(response(data))))}
        return window.failGet?response(null,500,'SYSTEM_ERROR'):response(window.quiz)
      }
      if(path==='/api/creator/quizzes/2')return response({quizId:2,creatorId:10,publicationStatus:'PUBLISHED',publishedRevisionId:200,closedAt:null,revisions:[{revisionId:200,revisionNo:1,title:'다른 Quiz',reviewStatus:'APPROVED'}]})
      if(path==='/api/creators/10/quizzes/1')return window.detail404?response(null,404,'QUIZ_NOT_FOUND'):response({...window.revision,quizId:1})
      throw Error(path)
    }
  },{status,review,origin,multiple})
  await page.addScriptTag({content:bundle});await page.evaluate(kind=>window.renderCloseQuiz(kind),kind)
  if(kind==='sheet')await page.getByRole('region',{name:'게시'}).waitFor().catch(()=>page.getByText('게시 상태',{exact:true}).waitFor())
  return page
}
const posts=page=>page.evaluate(()=>window.calls.filter(c=>c.method==='POST'))
const button=(page,name)=>page.getByRole('button',{name,exact:true})
async function confirm(page){await button(page,'마감하기').click();await page.getByRole('dialog',{name:'Quiz를 마감할까요?'}).waitFor()}
for(const status of ['PUBLISHED','UNPUBLISHED','NOT_PUBLISHED','CLOSED'])test(`${status} 상태별 마감 노출 및 CLOSED 변경 차단`,async()=>{
  const p=await screen(status,'sheet','PENDING_REVIEW');try{
    assert.equal(await button(p,'마감하기').count(),['PUBLISHED','UNPUBLISHED'].includes(status)?1:0)
    if(status==='CLOSED'){
      await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).waitFor()
      for(const name of ['게시하기','게시 중지','최종 문항 선택·편집','평가 요청','승인','반려'])assert.equal(await button(p,name).count(),0,name)
    }
  }finally{await p.close()}
})
test('마감 모달 취소와 Escape는 POST 없이 돌아온다',async()=>{
  const p=await screen();try{await confirm(p);const dialog=p.getByRole('dialog',{name:'Quiz를 마감할까요?',exact:true});await dialog.getByText('마감 후에는 재게시할 수 없어요.',{exact:false}).waitFor();await dialog.getByRole('button',{name:'취소',exact:true}).click();assert.equal((await posts(p)).length,0);await confirm(p);await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'Quiz를 마감할까요?',exact:true}).waitFor({state:'detached'});assert.equal((await posts(p)).length,0)}finally{await p.close()}
})
test('확정 연타는 close POST 한 번이며 성공 후 상세와 목록을 갱신한다',async()=>{
  const p=await screen();try{await confirm(p);await p.evaluate(()=>window.hold=true);await button(p,'마감 확정').evaluate(el=>{el.click();el.click()});await p.waitForFunction(()=>window.calls.some(c=>c.path.endsWith('/close')));assert.equal(await button(p,'처리하는 중...').isDisabled(),true);assert.equal((await posts(p)).length,1);await p.evaluate(()=>window.reply());await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).waitFor();assert.equal(await button(p,'게시 중지').count(),0);assert.equal(await p.evaluate(()=>window.changed),1);assert.ok(await p.evaluate(()=>window.calls.filter(c=>c.path==='/api/creator/quizzes/1'&&c.method==='GET').length>=2));assert.equal((await posts(p))[0].body,undefined)}finally{await p.close()}
})
test('성공 뒤 재조회 실패 시에도 마감 결과를 유지하고 변경을 차단한다',async()=>{
  const p=await screen();try{await confirm(p);await p.evaluate(()=>window.failGet=true);await button(p,'마감 확정').click();await p.waitForFunction(()=>window.toasts.length>0);await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).waitFor();assert.equal(await button(p,'게시 중지').count(),0);assert.equal(await button(p,'게시하기').count(),0)}finally{await p.close()}
})
for(const fail of [{status:409,code:'QUIZ_CLOSED'},{status:409,code:'QUIZ_CLOSE_NOT_ALLOWED'},{status:403,code:'FORBIDDEN'},'network'])test(`마감 실패 ${typeof fail==='string'?fail:fail.code}는 재조회하고 자동 POST하지 않는다`,async()=>{
  const p=await screen();try{await confirm(p);await p.evaluate(fail=>{window.fail=fail;if(fail.code==='QUIZ_CLOSED')window.quiz.publicationStatus='CLOSED'},fail);await button(p,'마감 확정').click();await p.waitForFunction(()=>window.calls.filter(c=>c.path==='/api/creator/quizzes/1'&&c.method==='GET').length>=2);assert.equal((await posts(p)).length,1);assert.ok(await p.evaluate(()=>window.toasts.length>0));if(fail.code==='QUIZ_CLOSED')assert.equal(await button(p,'게시 중지').count(),0)}finally{await p.close()}
})
test('다른 탭 마감 후 오래된 게시 중지 요청은 CLOSED를 재조회한다',async()=>{
  const p=await screen();try{await p.evaluate(()=>{window.fail={status:409,code:'QUIZ_CLOSED'};window.quiz.publicationStatus='CLOSED'});await button(p,'게시 중지').click();await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).waitFor();assert.equal(await button(p,'게시 중지').count(),0)}finally{await p.close()}
})
test('기존 게시 중지 후 재게시 흐름 유지',async()=>{
  const p=await screen();try{await button(p,'게시 중지').click();await button(p,'게시하기').waitFor();await button(p,'게시하기').click();await button(p,'게시 중지').waitFor();assert.deepEqual((await posts(p)).map(x=>x.path),['/api/creator/quizzes/1/unpublish','/api/creator/quizzes/1/publish'])}finally{await p.close()}
})
test('Creator 목록에서도 마감 상태로 기존 Quiz를 열 수 있다',async()=>{
  const p=await screen('CLOSED','manager');try{await p.getByRole('button').filter({hasText:'검토 Quiz'}).waitFor();assert.match(await p.getByRole('button').filter({hasText:'검토 Quiz'}).innerText(),/마감/);await p.getByRole('button').filter({hasText:'검토 Quiz'}).click();await p.getByText('게시 상태',{exact:true}).waitFor();assert.equal(await button(p,'마감하기').count(),0)}finally{await p.close()}
})
test('팬은 미리 연 문항의 제출에서 마감 안내를 받고 신규 제출이 차단된다',async()=>{
  const p=await screen('PUBLISHED','fan');try{await p.getByRole('button').filter({hasText:'검토 Quiz'}).click();await p.evaluate(()=>window.fail={status:409,code:'QUIZ_CLOSED'});await p.getByRole('button').filter({hasText:'보기 A'}).click();await p.getByText('마감된 Quiz예요. 신규 응시는 할 수 없어요.',{exact:true}).waitFor();assert.equal(await button(p,'제출하기').count(),0)}finally{await p.close()}
})
test('공개 상세 404여도 기존 응시 snapshot 결과를 보여준다',async()=>{
  const p=await screen('CLOSED','fan');try{await p.evaluate(()=>{window.detail404=true;window.attempt={attemptId:1,title:'과거 결과',questionCount:1,correctCount:1,questions:[{questionNo:0,question:'질문',options:['보기 A','보기 B'],selectedOptionIndex:0,correctOptionIndex:0,correct:true,explanation:'해설'}],reward:{amount:1,requestId:null,status:'NOT_ELIGIBLE',paymentStatus:'NOT_ELIGIBLE'}}});await p.getByRole('button').filter({hasText:'검토 Quiz'}).click();await p.getByText('과거 결과',{exact:true}).waitFor();assert.equal(await button(p,'제출하기').count(),0);assert.equal((await posts(p)).length,0)}finally{await p.close()}
})

for(const action of ['approval','judge','edit'])test(`다른 탭 마감 후 ${action}의 CLOSED는 최신 조회와 읽기 전용으로 전환한다`,async()=>{
  const p=await screen('NOT_PUBLISHED','sheet','PENDING_REVIEW',action==='approval'?'CREATOR_COMPOSED':'AI_GENERATED')
  try {
    if(action==='edit')await button(p,'최종 문항 선택·편집').click()
    if(action==='approval'){
      await button(p,'Creator 책임 승인').click()
      await p.getByRole('checkbox').check()
    }
    await p.evaluate(()=>{window.fail={status:409,code:'QUIZ_CLOSED'};window.quiz.publicationStatus='CLOSED'})
    await button(p,action==='edit'?'최종 문항 저장':action==='approval'?'승인 확정':'평가 요청').click()
    await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).waitFor()
    for(const name of ['게시하기','게시 중지','최종 문항 선택·편집','평가 요청','Creator 책임 승인'])assert.equal(await button(p,name).count(),0)
    assert.equal((await posts(p)).length,1)
  } finally {await p.close()}
})
test('마감 모달은 초점 순환·취소 복귀와 요청 중 Escape 차단을 제공한다',async()=>{
  const p=await screen();try{
    await confirm(p);assert.equal(await p.getByRole('dialog',{name:'Quiz를 마감할까요?',exact:true}).evaluate(el=>el===document.activeElement),true)
    await p.keyboard.press('Shift+Tab');assert.equal(await button(p,'마감 확정').evaluate(el=>el===document.activeElement),true)
    await p.keyboard.press('Escape');assert.equal(await button(p,'마감하기').evaluate(el=>el===document.activeElement),true)
    await confirm(p);await p.evaluate(()=>window.hold=true);await button(p,'마감 확정').click()
    await p.getByRole('dialog',{name:'Quiz를 마감할까요?',exact:true}).evaluate(el=>el.focus());await p.keyboard.press('Escape')
    assert.equal(await p.getByRole('dialog',{name:'Quiz를 마감할까요?',exact:true}).count(),1)
    await p.evaluate(()=>window.reply());await p.getByRole('dialog',{name:'Quiz를 마감할까요?',exact:true}).waitFor({state:'detached'})
  }finally{await p.close()}
})

async function assertClosedAcrossRevisions(p) {
  await p.getByRole('button',{name:'revision 2',exact:true}).click()
  await p.getByRole('region',{name:'revision 정보'}).getByText('revision 2',{exact:false}).waitFor()
  assert.equal(await button(p,'게시 중지').count(),0)
  await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).waitFor()
  for(const name of ['마감하기','게시하기','이 revision으로 바꿔 게시','최종 문항 선택·편집','평가 요청','승인','Creator 책임 승인','승인 확정','반려'])assert.equal(await button(p,name).count(),0,name)
}
test('F1: 마감 성공·상세 재조회 실패 후 Revision을 바꿔도 게시 중지는 0개다',async()=>{
  const p=await screen('PUBLISHED','sheet','APPROVED','AI_GENERATED',true)
  try {
    await confirm(p);await p.evaluate(()=>window.failGet=true);await button(p,'마감 확정').click()
    await p.waitForFunction(()=>window.changed===1)
    await assertClosedAcrossRevisions(p)
    await p.getByRole('button',{name:'revision 1',exact:true}).click()
    await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).waitFor()
    assert.equal(await button(p,'게시 중지').count(),0)
    assert.equal((await posts(p)).length,1)
  } finally {await p.close()}
})
test('F1: CLOSED 확정 뒤 늦게 도착한 PUBLISHED 상세가 재게시 상태를 복원하지 않는다',async()=>{
  const p=await screen('PUBLISHED','sheet','APPROVED','AI_GENERATED',true)
  try {
    const old=await p.evaluate(()=>structuredClone(window.quiz))
    await confirm(p);await p.evaluate(()=>window.holdQuizGet=true);await button(p,'마감 확정').click()
    await p.waitForFunction(()=>window.quizGets.length===1)
    await assertClosedAcrossRevisions(p)
    await p.evaluate(old=>window.quizGets[0](old),old)
    await p.waitForFunction(()=>window.changed===1)
    await assertClosedAcrossRevisions(p)
  } finally {await p.close()}
})
test('F1: 정상 CLOSED 상세 재조회는 서버 마감 시각과 동기화하고 Revision 변경에도 유지한다',async()=>{
  const p=await screen('PUBLISHED','sheet','APPROVED','AI_GENERATED',true)
  try {
    await confirm(p);await p.evaluate(()=>window.holdQuizGet=true);await button(p,'마감 확정').click()
    await p.waitForFunction(()=>window.quizGets.length===1)
    await p.evaluate(()=>window.quizGets[0]({...window.quiz,closedAt:'2026-10-20T03:04:00Z'}))
    await p.waitForFunction(()=>window.changed===1)
    await assertClosedAcrossRevisions(p)
    await p.getByText(/26\.10\.20\./).waitFor()
  } finally {await p.close()}
})
test('F1: 같은 시트에서 다른 Quiz로 바꿔도 CLOSED가 섞이지 않고 이전 조회 응답을 무시한다',async()=>{
  const p=await screen('PUBLISHED','sheet','APPROVED','AI_GENERATED',true)
  try {
    await confirm(p);await p.evaluate(()=>window.holdQuizGet=true);await button(p,'마감 확정').click()
    await p.waitForFunction(()=>window.quizGets.length===1)
    await p.evaluate(()=>window.renderCloseQuiz('sheet',{quizId:2,initialRevisionId:200}))
    await p.getByRole('heading',{name:'다른 Quiz',exact:true}).waitFor()
    await button(p,'게시 중지').waitFor()
    await p.evaluate(()=>window.quizGets[0](window.quiz))
    await p.waitForFunction(()=>window.changed===1)
    assert.equal(await button(p,'게시 중지').count(),1)
    assert.equal(await button(p,'마감하기').count(),1)
    assert.equal(await p.getByText('마감된 Quiz는 재게시할 수 없어요.',{exact:false}).count(),0)
    assert.equal((await posts(p)).length,1)
  } finally {await p.close()}
})
