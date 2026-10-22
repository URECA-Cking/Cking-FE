import React from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import YoutubeSubscriptionMissionCard from '../../src/components/creator/YoutubeSubscriptionMissionCard.jsx'

// YouTube 구독 인증 카드에서 이미지를 고른 뒤 미리보기를 검증하는 화면.
const root = createRoot(document.getElementById('root'))
window.unmountCard = () => root.unmount()
root.render(
  <YoutubeSubscriptionMissionCard
    creatorId={11}
    mission={{ missionId: 6, rewardAmount: 1 }}
    channel={{ channelName: '테스트 채널', channelHandle: '@test-channel', channelUrl: 'https://www.youtube.com/@test-channel' }}
  />,
)
