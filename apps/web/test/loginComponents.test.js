import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
let browser,bundle,styles
const errors=[]
test.before(async()=>{
  const output=await build({configFile:false,plugins:[react()],logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production'),'import.meta.env.VITE_API_BASE_URL':JSON.stringify('http://auth.test')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/loginBrowser.jsx',import.meta.url)),name:'LoginTest',formats:['iife']}}})
  const parts=(Array.isArray(output)?output[0]:output).output
  bundle=parts.find(x=>x.type==='chunk').code
  styles=parts.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n')
  const executablePath=[process.env.HOME_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(existsSync)
  browser=await chromium.launch({headless:true,...executablePath?{executablePath}:{}})
})
test.after(async()=>{await browser?.close();assert.deepEqual(errors,[])})
async function screen({width=375,theme='dark',search='',failToken=false}={}){
  const p=await browser.newPage({viewport:{width,height:900}})
  p.on('pageerror',e=>errors.push(e.message))
  await p.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
  await p.goto('http://localhost/login-test')
  await p.evaluate(({theme,search,failToken})=>{
    document.documentElement.dataset.theme=theme
    window.toasts=[];window.restores=0;window.authCalls=[]
    window.loginPath=search?'/oauth/callback':'/login';window.loginSearch=search
    if(search)sessionStorage.setItem('cking.loginIntent',JSON.stringify({redirectTo:'/events/16'}))
    window.fetch=async(url,options={})=>{
      window.authCalls.push({path:new URL(String(url),location.href).pathname,body:options.body&&JSON.parse(options.body),credentials:options.credentials})
      return new Response(JSON.stringify(failToken?{code:'SYSTEM_ERROR',message:'Token exchange failed'}:{code:'SUCCESS',data:{accessToken:'test-access-token',expiresIn:3600}}),{status:failToken?500:200})
    }
  },{theme,search,failToken})
  await p.addStyleTag({content:styles});await p.addScriptTag({content:bundle})
  return p
}
for(const theme of ['dark','light'])for(const width of [375,1280])test(`login initially enabled without consent ${theme} ${width}px`,async()=>{
  const p=await screen({theme,width})
  try{
    const google=p.getByRole('button',{name:'구글로 시작하기',exact:true}),kakao=p.getByRole('button',{name:'카카오로 시작하기',exact:true})
    await google.waitFor()
    assert.equal(await p.getByRole('checkbox').count(),0)
    assert.equal(await p.getByText('이용약관 및 개인정보 수집·이용에 동의합니다.',{exact:true}).count(),0)
    assert.equal(await google.isEnabled(),true);assert.equal(await kakao.isEnabled(),true)
    const layout=await google.evaluate(el=>{
      const group=el.parentElement,buttons=group.children,rect=group.getBoundingClientRect()
      return {height:rect.height,expectedHeight:[...buttons].reduce((sum,x)=>sum+x.getBoundingClientRect().height,0)+parseFloat(getComputedStyle(group).rowGap),margin:getComputedStyle(group).marginTop,overflow:document.documentElement.scrollWidth>innerWidth}
    })
    assert.equal(layout.height,layout.expectedHeight);assert.equal(layout.margin,'0px');assert.equal(layout.overflow,false)
  }finally{await p.close()}
})
for(const [provider,label] of [['google','구글로 시작하기'],['kakao','카카오로 시작하기']])test(`${provider} click keeps OAuth start URL and login intent`,async()=>{
  const p=await screen()
  try{
    await p.getByRole('button',{name:label,exact:true}).waitFor()
    await p.route(`http://auth.test/oauth2/authorization/${provider}`,async route=>{
      await route.fulfill({contentType:'text/html',body:'OAuth intercepted'})
    })
    const navigation=p.waitForRequest(r=>r.isNavigationRequest()&&r.url()===`http://auth.test/oauth2/authorization/${provider}`)
    await p.getByRole('button',{name:label,exact:true}).click()
    const request=await navigation
    assert.equal(request.method(),'GET');assert.equal(request.postData(),null)
    await p.getByText('OAuth intercepted',{exact:true}).waitFor()
    await p.goto('http://localhost/inspect-intent')
    assert.deepEqual(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('cking.loginIntent'))),{redirectTo:'/events/16'})
  }finally{await p.close()}
})
test('provider failure restores existing session and returns to usable login',async()=>{
  const p=await screen({search:'?error=access_denied'})
  try{
    await p.getByRole('button',{name:'구글로 시작하기',exact:true}).waitFor()
    assert.equal(await p.getByRole('button',{name:'카카오로 시작하기',exact:true}).isEnabled(),true)
    assert.equal(await p.evaluate(()=>window.restores),1)
    assert.deepEqual(await p.evaluate(()=>window.authCalls),[])
    assert.deepEqual(await p.evaluate(()=>window.toasts),['로그인을 취소했어요.'])
    assert.equal(await p.evaluate(()=>sessionStorage.getItem('cking.loginIntent')),null)
  }finally{await p.close()}
})
test('token exchange failure keeps retry UI and session restoration',async()=>{
  const p=await screen({search:'?code=login-code',failToken:true})
  try{
    await p.getByRole('button',{name:'다시 시도',exact:true}).waitFor()
    assert.equal(await p.evaluate(()=>window.restores),1)
    const calls=await p.evaluate(()=>window.authCalls)
    assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/auth/token');assert.deepEqual(calls[0].body,{code:'login-code'});assert.equal(calls[0].credentials,'include')
    await p.getByRole('button',{name:'다시 시도',exact:true}).click()
    await p.getByRole('button',{name:'구글로 시작하기',exact:true}).waitFor()
  }finally{await p.close()}
})

test('successful callback exchanges code once and keeps token and destination',async()=>{
  const p=await screen({search:'?code=login-code'})
  try{
    await p.getByText('Destination',{exact:true}).waitFor()
    const calls=await p.evaluate(()=>window.authCalls)
    assert.equal(calls.length,1)
    assert.equal(calls[0].path,'/api/auth/token')
    assert.deepEqual(calls[0].body,{code:'login-code'})
    assert.equal(calls[0].credentials,'include')
    assert.ok(await p.evaluate(()=>sessionStorage.getItem('cking.accessToken')))
    assert.equal(await p.evaluate(()=>sessionStorage.getItem('cking.loginIntent')),null)
    assert.equal(await p.evaluate(()=>window.restores),0)
  }finally{await p.close()}
})
