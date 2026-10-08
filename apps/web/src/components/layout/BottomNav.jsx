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

const INDICATOR_MOTION_MS = 380;

/** 시안의 프로스티드 글래스 하단 독. 알림은 앱바에서 연다. */
export default function BottomNav({ embedded = false, compact = false }) {
  const { pathname } = useLocation();
  const previousIndex = useRef(null);
  const pulseTimerRef = useRef(null);
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

  useEffect(() => () => window.clearTimeout(pulseTimerRef.current), []);

  const pulseDock = () => {
    setIsPulsing(false);
    window.requestAnimationFrame(() => setIsPulsing(true));
    window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setIsPulsing(false), 220);
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
              onClick={pulseDock}
              className={`relative z-10 flex flex-1 flex-col items-center justify-center min-w-0 rounded-full gap-0.5 transition-[height,color] duration-300 ease-out active:scale-95 ${
                compact ? 'h-9' : 'h-10'
              } ${
                isSelected
                  ? 'text-white font-semibold'
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
              <span
                className={`relative font-label-xs font-medium transition-[font-size] duration-300 ${compact ? 'text-[9px] leading-3' : 'text-label-xs'}`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
