import test from 'node:test'
import assert from 'node:assert/strict'
import { quizMockRoutes } from '../src/dev/quizMock.js'
const id='00000000-0000-4000-8000-000000000001'
async function mockSession(run) {
  const previous=globalThis.sessionStorage
  const values=new Map();globalThis.sessionStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}
  const routes=quizMockRoutes({myCreatorId:1,memberId:900})
  const call=async(method,path,body)=>{
    const [,,handler]=routes.find(([m,re])=>m===method&&re.test(path))??[]
    assert.ok(handler,`${method} ${path}`)
    const re=routes.find(([m,re])=>m===method&&re.test(path))[1]
    return handler(...path.match(re).slice(1),new URL(path,'http://mock'),{body:body?JSON.stringify(body):undefined})
  }
  try { await run(call,values) } finally { if(previous===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=previous }
}
test('Mock close의 소유권·미게시 거절과 반복 요청은 실제 BE 계약을 따른다',()=>mockSession(async call=>{
  assert.equal((await call('POST','/api/creator/quizzes/2/close')).code,'QUIZ_CLOSE_NOT_ALLOWED')
  assert.equal((await call('POST','/api/creator/quizzes/3/close')).status,403)
  const before=(await call('GET','/api/creator/quizzes/1')).data
  const first=await call('POST','/api/creator/quizzes/1/close')
  assert.equal(first.status,200);assert.equal(first.data.publicationStatus,'CLOSED');assert.ok(first.data.closedAt)
  assert.equal(first.data.publishedRevisionId,before.publishedRevisionId)
  assert.deepEqual((await call('POST','/api/creator/quizzes/1/close')).data,first.data)
  assert.equal((await call('GET','/api/creator/quizzes/1')).data.contentLocked,true)
  assert.equal((await call('GET','/api/creators/1/quizzes')).data.items.length,0)
  assert.equal((await call('GET','/api/creators/1/quizzes/1')).status,404)
  for(const [path,body] of [['publish',{revisionId:100}],['unpublish'],['revisions/100/approve'],['revisions/100/reject'],['revisions/100/judge-evaluations',{requestId:id}]])assert.equal((await call('POST',`/api/creator/quizzes/1/${path}`,body)).code,'QUIZ_CLOSED',path)
}))
test('Mock 중지 후 마감은 NULL 포인터와 이력을 보존한다',()=>mockSession(async call=>{
  const stopped=(await call('POST','/api/creator/quizzes/1/unpublish')).data
  const closed=(await call('POST','/api/creator/quizzes/1/close')).data
  assert.equal(closed.publicationStatus,'CLOSED');assert.equal(closed.publishedRevisionId,null);assert.equal(closed.unpublishedAt,stopped.unpublishedAt)
}))
test('Mock 팬 신규 제출은 CLOSED이며 기존 응시 replay와 snapshot은 유지한다',()=>mockSession(async(call,values)=>{
  await call('GET','/api/creator/quizzes/1')
  const fanRoutes=quizMockRoutes({myCreatorId:null,memberId:900})
  const fan=async(method,path,body)=>{const [,re,handler]=fanRoutes.find(([m,re])=>m===method&&re.test(path));return handler(...path.match(re).slice(1),new URL(path,'http://mock'),{body:JSON.stringify(body)})}
  const body={requestId:id,revisionId:100,answers:[0,1,2].map(questionNo=>({questionNo,selectedOptionIndex:0}))}
  const saved=await fan('POST','/api/creators/1/quizzes/1/attempts',body)
  assert.equal(saved.status,200)
  await call('POST','/api/creator/quizzes/1/close')
  assert.equal((await fan('POST','/api/creators/1/quizzes/1/attempts',body)).data.attemptId,saved.data.attemptId)
  const other=quizMockRoutes({myCreatorId:null,memberId:901});const route=other.find(([m,re])=>m==='POST'&&re.test('/api/creators/1/quizzes/1/attempts'))
  assert.equal((await route[2]('1','1',new URL('http://mock'),{body:JSON.stringify({...body,requestId:id.replace(/1$/,'2')})})).code,'QUIZ_CLOSED')
  assert.ok(values.size>0)
}))
