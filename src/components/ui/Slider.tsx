/**
 * Slider 受控滑块组件。
 *
 * 封装原生 range input 与数字输入框，二者双向联动；支持键盘
 * PageUp/PageDown 按 10 倍步长快速调节，失焦时自动钳制到有效区间。
 */
import { useEffect, useId, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { FOCUS_RING } from '@/lib/styles'
import { cn } from '@/lib/utils'

export interface SliderProps {
  /** 标签文字（可选，未提供时仅依赖 ariaLabel 作为无障碍标签） */
  label?: string
  /** 当前值 */
  value: number
  /** 最小值 */
  min: number
  /** 最大值 */
  max: number
  /** 步长，默认 1 */
  step?: number
  /** 单位（Hz / dB / s 等） */
  unit?: string
  /** 值变化回调 */
  onChange: (value: number) => void
  /** 是否禁用 */
  disabled?: boolean
  /** 关联描述元素 id（无障碍） */
  describedById?: string
  /** 自定义无障碍标签，未提供时使用 label */
  ariaLabel?: string
  /** 自定义数值格式化函数 */
  formatValue?: (value: number) => string
}

/** 计算步长对应的小数位数，用于数值格式化。 */
function getDecimals(step: number): number {
  if (step >= 1) return 0
  const str = step.toPrecision(12)
  const dot = str.indexOf('.')
  if (dot === -1) return 0
  let end = str.length
  while (end > dot + 1 && str[end - 1] === '0') end--
  return end - dot - 1
}

/** 将数值按步长精度格式化为字符串（内部默认实现）。 */
function formatByStep(value: number, step?: number): string {
  if (step === undefined) return String(value)
  return value.toFixed(getDecimals(step))
}

/** 将数值钳制到 [min, max]。 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled = false,
  describedById,
  ariaLabel,
  formatValue,
}: SliderProps) {
  const numberId = useId()
  // 优先使用外部传入的 formatValue，否则按步长精度格式化
  const fmt = (v: number) => (formatValue ? formatValue(v) : formatByStep(v, step))
  const [text, setText] = useState(() => fmt(value))

  // 外部 value 变化（如拖动滑块、应用预设）时同步本地文本
  useEffect(() => {
    setText(fmt(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, step, formatValue])

  const handleRangeChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value))
  }

  // 数字输入框：输入过程仅更新本地文本，避免中间态触发回调
  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value)
  }

  // 提交：解析 → 钳制 → 回调 → 同步文本
  const commit = () => {
    const parsed = parseFloat(text)
    if (Number.isNaN(parsed)) {
      setText(fmt(value))
      return
    }
    const clamped = clamp(parsed, min, max)
    if (clamped !== value) onChange(clamped)
    setText(fmt(clamped))
  }

  const handleNumberBlur = () => commit()

  const handleNumberKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
  }

  // PageUp/PageDown 按 10 倍步长调节（原生 range 行为不一致，手动处理）
  const handleRangeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      const pageStep = step * 10
      const delta = e.key === 'PageUp' ? pageStep : -pageStep
      const next = clamp(value + delta, min, max)
      if (next !== value) onChange(next)
    }
  }

  const accessibleLabel = ariaLabel ?? label
  const valueText = `${fmt(value)}${unit ? ' ' + unit : ''}`

  return (
    <div className={cn(disabled && 'opacity-50')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        {label ? (
          <label htmlFor={numberId} className="text-sm font-medium text-bass-text">
            {label}
          </label>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <input
            id={numberId}
            type="number"
            value={text}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={handleNumberChange}
            onBlur={handleNumberBlur}
            onKeyDown={handleNumberKeyDown}
            aria-label={accessibleLabel}
            aria-describedby={describedById}
            className={cn(
              'w-20 rounded-md border border-bass-border bg-bass-bg px-2 py-1 text-right text-sm text-bass-text',
              FOCUS_RING,
              'disabled:cursor-not-allowed',
            )}
          />
          {unit && <span className="text-xs text-bass-muted">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={handleRangeChange}
        onKeyDown={handleRangeKeyDown}
        aria-label={accessibleLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        aria-describedby={describedById}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-bass-border accent-accent',
          FOCUS_RING,
          'disabled:cursor-not-allowed',
        )}
      />
    </div>
  )
}
