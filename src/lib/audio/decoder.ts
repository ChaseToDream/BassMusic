/**
 * 音频解码模块。
 *
 * 使用 AudioContext.decodeAudioData 解码上传的音频文件，返回 AudioBuffer，
 * 并提供文件校验、AudioContext 单例管理与元信息提取能力。
 */
import type { AudioFileMeta } from '../types'

/** 支持的音频文件扩展名（小写形式）。 */
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'] as const

/** 文件大小上限：50 MB（50 * 1024 * 1024 字节）。 */
const MAX_FILE_SIZE = 50 * 1024 * 1024

/** 解码失败时抛出的中文错误信息。 */
const DECODE_ERROR_MESSAGE = '音频文件解码失败，可能已损坏或编码不支持'

/** 单例 AudioContext，避免重复创建带来性能开销。 */
let audioContextInstance: AudioContext | null = null

/**
 * 获取单例 AudioContext。
 *
 * 首次调用时通过 `new (window.AudioContext || window.webkitAudioContext)()` 创建实例，
 * 后续调用返回同一实例。AudioContext 创建与销毁成本较高，全局复用一份即可。
 * @returns 全局唯一的 AudioContext 实例
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

/**
 * 校验音频文件是否合法。
 *
 * 规则：
 * - 扩展名须为 mp3 / wav / flac / ogg / m4a（不区分大小写）；
 * - 文件大小不超过 50 MB。
 * @param file - 待校验的文件
 * @returns 校验结果，valid 为 true 时合法，否则 error 给出中文原因
 */
export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase()
  const isExtensionValid = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  if (!isExtensionValid) {
    return { valid: false, error: '不支持的音频格式，仅支持 mp3、wav、flac、ogg、m4a' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '文件过大，最大支持 50MB' }
  }
  return { valid: true }
}

/**
 * 解码音频文件为 AudioBuffer。
 *
 * 流程：
 * 1. 获取单例 AudioContext；
 * 2. 通过 `file.arrayBuffer()` 读取文件二进制；
 * 3. 调用 `decodeAudioData` 解码。
 *
 * 兼容现代 Promise 式与旧版回调式 decodeAudioData：以回调形式调用，
 * 并在返回值为 Promise 时复用其结果。decodeAudioData 仅调用一次，
 * 避免 ArrayBuffer 被 detach 后重复使用。
 * @param file - 待解码的音频文件
 * @returns 解码后的 AudioBuffer
 * @throws {Error} 解码失败时抛出 `音频文件解码失败，可能已损坏或编码不支持`
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const audioContext = getAudioContext()
  const arrayBuffer = await file.arrayBuffer()

  return new Promise<AudioBuffer>((resolve, reject) => {
    const onSuccess = (buffer: AudioBuffer) => resolve(buffer)
    const onError = () => reject(new Error(DECODE_ERROR_MESSAGE))

    try {
      // 回调式调用：现代浏览器返回 Promise，旧版浏览器通过回调触发。
      const ret = audioContext.decodeAudioData(
        arrayBuffer,
        onSuccess,
        onError,
      ) as unknown as Promise<AudioBuffer> | undefined

      // 现代浏览器返回 Promise，复用其结果（resolve/reject 幂等，回调与 Promise 均触发亦安全）。
      if (ret && typeof ret.then === 'function') {
        ret.then(onSuccess, onError)
      }
    } catch {
      onError()
    }
  })
}

/**
 * 从 File 与解码后的 AudioBuffer 提取音频元信息。
 * @param file - 原始文件（用于文件名与大小）
 * @param buffer - 解码后的音频缓冲（用于时长、采样率与声道数）
 * @returns 音频文件元信息
 */
export function getAudioMeta(file: File, buffer: AudioBuffer): AudioFileMeta {
  return {
    fileName: file.name,
    fileSize: file.size,
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
  }
}
