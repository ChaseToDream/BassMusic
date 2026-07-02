/**
 * 音频解码模块。
 *
 * 使用 AudioContext.decodeAudioData 解码上传的音频文件，返回 AudioBuffer，
 * 并提供文件校验与元信息提取能力。AudioContext 单例由 context.ts 统一管理。
 */
import { getAudioContext } from './context'
import type { AudioFileMeta } from '../types'

/** 支持的音频文件扩展名（小写形式）。 */
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'] as const

/** 文件大小上限：50 MB（50 * 1024 * 1024 字节）。 */
const MAX_FILE_SIZE = 50 * 1024 * 1024

/** 解码失败时抛出的中文错误信息。 */
const DECODE_ERROR_MESSAGE = '音频文件解码失败，可能已损坏或编码不支持'

/**
 * 扩展名 → MIME 白名单映射。
 * file.type 由浏览器根据扩展名或系统注册表推断，可能与实际内容不一致，
 * 因此 MIME 仅作为前置过滤，最终以魔数校验为准。
 */
const EXT_MIME_MAP: Record<string, string[]> = {
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
  '.flac': ['audio/flac', 'audio/x-flac'],
  '.ogg': ['audio/ogg', 'application/ogg'],
  '.m4a': ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
}

/**
 * 扩展名 → 文件头魔数映射（前若干字节）。
 * 用于检测文件内容与扩展名是否匹配，拦截伪装文件。
 * - mp3：ID3v2 头 "ID3" 或帧同步 0xFFEx 0xFB（未列出帧同步，仅用 ID3 提高准确率）
 * - wav：RIFF....WAVE
 * - flac：fLaC
 * - ogg：OggS
 * - m4a：ftyp（ISO BMFF 容器，offset=4 处为 "ftyp"）
 */
const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }> = {
  '.mp3': { offset: 0, bytes: [0x49, 0x44, 0x33] }, // "ID3"
  '.wav': { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
  '.flac': { offset: 0, bytes: [0x66, 0x4c, 0x61, 0x43] }, // "fLaC"
  '.ogg': { offset: 0, bytes: [0x4f, 0x67, 0x67, 0x53] }, // "OggS"
  // m4a 为 ISO BMFF 容器，offset=4 处为 "ftyp"
  '.m4a': { offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // "ftyp"
}

/** 读取文件头魔数所需的最大字节数。 */
const MAGIC_HEADER_SIZE = 12

/** 校验结果。 */
export interface ValidationResult {
  /** 是否合法。 */
  valid: boolean
  /** 失败时的中文错误原因。 */
  error?: string
}

/**
 * 校验音频文件是否合法（同步部分：扩展名 + 大小 + MIME 类型）。
 *
 * 规则：
 * - 扩展名须为 mp3 / wav / flac / ogg / m4a（不区分大小写）；
 * - 文件大小不超过 50 MB；
 * - 若浏览器提供了 file.type，须在扩展名对应的 MIME 白名单内。
 *
 * 注意：本函数仅做"无需读取文件内容即可判定"的校验。
 * 文件内容与扩展名是否匹配（魔数校验）请使用 {@link verifyMagicBytes}，
 * 二者配合使用：`const r = validateAudioFile(file); if (r.valid) await verifyMagicBytes(file)`。
 *
 * @param file - 待校验的文件
 * @returns 校验结果，valid 为 true 时合法，否则 error 给出中文原因
 */
export function validateAudioFile(file: File): ValidationResult {
  const lowerName = file.name.toLowerCase()
  const ext = ACCEPTED_EXTENSIONS.find((e) => lowerName.endsWith(e))
  if (!ext) {
    return { valid: false, error: '不支持的音频格式，仅支持 mp3、wav、flac、ogg、m4a' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: '文件过大，最大支持 50MB' }
  }
  // MIME 校验：浏览器未提供 type 时放行（部分系统不填充），有则须在白名单内
  if (file.type) {
    const allowedMimes = EXT_MIME_MAP[ext] ?? []
    if (!allowedMimes.includes(file.type)) {
      return { valid: false, error: `文件 MIME 类型 "${file.type}" 与扩展名不匹配` }
    }
  }
  return { valid: true }
}

/**
 * 校验文件头魔数是否与扩展名匹配（异步，需读取文件前若干字节）。
 *
 * 对于无魔数规则的格式（未来扩展）直接放行；
 * 对于有魔数规则的格式，读取文件前 12 字节并比对。
 *
 * 建议在 {@link validateAudioFile} 通过后调用，作为内容层校验补充。
 *
 * @param file - 待校验的文件
 * @returns 校验结果，valid 为 true 时通过
 */
export async function verifyMagicBytes(file: File): Promise<ValidationResult> {
  const lowerName = file.name.toLowerCase()
  const ext = ACCEPTED_EXTENSIONS.find((e) => lowerName.endsWith(e))
  // 无扩展名或无魔数规则：放行（已在 validateAudioFile 拦截非法扩展名）
  if (!ext || !MAGIC_BYTES[ext]) {
    return { valid: true }
  }
  // 文件过小无法读取魔数：视为损坏
  if (file.size < MAGIC_HEADER_SIZE) {
    return { valid: false, error: '文件过小或已损坏' }
  }
  try {
    const header = new Uint8Array(await file.slice(0, MAGIC_HEADER_SIZE).arrayBuffer())
    const { offset, bytes } = MAGIC_BYTES[ext]
    for (let i = 0; i < bytes.length; i++) {
      if (header[offset + i] !== bytes[i]) {
        return {
          valid: false,
          error: '文件内容与扩展名不匹配，可能已损坏或被伪装',
        }
      }
    }
    return { valid: true }
  } catch {
    return { valid: false, error: '读取文件头失败，请重试' }
  }
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
