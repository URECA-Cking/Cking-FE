import { useEffect, useRef, useState } from 'react'

/**
 * 이미지 한 장의 선택·업로드 상태(스페이스 프로필 사진·배너, 이벤트 배너).
 * pendingKey — undefined: 바꾸지 않음 / null: 지우기(기본 이미지로) / string: 새로 올린 이미지의 key.
 * busy는 파일을 고른 순간부터(검증·업로드 중) 켜진다. 이 동안은 저장·변경을 막아 이전 선택의 결과가 나중 선택을 덮지 못하게 한다.
 * describeError는 업로드 오류를 화면 문구로 바꾼다(도메인마다 오류 코드가 다르다).
 */
export function useImageUploadPick({ validate, upload, failMessage, describeError }) {
  const [pendingKey, setPendingKey] = useState(undefined)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const seq = useRef(0)
  const alive = useRef(true)
  const fileInput = useRef(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // 방금 올린 이미지의 미리보기 주소(blob:). 바뀌거나 화면을 떠나면 해제한다.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy) return
    const current = ++seq.current
    const isLatest = () => alive.current && current === seq.current
    setError('')
    setBusy(true)
    try {
      const reason = await validate(file)
      if (!isLatest()) return
      if (reason) {
        setError(reason)
        return
      }
      const { imageKey } = await upload(file)
      if (!isLatest()) return
      setPendingKey(imageKey)
      setPreviewUrl(URL.createObjectURL(file))
    } catch (uploadError) {
      if (isLatest()) setError(describeError(uploadError, failMessage))
    } finally {
      if (isLatest()) setBusy(false)
    }
  }

  return {
    pendingKey,
    previewUrl,
    busy,
    error,
    fileInput,
    handleFile,
    openPicker: () => fileInput.current?.click(),
    /** 이미지를 지우려는(기본 이미지로 돌아가려는) 선택. */
    remove() {
      setError('')
      setPreviewUrl(null)
      setPendingKey(null)
    },
    /** 지우려던 선택을 취소해 현재 이미지를 그대로 둔다. */
    cancelRemove() {
      setError('')
      setPendingKey(undefined)
    },
    /** 저장된 이미지가 현재 이미지가 된다. 이후에는 바꾸지 않은 상태로 둔다. */
    reset() {
      setPendingKey(undefined)
      setPreviewUrl(null)
    },
  }
}
