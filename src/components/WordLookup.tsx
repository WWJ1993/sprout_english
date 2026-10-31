// ============================================================
// WordLookup —— 报告区「划词查词」浮窗（百度翻译风格）
// 选中任意单词/句子 → 弹出音标 + 中文意思 + 🔊 发音按钮。
// 发音用浏览器原生 speechSynthesis（离线、免费、无需 API key）。
// 意思/音标来自本地离线词典（src/lib/dictionary.ts）。
// 同时支持报告内任意 [data-speak] 元素的点击发音（如词汇卡 🔊）。
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { lookup, type LookupResult } from '../lib/dictionary'

interface PopupState {
  text: string
  rect: DOMRect
  result: LookupResult
}

/** 在可用嗓音里挑选一个自然、高质量的英文嗓音（避免落到机器人/中文嗓音）。 */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const named = [
    'Google US English', // Chrome 最自然
    'Samantha',          // macOS 自带自然女声
    'Microsoft Aria',    // Edge/Win 自然嗓音
    'Microsoft Zira',
    'Daniel',            // macOS 英式
    'Karen',             // macOS 澳式
    'Victoria',
    'Alex',
    'Google UK English Female',
  ]
  for (const n of named) {
    const v = voices.find((x) => x.name.includes(n))
    if (v) return v
  }
  // 退而求其次：en-US → 任意英文 → 第一个
  return (
    voices.find((v) => /^en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0] ||
    null
  )
}

/** 朗读文本（英文，优先自然嗓音）。 */
export function useSpeak() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const load = () => {
      voiceRef.current = pickBestVoice(window.speechSynthesis.getVoices())
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  return useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.9
    u.pitch = 1.0
    const v = pickBestVoice(window.speechSynthesis.getVoices()) || voiceRef.current
    if (v) u.voice = v
    window.speechSynthesis.speak(u)
  }, [])
}

/**
 * 监听 containerRef 内的文本选中，返回需渲染的浮窗（已 portal 到 body）。
 * 用法：const { popup } = useWordLookup(ref); 把 popup 渲染在组件任意位置。
 */
export function useWordLookup(containerRef: RefObject<HTMLElement | null>) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const speak = useSpeak()

  // 选中文本 → 弹窗
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onMouseUp = () => {
      // 延迟到 selection 稳定后再读取
      window.setTimeout(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setPopup(null)
          return
        }
        const text = sel.toString().trim()
        if (!text) {
          setPopup(null)
          return
        }
        const range = sel.getRangeAt(0)
        // 选中内容必须落在报告容器内
        if (!el.contains(range.commonAncestorContainer)) {
          setPopup(null)
          return
        }
        const rect = range.getBoundingClientRect()
        setPopup({ text, rect, result: lookup(text) })
      }, 0)
    }

    const onScroll = () => setPopup(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopup(null)
    }
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('.wl-popup')) return
      setPopup(null)
    }

    el.addEventListener('mouseup', onMouseUp)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDocMouseDown)
    return () => {
      el.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [containerRef])

  // 容器内的 [data-speak] 元素点击发音（如词汇卡 🔊）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest('[data-speak]') as HTMLElement | null
      if (t) {
        e.preventDefault()
        const txt = t.getAttribute('data-speak') || ''
        setSpeaking(true)
        const done = () => setSpeaking(false)
        speak(txt)
        // speechSynthesis 不一定回调 onend（部分浏览器），兜底复位
        window.setTimeout(done, 2500)
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [containerRef, speak])

  const popupEl = popup
    ? createPortal(
        <WordLookupPopup
          state={popup}
          speaking={speaking}
          onSpeak={(t) => {
            setSpeaking(true)
            speak(t)
            window.setTimeout(() => setSpeaking(false), 2500)
          }}
          onClose={() => setPopup(null)}
        />,
        document.body
      )
    : null

  return { popup: popupEl, speak }
}

function WordLookupPopup({
  state,
  speaking,
  onSpeak,
  onClose,
}: {
  state: PopupState
  speaking: boolean
  onSpeak: (text: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })
  const { rect, result, text } = state

  useLayoutEffect(() => {
    const card = ref.current
    if (!card) return
    const h = card.offsetHeight
    const w = card.offsetWidth
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = rect.top - h - 10
    if (top < 8) top = rect.bottom + 10
    if (top + h > vh - 8) top = Math.max(8, vh - h - 8)
    let left = rect.left + rect.width / 2 - w / 2
    left = Math.max(8, Math.min(left, vw - w - 8))
    setPos({ top, left })
  }, [rect])

  const showEntry = !result.isPhrase && result.entry

  return (
    <div ref={ref} className="wl-popup" style={{ top: pos.top, left: pos.left }} role="dialog">
      <button className="wl-close" onClick={onClose} aria-label="关闭">
        ×
      </button>
      <div className="wl-word">{text}</div>
      {showEntry ? (
        <>
          <div className="wl-ph">/{result.entry!.ph}/</div>
          <div className="wl-cn">{result.entry!.cn}</div>
        </>
      ) : result.isPhrase ? (
        <div className="wl-hint">整句跟读 · 点 🔊 听发音</div>
      ) : (
        <div className="wl-hint">本地词典未收录该词，可点 🔊 听发音</div>
      )}
      <button
        className="wl-speak"
        onClick={() => onSpeak(text)}
        disabled={speaking}
      >
        {speaking ? '🔊 播放中…' : '🔊 发音'}
      </button>
    </div>
  )
}
