import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import EventCard from '../../src/components/creator/EventCard.jsx'

// 이벤트 카드 배너의 로딩 방식을 검증하는 화면. 스페이스처럼 앞의 두 장만 priority를 준다.
const events = [11, 12, 13, 14].map((eventId) => ({
  eventId, creatorId: 1, title: `이벤트 ${eventId}`, displayStatus: 'IN_PROGRESS', status: 'OPEN',
  startAt: '2026-10-20T00:00:00Z', endAt: '2026-10-30T00:00:00Z', winnerCount: 3, prizes: [],
}))
createRoot(document.getElementById('root')).render(
  <MemoryRouter>
    <div style={{ display: 'flex', gap: 8 }}>
      {events.map((event, index) => <EventCard key={event.eventId} event={event} priority={index < 2} />)}
    </div>
  </MemoryRouter>,
)
