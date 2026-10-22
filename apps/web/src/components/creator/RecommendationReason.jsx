/** 추천 이유. 박스 태그(관심 분야)와 박스 없는 작은 핑크 글씨(도킹 기반) 두 모양이다. */
export default function RecommendationReason({ reason }) {
  if (reason.boxed) {
    return <span className="self-start max-w-full px-2 py-0.5 rounded-full bg-berry-tint font-label-xs text-label-xs text-primary break-words">{reason.text}</span>
  }
  return <p className="text-[10px] leading-[14px] font-semibold text-primary line-clamp-2">{reason.text}</p>
}
