import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {build} from 'vite'
import react from '@vitejs/plugin-react'
import {chromium} from '@playwright/test'
let browser,bundle
const errors=[]
test.before(async()=>{
 const output=await build({configFile:false,plugins:[react()],logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production'),'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://space.test')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/spaceImagesBrowser.jsx',import.meta.url)),name:'SpaceTest',formats:['iife']}}})
 bundle=(Array.isArray(output)?output[0]:output).output.find(x=>x.type==='chunk').code
 const executablePath=[process.env.HOME_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(existsSync)
 browser=await chromium.launch({headless:true,...executablePath?{executablePath}:{}})
})
test.after(async()=>{await browser?.close();assert.deepEqual(errors,[])})
const base={creatorId:1,slug:'creator-1',introText:'intro',profileImageUrl:'https://images.test/profile-old.png',bannerImageUrl:'https://images.test/banner-old.png'}
async function screen({bannerOnly=false,bannerUrl=null,brokenBanner=false,failUpload=false,profileUrl=base.profileImageUrl}={}){
 const p=await browser.newPage()
 p.on('pageerror',e=>errors.push(e.message))
 await p.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
 await p.goto('http://localhost/space-test')
 const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=200;c.getContext('2d').fillRect(0,0,600,200);return c.toDataURL('image/png').split(',')[1]})
 await p.route('https://images.test/**',r=>(brokenBanner&&r.request().url().includes('banner-old'))?r.abort():r.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}))
 await p.evaluate(({base,bannerOnly,bannerUrl,failUpload,profileUrl})=>{
  window.bannerOnly=bannerOnly;window.bannerUrl=bannerUrl;window.profileUrl=profileUrl
  window.spaceRecord={...base};window.calls=[];window.toasts=[]
  window.fetch=async(url,options={})=>{
   const path=new URL(String(url),location.href).pathname,method=options.method??'GET'
   const reply=(data,status=200)=>new Response(JSON.stringify({code:status===200?'SUCCESS':'SYSTEM_ERROR',data,message:'upload failed'}),{status})
   const body=typeof options.body==='string'?JSON.parse(options.body):null
   if(path==='/api/uploads')return new Response(JSON.stringify({code:'RESOURCE_NOT_FOUND',data:null,message:null}),{status:404})
   window.calls.push({path,method,body})
   if(path.endsWith('/profile-images'))return reply({imageKey:'profile-new'},failUpload?500:200)
   if(path.endsWith('/banner-images'))return reply({imageKey:'banner-new'},failUpload?500:200)
   if(path==='/api/creator/profile')return reply(null)
   if(path==='/api/creator/space'){
    if(method==='PATCH'){
     window.spaceRecord={...window.spaceRecord,introText:body.introText,profileImageUrl:body.profileImageKey==='profile-new'?'https://images.test/profile-new.png':body.profileImageUrl,bannerImageUrl:body.bannerImageKey==='banner-new'?'https://images.test/banner-new.png':body.bannerImageUrl}
    }
    return reply({...window.spaceRecord})
   }
   throw Error(path)
  }
 },{base,bannerOnly,bannerUrl,failUpload,profileUrl})
 await p.addScriptTag({content:bundle})
 if(!bannerOnly)await p.getByRole('button',{name:'저장',exact:true}).waitFor()
 return {p,png}
}
const banner=p=>p.getByRole('button',{name:'배너 이미지 변경',exact:true})
async function upload(p,png,index){await p.locator('input[type=file]').nth(index).setInputFiles({name:'image.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await p.getByRole('button',{name:'저장',exact:true}).waitFor();await p.waitForFunction(()=>![...document.querySelectorAll('button')].find(x=>x.textContent==='저장')?.disabled)}
for(const bannerUrl of [null,'javascript:bad','https://images.test/banner-old.png'])test(`banner never reuses avatar when absent/invalid/failed: ${bannerUrl}`,async()=>{
 const {p}=await screen({bannerOnly:true,bannerUrl,brokenBanner:true})
 try{
  if(bannerUrl?.startsWith('https'))await p.waitForFunction(()=>!document.querySelector('[data-testid=banner] img')||document.querySelector('[data-testid=banner] img').src.includes('profile'))
  assert.equal(await p.locator('[data-testid=banner] img').count(),0)
 }finally{await p.close()}
})
// 저장 버튼은 바뀐 항목만 저장한다(#401). 아무것도 바꾸지 않으면 눌리지 않고 PATCH도 보내지 않는다.
test('no change keeps the single save button disabled and sends no PATCH',async()=>{
 const {p}=await screen()
 try{
  assert.equal(await p.getByRole('button',{name:'저장',exact:true}).isDisabled(),true)
  assert.equal(await p.evaluate(()=>window.calls.some(x=>x.method==='PATCH')),false)
 }finally{await p.close()}
})
for(const change of ['profile','banner','both'])test(`independent images ${change}: request, save, reload`,async()=>{
 const {p,png}=await screen()
 try{
  if(change==='profile'||change==='both')await upload(p,png,0)
  if(change==='banner'||change==='both')await upload(p,png,1)
  await p.getByRole('button',{name:'저장',exact:true}).click()
  await p.waitForFunction(()=>window.toasts.includes('스페이스 정보를 저장했어요.'))
  const request=await p.evaluate(()=>window.calls.find(x=>x.method==='PATCH'))
  assert.equal(request.body.profileImageUrl,base.profileImageUrl);assert.equal(request.body.bannerImageUrl,base.bannerImageUrl)
  assert.equal(request.body.profileImageKey,change==='profile'||change==='both'?'profile-new':undefined)
  assert.equal(request.body.bannerImageKey,change==='banner'||change==='both'?'banner-new':undefined)
  await p.getByRole('button',{name:'Reload saved space'}).click()
  await p.waitForFunction(()=>window.calls.some(x=>x.method==='GET'&&x.path==='/api/creator/space'))
  // GET 시작이 아니라 새 시트의 재마운트까지 기다린 뒤 이미지 대체 상태를 검사한다.
  await p.getByTestId('space-reload-version').filter({hasText:'1'}).waitFor()
  const expectedProfile=change==='profile'||change==='both'?'https://images.test/profile-new.png':base.profileImageUrl
  const expectedBanner=change==='banner'||change==='both'?'https://images.test/banner-new.png':base.bannerImageUrl
  await p.waitForFunction(({profile,banner})=>document.querySelector('[aria-label="프로필 사진 변경"] img')?.src===profile&&document.querySelector('[aria-label="배너 이미지 변경"] img')?.src===banner,{profile:expectedProfile,banner:expectedBanner})
  assert.deepEqual(await p.evaluate(()=>({profile:window.spaceRecord.profileImageUrl,banner:window.spaceRecord.bannerImageUrl})),{profile:expectedProfile,banner:expectedBanner})
 }finally{await p.close()}
})
test('profile save with broken existing banner keeps stored URL and neutral banner after reload',async()=>{
 const {p,png}=await screen({brokenBanner:true})
 try{
  await upload(p,png,0);await p.getByRole('button',{name:'저장',exact:true}).click()
  await p.waitForFunction(()=>window.toasts.includes('스페이스 정보를 저장했어요.'))
  await p.getByRole('button',{name:'Reload saved space'}).click()
  await p.waitForFunction(()=>window.calls.some(x=>x.method==='GET'&&x.path==='/api/creator/space'))
  // GET 시작이 아니라 새 시트의 재마운트까지 기다린 뒤 이미지 대체 상태를 검사한다.
  await p.getByTestId('space-reload-version').filter({hasText:'1'}).waitFor()
  await p.waitForFunction(()=>!document.querySelector('[aria-label="배너 이미지 변경"] img')||document.querySelector('[aria-label="배너 이미지 변경"] img').src.includes('profile'))
  assert.equal(await banner(p).locator('img').count(),0)
  assert.equal(await p.evaluate(()=>window.spaceRecord.bannerImageUrl),base.bannerImageUrl)
 }finally{await p.close()}
})
for(const index of [0,1])test(`failed upload ${index} preserves existing images`,async()=>{
 const {p,png}=await screen({failUpload:true})
 try{
  // 업로드에 실패하면 바뀐 이미지가 없어 저장 버튼이 눌리지 않는다. 소개를 고쳐 저장해도 이미지 key는 보내지 않는다.
  await p.locator('input[type=file]').nth(index).setInputFiles({name:'image.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
  await p.getByRole('alert').waitFor()
  assert.equal(await p.getByRole('button',{name:'저장',exact:true}).isDisabled(),true)
  await p.locator('textarea').fill('intro changed')
  await p.getByRole('button',{name:'저장',exact:true}).click()
  await p.waitForFunction(()=>window.toasts.includes('스페이스 정보를 저장했어요.'))
  const request=await p.evaluate(()=>window.calls.find(x=>x.method==='PATCH'))
  assert.equal(request.body.profileImageKey,undefined);assert.equal(request.body.bannerImageKey,undefined)
  assert.equal(await p.evaluate(()=>window.spaceRecord.profileImageUrl),base.profileImageUrl)
  assert.equal(await p.evaluate(()=>window.spaceRecord.bannerImageUrl),base.bannerImageUrl)
 }finally{await p.close()}
})

test('no existing profile or banner displays neutral placeholder',async()=>{
 const {p}=await screen({bannerOnly:true,bannerUrl:null,profileUrl:null})
 try{assert.equal(await p.locator('[data-testid=banner] img').count(),0)}finally{await p.close()}
})
