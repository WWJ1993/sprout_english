// ============================================================
// WordLookup —— 报告区「划词查词」浮窗（百度翻译风格）
// 选中任意单词/句子 → 弹出音标 + 中文意思 + 🔊 发音按钮。
// 同时支持报告内任意 [data-speak] 元素的点击发音（如词汇卡 🔊）。
//
// 发音策略（两层，优先保证「一定出声」）：
//  1) 主通道：有道词典公开 mp3（真人发音，国内可达，无需 key）。
//     <audio>.play() 在点击的同步调用栈里触发，不受 autoplay 拦截，
//     也完全绕开浏览器本地嗓音包未下载 / 远程网络嗓音静音的问题。
//  2) 兜底：浏览器 speechSynthesis，只选 localService 本地英文嗓音，
//     绝不用 Google/Microsoft Online 等远程网络嗓音（国内常静音），
//     并规避 cancel() 后立刻 speak() 的经典吞音竞态。
//  3) 1.8s 内既没播放成功也没 onstart → 判定失败，给出可见提示。
// ============================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { lookup, type LookupResult } from '../lib/dictionary'

interface PopupState {
  text: string
  rect: DOMRect
  result: LookupResult
}

export type SpeakOutcome = 'ok' | 'failed'

// 有道词典发音（公开 mp3 接口）。type=2 美音 / type=1 英音。
const DICTVOICE_BASE = 'https://dict.youdao.com/dictvoice?type=2&audio='

/**
 * 在线音频适用范围：纯可打印 ASCII、不含中文、≤2 个词。
 * 实测有道 dictvoice 对单个词 100% 返回 mp3（词汇卡 26 个词全部验证通过），
 * 但对多词句子会返回 500「returned null audio」。所以单词/双词走在线，
 * 更长文本直接走本地 TTS（读句子也更自然），避免无谓等待。
 */
function canUseOnlineAudio(text: string): boolean {
  if (!text || text.length > 60) return false
  if (/[\u3400-\u9fff]/.test(text)) return false
  if (!/^[\x20-\x7e]+$/.test(text)) return false
  return text.trim().split(/\s+/).length <= 2
}

/**
 * 只挑本地英文嗓音。远程网络嗓音（Google US English / Microsoft Online 等，
 * localService=false）在国内网络下经常静默失败，必须排除；
 * 若完全没有本地嗓音则返回 null —— 不指定 voice，让浏览器用默认嗓音，比乱指定更可靠。
 */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null
  const local = voices.filter((v) => v.localService)
  if (!local.length) return null
  const en = local.filter((v) => /^en/i.test(v.lang))
  const pool = en.length ? en : local
  const named = ['Samantha', 'Alex', 'Daniel', 'Karen', 'Victoria', 'Ava', 'Allison', 'Susan', 'Tom', 'Fred']
  for (const n of named) {
    const v = pool.find((x) => x.name.includes(n))
    if (v) return v
  }
  return pool.find((v) => /^en[-_]US/i.test(v.lang)) || pool[0] || null
}

/** 主通道：播放在线 mp3。onplaying 视为成功；play() 被拒 / 出错 / 3.5s 超时则降级。 */
function playOnlineAudio(
  text: string,
  audioRef: { current: HTMLAudioElement | null }
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // 连点不同单词时先停掉上一段，避免叠音
      audioRef.current?.pause()
      const audio = new Audio()
      audioRef.current = audio
      let settled = false
      let timer = 0
      const finish = (ok: boolean) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        if (!ok) {
          try {
            audio.pause()
            audio.removeAttribute('src')
          } catch {
            /* ignore */
          }
          if (audioRef.current === audio) audioRef.current = null
        }
        resolve(ok)
      }
      audio.preload = 'auto'
      audio.onplaying = () => finish(true)
      audio.onerror = () => finish(false)
      audio.src = DICTVOICE_BASE + encodeURIComponent(text)
      // HTTP 500（null audio）时 audio.onerror 会立即触发；这里只是网络无响应时的兜底
      timer = window.setTimeout(() => finish(false), 2200)
      const p = audio.play()
      if (p && typeof p.catch === 'function') p.catch(() => finish(false))
    } catch {
      resolve(false)
    }
  })
}

