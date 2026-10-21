import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
let browser, bundle, styles
const errors=[]
test.before(async()=>{
  const output=await build({configFile:false,plugins:[react()],logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,lib:{entry:fileURLToPath(new URL('./fixtures/winnerContrastBrowser.jsx',import.meta.url)),name:'WinnerTest',formats:['iife']}}})
  const parts=(Array.isArray(output)?output[0]:output).output
  bundle=parts.find(x=>x.type==='chunk').code
  styles=parts.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n')
  const executablePath=[process.env.HOME_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(existsSync)
  browser=await chromium.launch({headless:true,...executablePath?{executablePath}:{}})
})
test.after(async()=>{await browser?.close();assert.deepEqual(errors,[])})
for(const theme of ['dark','light'])for(const width of [375,1280])test(`winner contrast ${theme} ${width}px preserves other cards`,async()=>{
  const p=await browser.newPage({viewport:{width,height:900}})
  p.on('pageerror',e=>errors.push(e.message))
  try{
    await p.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort())
    await p.goto('http://localhost/winner-test')
    await p.evaluate(theme=>{
      document.documentElement.dataset.theme=theme
      window.winnerRequests=[]
      window.fetch=async(url,options={})=>{
        if(options.method && options.method!=='GET')throw Error('Unexpected mutation')
        const path=new URL(String(url),location.href).pathname
        window.winnerRequests.push(path)
        let data=null
        if(path==='/api/events/16')data={eventId:16,title:'Result event',status:'PUBLISHED',displayStatus:'CLOSED',startAt:'2026-01-01T00:00:00Z',endAt:'2026-02-01T00:00:00Z',winnerCount:2,prizes:[]}
        else if(path==='/api/events/16/winners')data={winners:[{winnerId:1,rankInDrawing:1,name:'Masked mine',prizeDisplayName:'First prize'},{winnerId:2,rankInDrawing:2,name:'Other winner',prizeDisplayName:'Second prize'}]}
        else if(path==='/api/me/winners')data=[{winnerId:1}]
        return new Response(JSON.stringify({code:'SUCCESS',data}),{status:200})
      }
    },theme)
    await p.addStyleTag({content:styles})
    await p.addScriptTag({content:bundle})
    const mine=p.getByText('나의 당첨 🎉',{exact:true})
    await mine.waitFor()
    const measurements=await mine.evaluate(el=>{
      const card=el.closest('li'), other=[...card.parentElement.children].find(x=>x!==card)
      const color=e=>getComputedStyle(e).color
      const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number)
      const luminance=s=>rgb(s).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0)
      const bg=getComputedStyle(card).backgroundColor
      const ratio=e=>{const a=luminance(color(e)),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
      const probe=document.createElement('div');probe.className='bg-surface-container-low text-on-surface';document.body.append(probe)
      const variant=document.createElement('span');variant.className='text-on-surface-variant';probe.append(variant)
      const result={ratios:[...card.querySelectorAll('p')].map(ratio),background:bg,border:getComputedStyle(card).borderTopColor,primary:getComputedStyle(card.querySelector('span')).color,otherBackground:getComputedStyle(other).backgroundColor,expectedOtherBackground:getComputedStyle(probe).backgroundColor,otherColors:[...other.querySelectorAll('p')].map(color),expectedOtherColors:[color(probe),color(variant)],ranks:[...card.parentElement.children].map(x=>x.querySelector('span').textContent.trim()),overflow:card.scrollWidth>card.clientWidth}
      probe.remove();return result
    })
    assert.equal(await p.getByText('First prize',{exact:true}).count(),1)
    assert.equal(await p.getByText('Other winner',{exact:true}).count(),1)
    assert.equal(await p.getByText('Second prize',{exact:true}).count(),1)
    // 내 당첨 카드는 berry-tint 배경이다. 다크는 예전 연분홍 그대로, 라이트는 쿨 그레이 개편의 #fceaf2다.
    assert.equal(measurements.background,theme==='dark'?'rgb(253, 242, 248)':'rgb(252, 234, 242)')
    assert.equal(measurements.border,measurements.primary)
    assert.deepEqual(measurements.ranks,['1','2'])
    assert.equal(measurements.overflow,false)
    assert.equal(measurements.otherBackground,measurements.expectedOtherBackground)
    assert.deepEqual(measurements.otherColors,measurements.expectedOtherColors)
    measurements.ratios.forEach(ratio=>assert.ok(ratio>=4.5,`contrast ${ratio.toFixed(2)} below AA`))
    console.log(theme,width,'contrast ratios',measurements.ratios.map(x=>x.toFixed(2)))
  }finally{await p.close()}
})
