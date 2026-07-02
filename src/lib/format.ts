/**
 * 通用格式化工具函数。
 *
 * 集中处理时间、频率、增益等音频相关数值的展示格式，
 * 避免多个组件重复实现相近逻辑。
 */

/** 将秒数格式化为 mm:ss。 */
export function formatSeconds(seconds: number): string {
  let s = seconds
  if (!Number.isFinite(s) || s < 0) s = 0
  const total = Math.round(s)
  const m = Math.floor(total / 60)
  const sec = total % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/** 声道数转中文描述。 */
export function formatChannels(n: number): string {
  if (n === 1) return '单声道'
  if (n === 2) return '立体声'
  return `${n} 声道`
}

/** 将频率（Hz）格式化为人类可读文本：≥1000 显示 kHz。 */
export function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    const khz = hz / 1000
    return `${Number.isInteger(khz) ? khz.toString() : khz.toFixed(1)} kHz`
  }
  return `${hz} Hz`
}

/** 将增益（dB）格式化，正增益带 + 号，统一一位小数。 */
export function formatGain(db: number): string {
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}

/** 格式化 Q 值，统一一位小数。 */
export function formatQ(q: number): string {
  return q.toFixed(1)
}
