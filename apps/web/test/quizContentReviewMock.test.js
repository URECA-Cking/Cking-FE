import test from 'node:test'
import assert from 'node:assert/strict'
import { quizMockRoutes } from '../src/dev/quizMock.js'
const key='cking.mock.quiz.v2'
const makeJob=()=>({generationId:42,creatorId:10,status:'RUNNING',reviewStage:'AWAITING_REVIEW',title:'[원문검토]',questionCount:3,aiContentText:'원문',facts:[],requestedAt:Date.now()-6000})
async function setup(){
 const values=new Map([[key,JSON.stringify({seq:50,quizzes:[],generations:[makeJob()],judges:[],attempts:[],lost:[]})]])
 globalThis.sessionStorage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}
 const routes=quizMockRoutes({myCreatorId:10,memberId:7})
 return {values,call:async(method,path,body)=>{
  const route=routes.find(([m,re])=>m===method&&re.test(path));assert.ok(route)
  const args=path.match(route[1]).slice(1);return route[2](...args,new URL('http://mock'+path),{body:JSON.stringify(body)})
 }}
}
test('실제 Mock 라우팅: current → 같은 원문 확정 replay → 다른 원문 충돌',async()=>{
 const {call}=await setup();const current=await call('GET','/api/creator/quizzes/generations/current');assert.equal(current.data.content.aiContentText,'원문')
 const path='/api/creator/quizzes/generations/42/content-confirmation'
 const first=await call('POST',path,{contentText:'  수정\n'});assert.equal(first.status,202);assert.equal(first.data.reviewStage,'GENERATING')
 const replay=await call('POST',path,{contentText:'  수정\n'});assert.equal(replay.data.contentConfirmedAt,first.data.contentConfirmedAt)
 assert.equal((await call('POST',path,{contentText:'다름'})).code,'QUIZ_GENERATION_CONTENT_CONFLICT')
})
test('실제 Mock 라우팅: 취소 멱등 및 current 빈 응답',async()=>{
 const {call}=await setup();const path='/api/creator/quizzes/generations/42/cancel'
 assert.equal((await call('POST',path)).data.failureCode,'CANCELLED');assert.equal((await call('POST',path)).data.failureCode,'CANCELLED')
 assert.equal((await call('GET','/api/creator/quizzes/generations/current')).data,undefined)
})
test('실제 Mock 라우팅: 공백 400·확정 OFF 503·취소 허용',async()=>{
 const {call,values}=await setup();const state=JSON.parse(values.get(key));state.generations[0].title+='[확정꺼짐]';values.set(key,JSON.stringify(state))
 const path='/api/creator/quizzes/generations/42/content-confirmation'
 assert.equal((await call('POST',path,{contentText:' '})).status,400);assert.equal((await call('POST',path,{contentText:'원문'})).status,503)
 assert.equal((await call('POST','/api/creator/quizzes/generations/42/cancel')).data.failureCode,'CANCELLED')
})
test('실제 Mock 라우팅: 확정 뒤 GENERATING을 거쳐 Quiz가 만들어진다',async()=>{
 const {call,values}=await setup();await call('POST','/api/creator/quizzes/generations/42/content-confirmation',{contentText:'고친 원문'})
 const state=JSON.parse(values.get(key));state.generations[0].contentConfirmedAt=Date.now()-6000;values.set(key,JSON.stringify(state))
 const done=await call('GET','/api/creator/quizzes/generations/42');assert.equal(done.data.status,'SUCCEEDED');assert.ok(done.data.quizId)
 assert.equal(JSON.parse(values.get(key)).quizzes[0].contentText,'고친 원문')
 const revision=await call('GET',`/api/creator/quizzes/${done.data.quizId}/revisions/${done.data.revisionId}`);assert.equal(revision.data.contentEdited,true);assert.ok(revision.data.contentConfirmedAt)
})
