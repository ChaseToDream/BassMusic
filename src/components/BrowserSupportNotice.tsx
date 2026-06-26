/**
 * BrowserSupportNotice 浏览器兼容性提示。
 *
 * 检测当前环境是否支持实时（AudioContext）与离线（OfflineAudioContext）
 * Web Audio API。若任一缺失，在页面顶部渲染警告条，提示用户更换浏览器。
 * 支持时返回 null，不渲染任何内容。
 */
import { AlertTriangle } from 'lucide-react'

/** 兼容旧版 Safari 的前缀类型。 */
type PrefixedWindow = {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
  OfflineAudioContext?: typeof OfflineAudioContext
  webkitOfflineAudioContext?: typeof OfflineAudioContext
}

/**
 * 检测是否支持实时音频上下文（含 webkit 前缀回退）。
 */
function hasRealtimeAudioSupport(w: PrefixedWindow): boolean {
  return typeof w.AudioContext !== 'undefined' || typeof w.webkitAudioContext !== 'undefined'
}

/**
 * 检测是否支持离线音频上下文（导出渲染所需，含 webkit 前缀回退）。
 */
function hasOfflineAudioSupport(w: PrefixedWindow): boolean {
  return (
    typeof w.OfflineAudioContext !== 'undefined' ||
    typeof w.webkitOfflineAudioContext !== 'undefined'
  )
}

/**
 * 浏览器兼容性提示条。
 * SSR/非浏览器环境下默认视为不支持，但本应用为纯客户端 SPA，无需特殊处理。
 */
export default function BrowserSupportNotice() {
  const w = window as unknown as PrefixedWindow
  const supported = hasRealtimeAudioSupport(w) && hasOfflineAudioSupport(w)

  if (supported) return null

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-2 border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-center text-sm text-red-200"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>您的浏览器不支持 Web Audio API，请使用 Chrome / Edge / Firefox 最新版</span>
    </div>
  )
}
