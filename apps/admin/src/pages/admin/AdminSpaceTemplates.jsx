import { useEffect, useState } from 'react'
import ConfirmModal from '../../components/ConfirmModal.jsx'
import { AdminPageHeader } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/States.jsx'
import { useToast } from '../../context/useToast.js'
import { useAsync } from '../../hooks/useAsync.js'
import { activateSpaceTemplate, createSpaceTemplate, getAllSpaceTemplates, updateSpaceTemplate } from '../../api/admin.js'
import { ApiError, describeError } from '../../api/client.js'
import { formatDateTime } from '../../utils/format.js'
import {
  SLUG_RULE_HINT,
  TEMPLATE_FIELD_LABELS,
  TEMPLATE_LIMITS,
  previewSlug,
  templateFields,
  toTemplateRequest,
  validateTemplate,
} from '../../utils/spaceTemplate.js'

const ERROR_MESSAGES = {
  VALIDATION_FAILED: '입력한 내용을 확인해주세요. 네 항목 모두 필수이고, 주소 규칙은 형식을 지켜야 해요.',
  CONCURRENT_COMMAND: '다른 관리자가 같은 작업을 진행 중이에요. 잠시 뒤에 다시 시도해주세요.',
  RESOURCE_NOT_FOUND: '템플릿을 찾을 수 없어요. 목록을 새로고침해주세요.',
}

