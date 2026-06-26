/**
 * 全局 AudioContext 单例管理。
 *
 * AudioContext 创建与销毁成本较高，且浏览器对单页应用的 AudioContext
 * 实例数量有限制。本模块统一管理全局唯一的 AudioContext 实例，
 * 供 decoder / processor / 导出等所有音频模块共享，避免重复创建。
 *
 * 注意：浏览器策略要求 AudioContext 在用户交互后才能恢复播放，
 * 本模块仅负责懒创建实例，resume 时机由调用方决定。
 */

/** 全局唯一的 AudioContext 实例。 */
let audioContextInstance: AudioContext | null = null

/**
 * 获取（必要时创建）全局唯一的 AudioContext 实例。
 *
 * 首次调用时通过 `window.AudioContext`（兼容旧版 `webkitAudioContext`）创建，
 * 后续调用返回同一实例。若环境不支持 Web Audio API 则抛出错误。
 * @returns 全局唯一的 AudioContext 实例
 * @throws {Error} 当前环境不支持 Web Audio API 时抛出
 */
export function getAudioContext(): AudioContext {
  if (!audioContextInstance) {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext
      webkitAudioContext?: typeof AudioContext
    }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) {
      throw new Error('当前环境不支持 Web Audio API')
    }
    audioContextInstance = new Ctor()
  }
  return audioContextInstance
}
