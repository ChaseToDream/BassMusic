/**
 * 音频服务层。
 *
 * 作为 AudioProcessor 与全局 store 之间的唯一代理，统一封装播放控制、
 * 参数更新与状态同步。UI 组件与快捷键只调用此服务，不再直接操作 processor。
 *
 * 采用懒初始化策略：首次使用时才创建 AudioProcessor，避免模块加载时
 * 过早实例化 AudioContext（可能违反浏览器用户手势策略）。
 */
import { useAudioStore } from '@/store/useAudioStore'

import type { AudioProcessParams } from '../types'
import { getAudioContext } from './context'
import { getAudioProcessor } from './processor'

class AudioService {
  private processor_: ReturnType<typeof getAudioProcessor> | null = null

  /** 获取或初始化底层 AudioProcessor 单例。 */
  private get processor() {
    if (!this.processor_) {
      this.processor_ = getAudioProcessor()
      this.processor_.onEnded = () => {
        useAudioStore.getState().setPlayState('stopped')
        useAudioStore.getState().setCurrentTime(0)
      }
    }
    return this.processor_
  }

  /** 设置待播放缓冲，并重置播放状态到起始位置。 */
  setBuffer(buffer: AudioBuffer): void {
    this.processor.setBuffer(buffer)
    useAudioStore.getState().setCurrentTime(0)
    useAudioStore.getState().setPlayState('stopped')
  }

  /** 从指定位置开始播放。 */
  play(offsetSeconds = 0): void {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    this.processor.play(offsetSeconds)
    useAudioStore.getState().setPlayState('playing')
  }

  /** 暂停播放。 */
  pause(): void {
    this.processor.pause()
    useAudioStore.getState().setPlayState('paused')
    useAudioStore.getState().setCurrentTime(this.processor.getCurrentTime())
  }

  /** 停止播放。 */
  stop(): void {
    this.processor.stop()
    useAudioStore.getState().setPlayState('stopped')
    useAudioStore.getState().setCurrentTime(0)
  }

  /** 跳转到指定位置；播放中则继续播放，否则仅更新位置。 */
  seek(offsetSeconds: number): void {
    this.processor.seek(offsetSeconds)
    useAudioStore.getState().setCurrentTime(this.processor.getCurrentTime())
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
