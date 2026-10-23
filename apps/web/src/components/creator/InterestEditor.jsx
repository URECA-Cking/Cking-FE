import { useMemo, useState } from 'react'
import { saveMyInterests } from '../../api/interests.js'
import { describeError } from '../../api/client.js'
import { useToast } from '../../context/useToast.js'
import MaterialIcon from '../ui/MaterialIcon.jsx'

const sameSet = (a, b) => a.length === b.length && a.every((code) => b.includes(code))

/**
 * 탐색 추천 위에서 관심 분야(태그)를 다시 고른다. 온보딩 1단계와 같은 API·규칙을 쓴다.
 * 부모가 조회한 활성 카탈로그와 회원 선택을 추천 카드와 공유한다.
 * 상한은 카탈로그의 maxSelection으로 먼저 막고, 저장할 taxonomyVersion도 카탈로그 값을 쓴다.
 * 저장이 끝나면 onSaved로 알려 추천을 다시 받게 한다.
 */
export default function InterestEditor({ catalog, catalogError, onRetryCatalog, mine, mineError, mineLoading, onReloadMine, onSaved }) {
  const showToast = useToast()
  const [editing, setEditing] = useState(false)
  // null이면 아직 건드리지 않은 것이라 서버에 저장된 선택을 그대로 보여준다.
  const [picked, setPicked] = useState(null)
  const [saving, setSaving] = useState(false)

  const items = useMemo(() => catalog?.items ?? [], [catalog])
  const names = useMemo(() => new Map(items.map((item) => [item.interestCode, item.name])), [items])
  const saved = useMemo(() => mine?.interestCodes ?? [], [mine])
  // 분류체계가 바뀌면 예전 버전의 코드가 저장돼 있을 수 있다. 화면에 이름이 없는 코드는 보여 주지도, 선택 개수에 넣지도 않고,
  // 편집도 현재 카탈로그에 있는 코드에서 시작한다. 저장하면 예전 코드는 함께 빠진다.
  const active = useMemo(() => saved.filter((code) => names.has(code)), [saved, names])
  const current = picked ?? active
  const max = catalog?.maxSelection ?? 3
  const changed = picked !== null && !sameSet(picked, saved)

  if (catalogError || mineError) {
    return (
      <button type="button" onClick={catalogError ? onRetryCatalog : onReloadMine} className="mx-margin mb-2 self-start font-label-sm text-label-sm text-primary">
        관심 분야 다시 불러오기
      </button>
    )
  }
  if (mineLoading) return null
  if (!catalog?.taxonomyVersion || items.length === 0) return null

  // 렌더 시점의 값이 아니라 직전 상태를 기준으로 바꿔, 빠르게 연달아 눌러도 앞선 선택을 잃지 않는다.
  function toggle(code) {
    setPicked((prev) => {
      const base = prev ?? active
      const next = base.includes(code) ? base.filter((item) => item !== code) : [...base, code]
      return next.length > max ? base : next
    })
  }

  async function handleSave() {
    if (!changed) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await saveMyInterests({ taxonomyVersion: catalog.taxonomyVersion, interestCodes: picked })
      // 서버 값을 다시 받지 않고 방금 저장한 값을 기준으로 삼는다. 다음 편집은 이 값에서 시작한다.
      onReloadMine()
      setPicked(null)
      setEditing(false)
      showToast('관심 분야를 저장했어요. 추천을 새로 불러올게요.')
      onSaved?.()
    } catch (err) {
      showToast(describeError(err, '관심 분야를 저장하지 못했어요.'), { icon: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // 편집은 현재 카탈로그에 있는 코드로 시작한다. 예전 코드가 저장돼 있으면 그대로 저장만 눌러도 변경으로 보고 정리한다.
  function handleStartEdit() {
    setPicked(active)
    setEditing(true)
  }

  function handleCancel() {
    setPicked(null)
    setEditing(false)
  }

  return (
    <div className="px-margin mb-space-sm flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
          {active.length === 0 && (
            <span className="font-label-xs text-label-xs text-outline">관심 분야를 고르면 추천이 더 정확해져요</span>
          )}
          {active.map((code) => (
            <span key={code} className="px-2.5 py-1 rounded-full bg-berry-tint text-primary font-label-xs text-label-xs font-semibold">
              {names.get(code)}
            </span>
          ))}
        </div>
        {!editing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="flex-shrink-0 flex items-center gap-1 px-3 h-8 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm active:scale-95 transition-all"
          >
            <MaterialIcon name="tune" className="text-[16px]" />
            분야 편집
          </button>
        )}
      </div>

      {editing && (
        <div className="rounded-2xl bg-surface-container-lowest p-3 shadow-card flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="관심 분야">
            {items.map((item) => {
              const selected = current.includes(item.interestCode)
              const full = !selected && current.length >= max
              return (
                <button
                  key={item.interestCode}
                  type="button"
                  aria-pressed={selected}
                  disabled={full || saving}
                  onClick={() => toggle(item.interestCode)}
                  className={`px-3.5 py-2 rounded-full font-label-sm text-label-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {item.name}
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-label-xs text-label-xs text-outline" aria-live="polite">{current.length}/{max}개 선택</span>
            <div className="flex gap-2">
              <button type="button" onClick={handleCancel} disabled={saving} className="px-4 h-9 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold disabled:opacity-50">
                취소
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="px-4 h-9 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm font-semibold disabled:opacity-50">
                {saving ? '저장하는 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