/** 兜底：浏览器本地 TTS。首次点击同步 speak() 保住用户手势，连点才延迟让出一帧。 */
function speakNative(
  text: string,
  voiceRef: { current: SpeechSynthesisVoice | null }
): Promise<SpeakOutcome> {
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve('failed')
  try {
    if (synth.paused) synth.resume()
    const busy = synth.speaking || synth.pending
    if (busy) synth.cancel()

    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.9
    u.pitch = 1.0
    const v = pickBestVoice(synth.getVoices()) || voiceRef.current
    if (v) u.voice = v

    return new Promise<SpeakOutcome>((resolve) => {
      let done = false
      let timer = 0
      const finish = (r: SpeakOutcome) => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        resolve(r)
      }
      u.onstart = () => finish('ok')
      u.onerror = (e) => {
        console.warn('[speak] speechSynthesis error:', e.error)
        finish('failed')
      }
      // 部分浏览器 speak() 静默失败且既不 onstart 也不 onerror，靠超时兜底
      timer = window.setTimeout(() => {
        if (!done) {
          try {
            synth.cancel()
          } catch {
            /* ignore */
          }
          finish('failed')
        }
      }, 1800)
      const fire = () => {
        try {
          synth.speak(u)
        } catch {
          finish('failed')
        }
      }
      // cancel() 与 speak() 同一 tick 会被部分浏览器吞掉，连点时错开一帧
      if (busy) window.setTimeout(fire, 60)
      else fire()
    })
  } catch (e) {
    console.warn('[speak] speak failed:', e)
    return Promise.resolve('failed')
  }
}

/** 朗读文本。返回是否成功出声（供 UI 显示失败提示）。 */
export function useSpeak() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    // cleanup 里通过 effect 内的局部引用访问 ref，避免读到已变更的 .current
    const audioBox = audioRef
    const load = () => {
      // 主动触发一次 getVoices()，让浏览器开始加载语音列表
      voiceRef.current = pickBestVoice(window.speechSynthesis.getVoices())
    }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null
      audioBox.current?.pause()
    }
  }, [])

  return useCallback(
    (text: string): Promise<SpeakOutcome> => {
      const t = (text ?? '').trim()
      if (!t || typeof window === 'undefined') return Promise.resolve('failed')
      if (canUseOnlineAudio(t)) {
        return playOnlineAudio(t, audioRef).then((ok) =>
          ok ? 'ok' : speakNative(t, voiceRef)
        )
      }
      return speakNative(t, voiceRef)
    },
    []
  )
}

/**
 * 监听 containerRef 内的文本选中，返回需渲染的浮窗（已 portal 到 body）。
 * 用法：const { popup } = useWordLookup(ref); 把 popup 渲染在组件任意位置。
 */
export function useWordLookup(containerRef: RefObject<HTMLElement | null>) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [speakFailed, setSpeakFailed] = useState(false)
  const speak = useSpeak()
  const failTimer = useRef(0)

  const runSpeak = useCallback(
    (text: string) => {
      setSpeaking(true)
      setSpeakFailed(false)
      window.clearTimeout(failTimer.current)
      speak(text).then((r) => {
        setSpeaking(false)
        if (r === 'failed') {
          setSpeakFailed(true)
          failTimer.current = window.setTimeout(() => setSpeakFailed(false), 3200)
        }
      })
    },
    [speak]
  )

  useEffect(() => () => window.clearTimeout(failTimer.current), [])

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
        if (txt) runSpeak(txt)
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [containerRef, runSpeak])

  const popupEl = popup
    ? createPortal(
        <WordLookupPopup
          state={popup}
          speaking={speaking}
          onSpeak={runSpeak}
          onClose={() => setPopup(null)}
        />,
        document.body
      )
    : null

  const hintEl = speakFailed
    ? createPortal(
        <div className="wl-toast" role="status">
          ⚠️ 发音未能播放，请检查网络或浏览器音频权限后重试
        </div>,
        document.body
      )
    : null

  return { popup: <>{popupEl}{hintEl}</>, speak: runSpeak }
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
