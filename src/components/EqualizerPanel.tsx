import { RotateCcw, SlidersHorizontal } from 'lucide-react'

import { Panel } from '@/components/ui/Panel'
import { Slider } from '@/components/ui/Slider'
import { DEFAULT_EQUALIZER_BANDS } from '@/lib/types'
import { useAudioStore } from '@/store/useAudioStore'

/** 将频率（Hz）格式化为人类可读文本：≥1000 显示 kHz。 */
function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    const khz = hz / 1000
    return `${Number.isInteger(khz) ? khz.toString() : khz.toFixed(1)} kHz`
  }
  return `${hz} Hz`
}

/** 将增益（dB）格式化，正增益带 + 号，统一一位小数。 */
function formatGain(db: number): string {
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`
}

/** 格式化 Q 值，统一一位小数。 */
function formatQ(q: number): string {
  return q.toFixed(1)
}

/** 均衡器柱状图尺寸常量。 */
const CHART_W = 300
const CHART_H = 150
const MID_Y = 56
const MAX_BAR_H = 48
const MAX_GAIN = 12

/**
 * 多频段均衡器面板。
 *
 * 渲染 5 段 Peaking 均衡器（频率 / 增益 / Q），顶部以 SVG 柱状图
 * 直观展示各频段增益方向与幅度；支持一键重置为默认频段。
 */
export default function EqualizerPanel() {
  const equalizer = useAudioStore((s) => s.params.equalizer)
  const updateEqualizerBand = useAudioStore((s) => s.updateEqualizerBand)
  const updateEqualizerBands = useAudioStore((s) => s.updateEqualizerBands)

  const handleReset = () => {
    updateEqualizerBands(DEFAULT_EQUALIZER_BANDS.map((b) => ({ ...b })))
  }

  const slot = equalizer.length > 0 ? CHART_W / equalizer.length : CHART_W

  return (
    <Panel
      title="多频段均衡器"
      icon={<SlidersHorizontal className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={handleReset}
          aria-label="重置均衡器"
          className="inline-flex items-center gap-1 rounded-md border border-bass-border px-2 py-1 text-xs text-bass-muted transition-colors hover:border-bass-muted hover:text-bass-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置
        </button>
      }
    >
      <div className="space-y-4">
        {/* 频段增益可视化柱状图 */}
        <div className="rounded-md bg-bass-bg/40 p-2">
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            className="h-32 w-full"
            role="img"
            aria-label="均衡器频段增益可视化"
          >
            {/* 中心 0 dB 基线 */}
            <line
              x1={8}
              y1={MID_Y}
              x2={CHART_W - 8}
              y2={MID_Y}
              stroke="#243049"
              strokeWidth={1}
            />
            {equalizer.map((band, i) => {
              const cx = slot * i + slot / 2
              const h = (Math.abs(band.gain) / MAX_GAIN) * MAX_BAR_H
              const positive = band.gain >= 0
              const y = positive ? MID_Y - h : MID_Y
              const color = positive ? '#facc15' : '#3b82f6'
              return (
                <g key={band.id}>
                  <rect
                    x={cx - 14}
                    y={y}
                    width={28}
                    height={Math.max(h, 2)}
                    rx={3}
                    fill={color}
                  />
                  <text
                    x={cx}
                    y={CHART_H - 8}
                    textAnchor="middle"
                    className="fill-bass-muted"
                    fontSize="10"
                  >
                    {formatFrequency(band.frequency)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 5 段控件 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equalizer.map((band, i) => (
            <div
              key={band.id}
              className="space-y-3 rounded-md border border-bass-border p-3"
            >
              <div className="text-xs font-medium text-bass-text">
                频段 {i + 1}
              </div>
              <Slider
                label="频率"
                ariaLabel={`频段 ${i + 1} 频率`}
                value={band.frequency}
                min={60}
                max={16000}
                step={10}
                formatValue={formatFrequency}
                onChange={(v) => updateEqualizerBand(i, { frequency: v })}
              />
              <Slider
                label="增益"
                ariaLabel={`频段 ${i + 1} 增益`}
                value={band.gain}
                min={-12}
                max={12}
                step={0.5}
                formatValue={formatGain}
                onChange={(v) => updateEqualizerBand(i, { gain: v })}
              />
              <Slider
                label="Q 值"
                ariaLabel={`频段 ${i + 1} Q 值`}
                value={band.q}
                min={0.5}
                max={6}
                step={0.1}
                formatValue={formatQ}
                onChange={(v) => updateEqualizerBand(i, { q: v })}
              />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}
