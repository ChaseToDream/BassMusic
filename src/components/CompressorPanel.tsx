/**
 * CompressorPanel 动态范围压缩面板。
 *
 * 调节 CompressorParams 五个参数（阈值/压缩比/Attack/Release/输出增益），
 * 并在面板顶部用 SVG 实时绘制输入-输出压缩曲线。
 *
 * 曲线模型：
 *   输入 ≤ threshold：输出 = 输入
 *   输入 > threshold：输出 = threshold + (输入 - threshold) / ratio
 *   最终输出叠加 makeupGain 偏移。
 */
import { Gauge, RotateCcw } from 'lucide-react'
import { DEFAULT_COMPRESSOR_PARAMS } from '@/lib/types'
import { useAudioStore } from '@/store/useAudioStore'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/Panel'
import { Slider } from '@/components/ui/Slider'
import { Switch } from '@/components/ui/Switch'

/** 统一焦点样式。 */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg'

/* ===== SVG 压缩曲线常量 ===== */
/** 画布宽度。 */
const W = 280
/** 画布高度。 */
const H = 180
/** 左边距（y 轴标签）。 */
const LX = 32
/** 右边距。 */
const RX = 10
/** 顶边距。 */
const TY = 10
/** 底边距（x 轴标签）。 */
const BY = 26
/** 绘图区宽度。 */
const PLOT_W = W - LX - RX
/** 绘图区高度。 */
const PLOT_H = H - TY - BY
/** dB 范围下限。 */
const DB_MIN = -60
/** dB 范围上限。 */
const DB_MAX = 0
/** dB 范围跨度。 */
const DB_RANGE = DB_MAX - DB_MIN

/* 主题色（与 tailwind.config 保持一致，用于 SVG 描边） */
const COLOR_BORDER = '#243049'
const COLOR_MUTED = '#8a94a8'
const COLOR_GRID = '#3a4760'
const COLOR_ACCENT = '#facc15'

/** 输入 dB → 画布 x 坐标。 */
function mapX(db: number): number {
  return LX + ((db - DB_MIN) / DB_RANGE) * PLOT_W
}

/** 输出 dB → 画布 y 坐标（0 dB 在顶部）。 */
function mapY(db: number): number {
  return TY + PLOT_H - ((db - DB_MIN) / DB_RANGE) * PLOT_H
}

/** 计算压缩器输入对应的输出 dB（含 makeupGain 偏移）。 */
function computeOutput(
  inputDb: number,
  threshold: number,
  ratio: number,
  makeupGain: number,
): number {
  const above = inputDb <= threshold ? inputDb : threshold + (inputDb - threshold) / ratio
  return above + makeupGain
}

/** 生成压缩曲线 path 字符串。 */
function buildCurvePath(threshold: number, ratio: number, makeupGain: number): string {
  const pts: string[] = []
  for (let input = DB_MIN; input <= DB_MAX; input += 1) {
    const output = computeOutput(input, threshold, ratio, makeupGain)
    pts.push(`${mapX(input).toFixed(2)},${mapY(output).toFixed(2)}`)
  }
  return `M ${pts.join(' L ')}`
}