function describeTemplateError(error, fallback) {
  if (error instanceof ApiError && ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}

const inputClass =
  'mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 disabled:bg-slate-100'

/** Creator 신청을 승인할 때 복사해 스페이스를 만드는 기본 템플릿을 관리한다. 활성 템플릿은 항상 하나뿐이다. */
export default function AdminSpaceTemplates() {
  const showToast = useToast()
  // editor: null(닫힘) | { template: null }(추가) | { template }(수정)
  const [editor, setEditor] = useState(null)
  const [activating, setActivating] = useState(null)
  const [busy, setBusy] = useState(false)
  const { data, loading, error, reload } = useAsync(getAllSpaceTemplates, [], { fallbackMessage: '템플릿 목록을 불러오지 못했습니다.' })
  const templates = data ?? []
  const active = templates.find((template) => template.active)

  async function activate() {
    if (!activating) return
    setBusy(true)
    try {
      await activateSpaceTemplate(activating.templateId)
      showToast('템플릿을 활성화했습니다.')
      setActivating(null)
      await reload()
    } catch (err) {
      showToast(describeTemplateError(err, '활성화하지 못했습니다.'), { icon: 'error' })
      // 다른 관리자가 먼저 바꿨을 수 있어 목록을 다시 읽고 확인 창은 닫는다.
      if (err?.code === 'CONCURRENT_COMMAND' || err?.code === 'RESOURCE_NOT_FOUND') {
        setActivating(null)
        await reload()
      }
    } finally {
      setBusy(false)
    }
  }

  function handleSaved(message) {
    setEditor(null)
    showToast(message)
    void reload()
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader
        title="Creator Space 템플릿"
        description="Creator 신청을 승인하면 활성 템플릿을 복사해 스페이스를 만듭니다. 활성 템플릿이 없으면 승인할 수 없습니다."
      >
        <button
          type="button"
          onClick={() => setEditor({ template: null })}
          className="h-9 rounded-md bg-pink-700 px-4 text-sm font-semibold text-white hover:bg-pink-800"
        >
          템플릿 추가
        </button>
      </AdminPageHeader>

      {!loading && !error && !active && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          활성 템플릿이 없습니다. 템플릿을 만들고 활성화해야 Creator 신청을 승인할 수 있어요.
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        {loading && <LoadingBlock label="템플릿을 불러오는 중..." />}
        {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
        {!loading && !error && templates.length === 0 && (
          <EmptyBlock icon="space_dashboard" message="아직 템플릿이 없습니다. 첫 템플릿을 추가해주세요." />
        )}
        {!loading && !error && templates.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">소개 문구</th>
                  <th className="px-4 py-3">주소 규칙</th>
                  <th className="px-4 py-3">수정일</th>
                  <th className="px-5 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((template) => (
                  <tr key={template.templateId} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">#{template.templateId}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={template.active ? '활성' : '비활성'}
                        tone={template.active ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-high text-on-surface-variant'}
                        icon={template.active ? 'check_circle' : undefined}
                      />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700"><span className="line-clamp-2">{template.introText}</span></td>
                    <td className="px-4 py-3 text-slate-700">
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{template.slugRule}</code>
                      {previewSlug(template.slugRule) && <span className="ml-2 text-xs text-slate-500">예: {previewSlug(template.slugRule)}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(template.updatedAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" onClick={() => setEditor({ template })} className="font-medium text-pink-700 hover:text-pink-800">수정</button>
                      {!template.active && (
                        <button type="button" onClick={() => setActivating(template)} className="ml-4 font-medium text-pink-700 hover:text-pink-800">활성화</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor && <TemplateFormModal template={editor.template} onCancel={() => setEditor(null)} onSaved={handleSaved} />}
      {activating && (
        <ConfirmModal
          action="approve"
          title="템플릿 활성화"
          message={
            `#${activating.templateId} 템플릿을 활성화할까요?\n` +
            (active ? `현재 활성인 #${active.templateId} 템플릿은 비활성화돼요. ` : '') +
            '이미 만들어진 스페이스는 바뀌지 않고, 앞으로 승인되는 Creator부터 이 템플릿이 적용돼요.'
          }
          confirmLabel="활성화"
          busyLabel="활성화하는 중..."
          busy={busy}
          onCancel={() => setActivating(null)}
          onConfirm={() => void activate()}
        />
      )}
    </div>
  )
}

/** 템플릿을 추가하거나 수정하는 폼. 수정은 전체 필드를 교체하므로 네 항목을 모두 보낸다. */
function TemplateFormModal({ template, onCancel, onSaved }) {
  const editing = template !== null
  const [fields, setFields] = useState(() => templateFields(template))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Esc로 닫는다. 저장 중에는 닫지 않는다.
  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [saving, onCancel])

  function update(key, value) {
    setFields((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setFormError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const found = validateTemplate(fields)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    setFormError('')
    try {
      const body = toTemplateRequest(fields)
      if (editing) await updateSpaceTemplate(template.templateId, body)
      else await createSpaceTemplate(body)
      onSaved(editing ? '템플릿을 수정했습니다.' : '템플릿을 추가했습니다. 활성화하면 승인에 사용돼요.')
    } catch (err) {
      setFormError(describeTemplateError(err, '저장하지 못했습니다.'))
      setSaving(false)
    }
  }

  const slugExample = previewSlug(fields.slugRule)
  const fieldProps = (key) => ({
    id: `template-${key}`,
    value: fields[key],
    disabled: saving,
    'aria-invalid': Boolean(errors[key]),
    'aria-describedby': `template-${key}-note`,
    onChange: (event) => update(key, event.target.value),
    className: inputClass,
  })

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/35 p-4" role="presentation">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="template-form-title" className="w-full max-w-lg rounded-lg bg-white p-6 shadow-floating">
        <h2 id="template-form-title" className="text-lg font-semibold text-slate-950">{editing ? `템플릿 #${template.templateId} 수정` : '템플릿 추가'}</h2>
        {editing && template.active && (
          <p className="mt-2 text-sm text-slate-600">활성 템플릿을 수정해도 이미 만들어진 스페이스는 바뀌지 않아요.</p>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <div>
            <FieldLabel htmlFor="template-introText">{TEMPLATE_FIELD_LABELS.introText}</FieldLabel>
            <textarea {...fieldProps('introText')} rows="3" className={`${inputClass} resize-y`} />
            <FieldNote id="template-introText-note" error={errors.introText} note={`${fields.introText.trim().length}/${TEMPLATE_LIMITS.introText}`} />
          </div>
          <div>
            <FieldLabel htmlFor="template-profileImageUrl">{TEMPLATE_FIELD_LABELS.profileImageUrl}</FieldLabel>
            <input {...fieldProps('profileImageUrl')} placeholder="https://" />
            <FieldNote id="template-profileImageUrl-note" error={errors.profileImageUrl} />
          </div>
          <div>
            <FieldLabel htmlFor="template-bannerImageUrl">{TEMPLATE_FIELD_LABELS.bannerImageUrl}</FieldLabel>
            <input {...fieldProps('bannerImageUrl')} placeholder="https://" />
            <FieldNote id="template-bannerImageUrl-note" error={errors.bannerImageUrl} />
          </div>
          <div>
            <FieldLabel htmlFor="template-slugRule">{TEMPLATE_FIELD_LABELS.slugRule}</FieldLabel>
            <input {...fieldProps('slugRule')} placeholder="creator-{creatorId}" autoComplete="off" spellCheck={false} />
            <FieldNote id="template-slugRule-note" error={errors.slugRule} note={slugExample ? `만들어질 주소 예: /${slugExample}` : SLUG_RULE_HINT} />
          </div>
        </div>

        {formError && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">취소</button>
          <button type="submit" disabled={saving} className="h-9 rounded-md bg-pink-700 px-3 text-sm font-semibold text-white hover:bg-pink-800 disabled:opacity-50">{saving ? '저장하는 중...' : '저장'}</button>
        </div>
      </form>
    </div>
  )
}

function FieldLabel({ htmlFor, children }) {
  return <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">{children} <span className="text-error" aria-hidden="true">*</span></label>
}

/** 입력칸 아래의 오류·안내 문구. 입력칸의 aria-describedby로 연결돼 라벨의 접근성 이름에는 섞이지 않는다. */
function FieldNote({ id, error, note }) {
  if (error) return <span id={id} className="mt-1 block text-xs font-normal text-red-700" role="alert">{error}</span>
  return <span id={id} className="mt-1 block text-xs font-normal text-slate-500">{note}</span>
}
