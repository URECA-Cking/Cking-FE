import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../../src/index.css'
import CreatorPosts from '../../src/components/creator/CreatorPosts.jsx'
import UserContext from '../../src/context/userContext.js'
import ToastContext from '../../src/context/toastContext.js'

// 홈 새 게시물 카드로 들어온 상세(?from=feed)와 목록에서 직접 연 상세를 닫는 동작을 검증하는 화면.
// onLeaveToOrigin은 CreatorSpace가 넘기는 goBack(홈으로 돌아가기)을 흉내 내며 호출 횟수만 센다.
window.leaveCalls = 0
window.openedCalls = 0
const fromFeed = new URLSearchParams(window.location.search).get('from') === 'feed'
createRoot(document.getElementById('root')).render(
  <MemoryRouter><ToastContext.Provider value={() => {}}>
    <UserContext.Provider value={{ status: 'authenticated', isAdmin: false }}>
      <CreatorPosts
        creatorId={13}
        creatorName="크리에이터"
        authenticated
        following
        isMine={false}
        memberId={7}
        initialPostId={fromFeed ? 5 : null}
        onInitialPostOpened={() => { window.openedCalls += 1 }}
        onLeaveToOrigin={() => { window.leaveCalls += 1 }}
      />
    </UserContext.Provider>
  </ToastContext.Provider></MemoryRouter>,
)
