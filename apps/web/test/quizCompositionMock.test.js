import test from 'node:test'
import assert from 'node:assert/strict'
import { composeMockRevision, approveMockComposition, ensureCompositionMetadata } from '../src/dev/quizMock.js'
const id='00000000-0000-4000-8000-000000000001'
const state=()=>({seq:1000,compositions:[],judges:[],quizzes:[{quizId:1,creatorId:10,contentText:'text',videoId:'dQw4w9WgXcQ',publicationStatus:'NOT_PUBLISHED',revisions:[{revisionId:100,revisionNo:1,title:'T',questions:Array.from({length:5},(_,i)=>({questionNo:i,question:'Q'+i,options:['A','B','C','D'].map((text,optionNo)=>({text,optionNo})),correctOptionIndex:0,explanation:'E',sourceEvidence:'S'})),reviewStatus:'PENDING_REVIEW'}]}]})
test('실제 Mock 저장은 순서·hash·계보를 고정하고 stale 이후도 replay한다',async()=>{const s=state();await ensureCompositionMetadata(s);const r=s.quizzes[0].revisions[0];const body={requestId:id,baseRevisionId:100,baseRevisionSha256:r.revisionSha256,questions:[{sourceQuestionId:r.questions[4].questionId},{sourceQuestionId:r.questions[0].questionId}]};const saved=await composeMockRevision(s,10,1,body,0);assert.equal(saved.status,201);assert.equal(saved.data.questions[0].previousQuestionId,r.questions[4].questionId);assert.match(saved.data.revisionSha256,/^[a-f0-9]{64}$/);assert.equal((await composeMockRevision(s,10,1,body,0)).status,200);assert.equal((await composeMockRevision(s,10,1,{...body,questions:body.questions.slice(0,1)},0)).code,'QUIZ_EDIT_REQUEST_CONFLICT');assert.equal((await composeMockRevision(s,10,1,{...body,requestId:id.replace(/1$/,'2')},0)).code,'QUIZ_REVISION_CONFLICT')})
test('책임 확인과 hash 필요, Judge 없이 승인하고 게시 잠금을 유지한다',async()=>{const s=state();await ensureCompositionMetadata(s);const r=s.quizzes[0].revisions[0];const body={requestId:id,baseRevisionId:100,baseRevisionSha256:r.revisionSha256,questions:[{content:{question:'new',options:['A','B','C','D'],correctOptionIndex:1,explanation:'E'}}]};const saved=await composeMockRevision(s,10,1,body,0);const request={revisionSha256:saved.data.revisionSha256,acknowledgeResponsibility:true};assert.equal(approveMockComposition(s,10,1,saved.data.revisionId,{...request,acknowledgeResponsibility:false},0).status,400);assert.equal(approveMockComposition(s,10,1,saved.data.revisionId,request,0).data.reviewStatus,'APPROVED');s.quizzes[0].contentLocked=true;assert.equal((await composeMockRevision(s,10,1,body,0)).status,200);assert.equal((await composeMockRevision(s,10,1,{...body,requestId:id.replace(/1$/,'2')},0)).code,'QUIZ_CONTENT_LOCKED')})

test('FAIL/UNCERTAIN 원본 평가를 복사·수정 상태와 구분한다',async()=>{const s=state();await ensureCompositionMetadata(s);const r=s.quizzes[0].revisions[0];s.judges=[{evaluationId:1,resultId:501,status:'SUCCEEDED',revisionId:100,questions:r.questions.map(q=>({questionNo:q.questionNo,items:{uniqueAnswer:{verdict:q.questionNo===0?'fail':'uncertain',reason:'원본 이유'}}}))}];const saved=await composeMockRevision(s,10,1,{requestId:id,baseRevisionId:100,baseRevisionSha256:r.revisionSha256,questions:[{sourceQuestionId:r.questions[0].questionId},{sourceQuestionId:r.questions[1].questionId},{sourceQuestionId:r.questions[2].questionId,content:{question:'수정',options:['A','B','C','D'],correctOptionIndex:1,explanation:'E'}}]},0);assert.deepEqual(saved.data.questions.map(q=>q.evaluationStatus),['FAIL','UNCERTAIN','NOT_REVALIDATED']);assert.equal(saved.data.questions[2].sourceEvaluation.items.uniqueAnswer.verdict,'uncertain');assert.equal(saved.data.questions[2].sourceEvidence,'')})

