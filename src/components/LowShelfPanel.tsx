/**
 * LowShelfPanel 低频增强面板。
 *
 * 调节 LowShelfParams：启用开关、中心频率（20-250 Hz）、增益（0-15 dB）。
 * 关闭开关时滑块禁用并变灰。
 */
import { RotateCcw, Volume2 } from 'lucide-react'
import { DEFAULT_LOW_SHELF_PARAMS } from '@/lib/types'
import { useAudioStore } from '@/store/useAudioStore'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/ui/Panel'
import { Slider } from '@/components/ui/Slider'
import { Switch } from '@/components/ui/Switch'

/** 统一焦点样式。 */
const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bass-bg'

export default function LowShelfPanel() {
  const lowShelf = useAudioStore((s) => s.params.lowShelf)
  const updateLowShelf = useAudioStore((s) => s.updateLowShelf)
  const { enabled, frequency, gain } = lowShelf

  return (
    <Panel
      title="低频增强"
      icon={<Volume2 className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={() => updateLowShelf({ ...DEFAULT_LOW_SHELF_PARAMS })}
          aria-label="重置低频增强参数"
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
      <Switch
        label="启用"
        checked={enabled}
        onChange={(checked) => updateLowShelf({ enabled: checked })}
      />
      <div className="mt-4 space-y-4">
        <Slider
          label="中心频率"
          value={frequency}
          min={20}
          max={250}
          step={1}
          unit="Hz"
          onChange={(v) => updateLowShelf({ frequency: v })}
          disabled={!enabled}
        />
        <Slider
          label="增益"
          value={gain}
          min={0}
          max={15}
          step={0.5}
          unit="dB"
          onChange={(v) => updateLowShelf({ gain: v })}
          disabled={!enabled}
        />
      </div>
      <p className="mt-4 text-xs text-bass-muted">
        低频增强可提升 20-250 Hz 频段，帮助感知低音与节奏
      </p>
    </Panel>
  )
}
