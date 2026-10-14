import React from 'react'
import { createRoot } from 'react-dom/client'
import ProfilePhoto from '../../src/components/ui/ProfilePhoto.jsx'
import CreatorBanner from '../../src/components/creator/CreatorBanner.jsx'

const root = createRoot(document.getElementById('root'))

window.renderProfilePhoto = (src) => root.render(<ProfilePhoto src={src} className="h-12 w-12" />)
window.renderCreatorBanner = (src, profileSrc) => root.render(<CreatorBanner src={src} profileSrc={profileSrc} />)
