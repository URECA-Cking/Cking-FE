import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import CreatorVerifiedBadge from '../../src/components/ui/CreatorVerifiedBadge.jsx'
import CreatorRow from '../../src/components/creator/CreatorRow.jsx'
import CreatorAvatarItem from '../../src/components/creator/CreatorAvatarItem.jsx'

const creator = { name: '테스트 Creator', handle: 'test', avatar: null, bio: '소개' }
createRoot(document.getElementById('root')).render(
  <MemoryRouter>
    <section aria-label="기준 배지"><CreatorVerifiedBadge /></section>
    <section aria-label="목록"><CreatorRow creator={creator} onToggle={() => {}} /></section>
    <section aria-label="홈 항목"><CreatorAvatarItem creator={creator} /></section>
  </MemoryRouter>,
)