export default function CompressorPanel() {
  const compressor = useAudioStore((s) => s.params.compressor)
  const updateCompressor = useAudioStore((s) => s.updateCompressor)
  const { enabled, threshold, ratio, attack, release, makeupGain } = compressor

  const curveD = buildCurvePath(threshold, ratio, makeupGain)
  // 1:1 参考线（无压缩无增益）
  const refD = `M ${mapX(DB_MIN)},${mapY(DB_MIN)} L ${mapX(DB_MAX)},${mapY(DB_MAX)}`

  return (
    <Panel
      title="动态范围压缩"
      icon={<Gauge className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={() => updateCompressor({ ...DEFAULT_COMPRESSOR_PARAMS })}
          aria-label="重置压缩器参数"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border border-bass-border px-2 py-1 text-xs text-bass-muted hover:text-bass-text',
            FOCUS_RING,
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          重置
        </button>
      }
    >
      {/* 压缩曲线可视化 */}
      <div className={cn('mb-4', !enabled && 'opacity-50')}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`压缩曲线：阈值 ${threshold} dB，压缩比 ${ratio}:1，输出增益 ${makeupGain} dB`}
        >
          {/* 网格线（-30 dB 横竖辅助线） */}
          <line
            x1={mapX(DB_MIN)}
            y1={mapY(-30)}
            x2={mapX(DB_MAX)}
            y2={mapY(-30)}
            stroke={COLOR_BORDER}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <line
            x1={mapX(-30)}
            y1={mapY(DB_MIN)}
            x2={mapX(-30)}
            y2={mapY(DB_MAX)}
            stroke={COLOR_BORDER}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          {/* 1:1 参考线 */}
          <path d={refD} fill="none" stroke={COLOR_GRID} strokeWidth={1} strokeDasharray="3 3" />
          {/* 阈值竖线 */}
          <line
            x1={mapX(threshold)}
            y1={mapY(DB_MIN)}
            x2={mapX(threshold)}
            y2={mapY(DB_MAX)}
            stroke={COLOR_ACCENT}
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={0.5}
          />
          {/* 实际压缩曲线 */}
          <path
            d={curveD}
            fill="none"
            stroke={COLOR_ACCENT}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* 坐标轴 */}
          <line
            x1={mapX(DB_MIN)}
            y1={mapY(DB_MIN)}
            x2={mapX(DB_MAX)}
            y2={mapY(DB_MIN)}
            stroke={COLOR_MUTED}
            strokeWidth={1}
          />
          <line
            x1={mapX(DB_MIN)}
            y1={mapY(DB_MIN)}
            x2={mapX(DB_MIN)}
            y2={mapY(DB_MAX)}
            stroke={COLOR_MUTED}
            strokeWidth={1}
          />
          {/* 轴标签 */}
          <text x={mapX(DB_MAX)} y={mapY(DB_MIN) + 16} textAnchor="middle" fill={COLOR_MUTED} fontSize={10}>
            输入 dB
          </text>
          <text
            x={10}
            y={mapY(DB_MAX) + 4}
            textAnchor="middle"
            fill={COLOR_MUTED}
            fontSize={10}
            transform={`rotate(-90 10 ${mapY(DB_MAX)})`}
          >
            输出 dB
          </text>
          <text x={mapX(DB_MIN)} y={H - 8} textAnchor="middle" fill={COLOR_MUTED} fontSize={9}>
            {DB_MIN}
          </text>
          <text x={mapX(DB_MAX)} y={H - 8} textAnchor="middle" fill={COLOR_MUTED} fontSize={9}>
            {DB_MAX}
          </text>
        </svg>
      </div>

      <Switch
        label="启用"
        checked={enabled}
        onChange={(checked) => updateCompressor({ enabled: checked })}
      />

      <div className="mt-4 space-y-4">
        <Slider
          label="阈值"
          value={threshold}
          min={-60}
          max={0}
          step={1}
          unit="dB"
          onChange={(v) => updateCompressor({ threshold: v })}
          disabled={!enabled}
        />
        <Slider
          label="压缩比"
          value={ratio}
          min={1}
          max={20}
          step={0.5}
          unit=":1"
          onChange={(v) => updateCompressor({ ratio: v })}
          disabled={!enabled}
        />
        <Slider
          label="Attack"
          value={attack}
          min={0}
          max={1}
          step={0.001}
          unit="s"
          onChange={(v) => updateCompressor({ attack: v })}
          disabled={!enabled}
        />
        <Slider
          label="Release"
          value={release}
          min={0}
          max={1}
          step={0.01}
          unit="s"
          onChange={(v) => updateCompressor({ release: v })}
          disabled={!enabled}
        />
        <Slider
          label="输出增益"
          value={makeupGain}
          min={0}
          max={12}
          step={0.5}
          unit="dB"
          onChange={(v) => updateCompressor({ makeupGain: v })}
          disabled={!enabled}
        />
      </div>
    </Panel>
  )
}
