import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import homeIcon from '@cking/shared/icons/home.svg?raw';
import homeOutlineIcon from '@cking/shared/icons/home-outline.svg?raw';
import exploreIcon from '@cking/shared/icons/explore.svg?raw';
import exploreOutlineIcon from '@cking/shared/icons/explore-outline.svg?raw';
import couponIcon from '@cking/shared/icons/coupon.svg?raw';
import couponOutlineIcon from '@cking/shared/icons/coupon-outline.svg?raw';
import profileIcon from '@cking/shared/icons/profile.svg?raw';
import profileOutlineIcon from '@cking/shared/icons/profile-outline.svg?raw';
import { shouldResetNavigationOnClick, shouldResetSelectedNavigation } from './navigationScroll.js';

const NAV_ITEMS = [
  {
    to: '/',
    label: '홈',
    icon: homeIcon,
    outlineIcon: homeOutlineIcon,
    end: true,
  },
  {
    to: '/explore',
    label: '탐색',
    icon: exploreIcon,
    outlineIcon: exploreOutlineIcon,
  },
  {
    to: '/my-entries',
    label: '내 응모',
    icon: couponIcon,
    outlineIcon: couponOutlineIcon,
  },
  {
    to: '/my-page',
    label: 'MY',
    icon: profileIcon,
    outlineIcon: profileOutlineIcon,
  },
];

const INDICATOR_MOTION_MS = 520;
// 탭을 눌러 화면이 바뀔 때 독 펄스는 화면 전환 렌더링이 끝나 프레임이 안정된 뒤에 시작한다.
const SETTLE_CALM_FRAMES = 3;
const SETTLE_CALM_MS = 24;
const SETTLE_MAX_WAIT_MS = 700;

/** 프레임이 연속으로 SETTLE_CALM_FRAMES번 SETTLE_CALM_MS 안에 그려지면(최대 SETTLE_MAX_WAIT_MS 뒤에는 무조건) callback을 부른다. 취소 함수를 돌려준다. */
function afterFramesSettle(callback) {
  const started = performance.now();
  let last = started;
  let calm = 0;
  let frameId = null;
  const tick = (now) => {
    calm = now - last <= SETTLE_CALM_MS ? calm + 1 : 0;
    last = now;
    if (calm >= SETTLE_CALM_FRAMES || now - started > SETTLE_MAX_WAIT_MS) {
      frameId = null;
      callback();
      return;
    }
    frameId = window.requestAnimationFrame(tick);
  };
  frameId = window.requestAnimationFrame(tick);
  return () => {
    if (frameId !== null) window.cancelAnimationFrame(frameId);
  };
}

/** 시안의 프로스티드 글래스 하단 독. 알림은 앱바에서 연다. */
export default function BottomNav({ embedded = false, compact = false, onNavigate }) {
  const { pathname } = useLocation();
  const previousIndex = useRef(null);
  const pulseTimerRef = useRef(null);
  const pendingPulseRef = useRef(false);
  const pendingTimerRef = useRef(null);
  const [motion, setMotion] = useState(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const activeIndex = NAV_ITEMS.findIndex((item) =>
    item.end
      ? pathname === item.to
      : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  useEffect(() => {
    if (previousIndex.current === null) {
      previousIndex.current = activeIndex;
      return undefined;
    }
    if (previousIndex.current === activeIndex) return undefined;

    const direction = activeIndex > previousIndex.current ? 'right' : 'left';
    previousIndex.current = activeIndex;
    setMotion(direction);
    const timer = window.setTimeout(() => setMotion(null), INDICATOR_MOTION_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  useEffect(() => () => {
    window.clearTimeout(pulseTimerRef.current);
    window.clearTimeout(pendingTimerRef.current);
  }, []);

  // 다른 탭을 눌러 화면이 바뀌면(활성 탭이 바뀐 뒤) 프레임이 안정될 때까지 기다렸다가 펄스를 준다.
  // 화면 전환 렌더링과 겹쳐 독 애니메이션이 멈칫하는 것을 피하려는 것이다.
  useEffect(() => {
    if (!pendingPulseRef.current) return undefined;
    pendingPulseRef.current = false;
    return afterFramesSettle(pulseDock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  /** 하단 메뉴 선택을 시각적으로 알리기 위해 독 펄스 애니메이션을 실행한다. */
  const pulseDock = () => {
    setIsPulsing(false);
    window.requestAnimationFrame(() => setIsPulsing(true));
    window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setIsPulsing(false), 520);
  };

  /** 하단 메뉴를 누를 때 독 애니메이션을 실행하고 활성 메뉴 재선택만 스크롤을 초기화한다. */
  const handleNavigationClick = (event, isSelected) => {
    if (!shouldResetNavigationOnClick(event)) return;
    if (isSelected) {
      pulseDock();
    } else {
      // 이동이 일어나지 않으면 펄스는 생략한다(남아 있는 예약이 나중의 다른 이동에 붙지 않게 시간을 둔다).
      pendingPulseRef.current = true;
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = window.setTimeout(() => { pendingPulseRef.current = false; }, SETTLE_MAX_WAIT_MS * 2);
    }
    if (shouldResetSelectedNavigation(event, isSelected)) onNavigate?.();
  };

  return (
    <nav
      className={
        embedded
          ? 'pull-to-refresh-fixed fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] md:max-w-none md:px-6'
          : 'pull-to-refresh-fixed fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-50 pb-safe bg-surface-container/90 backdrop-blur-xl shadow-dock'
      }
    >
      <div
        className={`liquid-nav-dock mx-auto grid items-center rounded-full transition-[width,height,padding] duration-300 ease-out ${
          isPulsing ? 'is-pulsing' : ''
        } ${
          compact
            ? 'is-compact h-11 w-[20.5rem] max-w-full px-0'
            : 'h-[3.25rem] w-full max-w-[28rem] px-0'
        } relative`}
        style={{
          gridTemplateColumns: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))`,
          '--liquid-nav-item-count': NAV_ITEMS.length,
          '--liquid-nav-active-index': Math.max(activeIndex, 0),
        }}
      >
        <span
          aria-hidden="true"
          className={`liquid-nav-indicator pointer-events-none absolute rounded-[50px] ${
            motion ? `is-moving is-moving-${motion}` : ''
          } ${activeIndex >= 0 ? 'opacity-100' : 'opacity-0'}`}
        />
        {NAV_ITEMS.map((item, index) => {
          const isSelected = activeIndex === index;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={(event) => handleNavigationClick(event, isSelected)}
              aria-label={item.label}
              className={`relative z-10 flex flex-1 flex-col items-center justify-center min-w-0 rounded-full transition-[height,color] duration-300 ease-out active:scale-95 ${
                compact ? 'h-9' : 'h-10'
              } ${
                isSelected
                  ? 'text-on-surface font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span
                aria-hidden="true"
                className={`${compact ? 'h-[21px] w-[21px] text-[21px]' : 'h-6 w-6 text-[24px]'} block leading-none [&>svg]:block [&>svg]:h-full [&>svg]:w-full`}
                dangerouslySetInnerHTML={{
                  __html: isSelected ? item.icon : item.outlineIcon,
                }}
              />
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
