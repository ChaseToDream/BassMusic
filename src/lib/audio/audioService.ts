/**
 * 音频服务层。
 *
 * 作为 AudioProcessor 与上层（UI / hooks）之间的唯一代理，统一封装播放控制
 * 与参数更新。本服务是纯命令式 API，不直接读写任何 store：
 *
 * - 调用方（PreviewPlayer / useGlobalShortcuts）负责在调用后同步 store 状态；
 * - 播放结束事件通过 onEnded 回调通知调用方，由调用方更新 store。
 *
 * 这样设计消除了原先 audioService ↔ store 的双向依赖回环，使数据流
 * 退化为单向：UI → audioService → 底层引擎，store 由 UI 统一维护。
 *
 * 采用懒初始化策略：首次使用时才创建 AudioProcessor，避免模块加载时
 * 过早实例化 AudioContext（可能违反浏览器用户手势策略）。
 */
import type { AudioProcessParams } from '../types'
import { getAudioContext } from './context'
import { type AudioProcessor, getAudioProcessor } from './processor'

class AudioService {
  private processor_: AudioProcessor | null = null

  /**
   * 播放结束回调。
   *
   * 由上层（PreviewPlayer）设置，在底层 AudioProcessor 触发 onEnded 时
   * 被调用。audioService 不在此处直接写 store，交由调用方决定如何同步状态。
   */
  onEnded: (() => void) | null = null

  /** 获取或初始化底层 AudioProcessor 单例。 */
  private get processor() {
    if (!this.processor_) {
      this.processor_ = getAudioProcessor()
      this.processor_.onEnded = () => {
        this.onEnded?.()
      }
    }
    return this.processor_
  }

  /** 设置待播放缓冲。仅操作底层引擎，不写任何外部状态。 */
  setBuffer(buffer: AudioBuffer): void {
    this.processor.setBuffer(buffer)
  }

  /** 从指定位置开始播放。 */
  play(offsetSeconds = 0): void {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    this.processor.play(offsetSeconds)
  }

  /** 暂停播放。返回暂停时刻的播放位置（秒），供调用方同步 store。 */
  pause(): number {
    this.processor.pause()
    return this.processor.getCurrentTime()
  }

  /** 停止播放。调用方负责将 store 的 playState/currentTime 重置。 */
  stop(): void {
    this.processor.stop()
  }

  /** 跳转到指定位置。返回跳转后的播放位置（秒），供调用方同步 store。 */
  seek(offsetSeconds: number): number {
    this.processor.seek(offsetSeconds)
    return this.processor.getCurrentTime()
  }

  /** 将处理参数应用到实时处理链。 */
  updateParams(params: AudioProcessParams): void {
    this.processor.updateParams(params)
  }

  /** 获取当前播放位置（秒）。 */
  getCurrentTime(): number {
    return this.processor.getCurrentTime()
  }

  /** 获取当前缓冲总时长（秒）。 */
  getDuration(): number {
    return this.processor.getDuration()
  }

  /** 是否正在播放。 */
  isPlaying(): boolean {
    return this.processor.isPlaying()
  }
}

/** 全局音频服务单例。 */
export const audioService = new AudioService()
