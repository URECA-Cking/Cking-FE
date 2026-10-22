import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import SpaceEditSheet from '../../src/components/creator/SpaceEditSheet.jsx'
import CreatorBanner from '../../src/components/creator/CreatorBanner.jsx'
import ToastContext from '../../src/context/toastContext.js'
function Fixture(){
  const [space,setSpace]=useState(window.spaceRecord)
  const [version,setVersion]=useState(0)
  return <MemoryRouter><ToastContext.Provider value={message=>window.toasts.push(message)}>
    {window.bannerOnly ? <div data-testid="banner"><CreatorBanner src={window.bannerUrl} profileSrc={window.profileUrl}/></div> : <>
      <button onClick={async()=>{const response=await fetch('http://space.test/api/creator/space');setSpace((await response.json()).data);setVersion(x=>x+1)}}>Reload saved space</button>
      <output data-testid="space-reload-version">{version}</output>
      <SpaceEditSheet key={version} open onClose={()=>{}} space={space} onSaved={fields=>setSpace(prev=>({...prev,...fields}))}/>
    </>}
  </ToastContext.Provider></MemoryRouter>
}
createRoot(document.getElementById('root')).render(<Fixture/> )