// exported helper와 실제 routes가 동일한 계약을 처리하는지 외부 fetch 없이 확인한다.
test('실제 Mock 라우팅은 저장→책임 승인→게시→취소→재게시를 연결한다',async()=>{
 const {quizMockRoutes}=await import('../src/dev/quizMock.js');const savedStorage=globalThis.sessionStorage;const map=new Map();globalThis.sessionStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 try{
  const routes=quizMockRoutes({myCreatorId:1,memberId:7});const call=async(method,path,body)=>{const url=new URL(path,'http://mock.test');const route=routes.find(([m,re])=>m===method&&re.test(path));assert.ok(route,path);const match=path.match(route[1]);return route[2](...match.slice(1),url,{body:body?JSON.stringify(body):undefined})}
  const original=(await call('GET','/api/creator/quizzes/2/revisions/200')).data
  const stored=await call('POST','/api/creator/quizzes/2/revisions',{requestId:id,baseRevisionId:200,baseRevisionSha256:original.revisionSha256,questions:[{sourceQuestionId:original.questions[1].questionId}]});assert.equal(stored.status,201)
  const rid=stored.data.revisionId;assert.equal((await call('POST',`/api/creator/quizzes/2/revisions/${rid}/approve`)).code,'QUIZ_REVISION_CONFLICT')
  assert.equal((await call('POST',`/api/creator/quizzes/2/revisions/${rid}/creator-approval`,{revisionSha256:stored.data.revisionSha256,acknowledgeResponsibility:true})).data.reviewStatus,'APPROVED')
  assert.equal((await call('POST','/api/creator/quizzes/2/publish',{revisionId:rid})).data.publicationStatus,'PUBLISHED')
  const publicView=(await call('GET','/api/creators/1/quizzes/2')).data;assert.equal(publicView.questions.length,1);assert.equal(publicView.questions[0].explanation,undefined);assert.equal(publicView.questions[0].correctOptionIndex,undefined)
  await call('POST','/api/creator/quizzes/2/unpublish');assert.equal((await call('GET',`/api/creator/quizzes/2/revisions/${rid}`)).data.canEdit,false);assert.equal((await call('POST','/api/creator/quizzes/2/publish',{revisionId:rid})).data.publicationStatus,'PUBLISHED')
 }finally{if(savedStorage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=savedStorage}
})

test('구성한 1~5문항의 Fan 채점·영점/만점·응시 replay를 유지한다',async()=>{
 const {submitQuizAttempt}=await import('../src/dev/quizMock.js')
 for(let count=1;count<=5;count++)for(const perfect of [false,true]){
  const s=state();s.attempts=[];await ensureCompositionMetadata(s);const r=s.quizzes[0].revisions[0]
  const saved=await composeMockRevision(s,10,1,{requestId:id,baseRevisionId:100,baseRevisionSha256:r.revisionSha256,questions:r.questions.slice(0,count).map(q=>({sourceQuestionId:q.questionId}))},0)
  s.quizzes[0].publicationStatus='PUBLISHED';s.quizzes[0].publishedRevisionId=saved.data.revisionId
  const request={memberId:900,myCreatorId:null,creatorId:10,quizId:1,body:{requestId:'00000000-0000-4000-8000-000000000009',revisionId:saved.data.revisionId,answers:Array.from({length:count},(_,questionNo)=>({questionNo,selectedOptionIndex:perfect?0:1}))}}
  const result=submitQuizAttempt(s,request,1);assert.equal(result.questionCount,count);assert.equal(result.correctCount,perfect?count:0);assert.equal(result.reward.amount,perfect?count:0);assert.deepEqual(submitQuizAttempt(s,request,1),result)
 }
})
