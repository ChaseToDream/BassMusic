/**
 * decoder 单元测试
 *
 * 说明：
 * - validateAudioFile / getAudioMeta 为纯函数，直接用桩对象测试。
 * - getAudioContext / decodeAudioFile 依赖浏览器 AudioContext，
 *   此处通过 vi.stubGlobal 注入 mock AudioContext 进行轻量验证。
 *   真实解码行为（各编码格式、真实损坏文件、采样率与声道提取等）
 *   需在浏览器中集成验证，此处不覆盖。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { validateAudioFile, getAudioMeta } from './decoder'
import type { AudioFileMeta } from '../types'

/** 构造仅含 name / size 的 File 桩，用于纯函数测试（无需真实数据）。 */
function makeFileStub(name: string, size: number): File {
  return { name, size } as unknown as File
}

/** 构造 AudioBuffer 桩，仅填充 getAudioMeta 所需字段。 */
function makeBufferStub(opts: {
  duration?: number
  sampleRate?: number
  numberOfChannels?: number
} = {}): AudioBuffer {
  return {
    duration: opts.duration ?? 10,
    sampleRate: opts.sampleRate ?? 44100,
    numberOfChannels: opts.numberOfChannels ?? 2,
  } as unknown as AudioBuffer
}

// ===================== validateAudioFile =====================

describe('validateAudioFile', () => {
  it('接受合法扩展名（不区分大小写）', () => {
    const names = ['a.mp3', 'b.WAV', 'c.Flac', 'd.OGG', 'e.M4a', 'f.Mp3', 'g.wav']
    for (const name of names) {
      const result = validateAudioFile(makeFileStub(name, 1024))
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    }
  })

  it('拒绝不支持的格式并给出中文原因', () => {
    const result = validateAudioFile(makeFileStub('song.txt', 1024))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('不支持的音频格式，仅支持 mp3、wav、flac、ogg、m4a')
  })

  it('拒绝无扩展名文件', () => {
    const result = validateAudioFile(makeFileStub('song', 1024))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('不支持的音频格式，仅支持 mp3、wav、flac、ogg、m4a')
  })

  it('拒绝伪装扩展名（如 song.mp3.txt）', () => {
    const result = validateAudioFile(makeFileStub('song.mp3.txt', 1024))
    expect(result.valid).toBe(false)
  })

  it('拒绝超大文件并给出中文原因', () => {
    const overLimit = 50 * 1024 * 1024 + 1
    const result = validateAudioFile(makeFileStub('big.mp3', overLimit))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('文件过大，最大支持 50MB')
  })

  it('接受恰好 50MB 的文件（边界）', () => {
    const exactlyLimit = 50 * 1024 * 1024
    const result = validateAudioFile(makeFileStub('edge.flac', exactlyLimit))
    expect(result.valid).toBe(true)
  })

  it('格式校验优先于大小校验（非法格式直接拒绝）', () => {
    const result = validateAudioFile(makeFileStub('big.exe', 50 * 1024 * 1024 + 1))
    expect(result.valid).toBe(false)
    expect(result.error).toBe('不支持的音频格式，仅支持 mp3、wav、flac、ogg、m4a')
  })
})

// ===================== getAudioMeta =====================

describe('getAudioMeta', () => {
  it('正确提取元数据', () => {
    const file = makeFileStub('demo.flac', 2048)
    const buffer = makeBufferStub({ duration: 12.5, sampleRate: 48000, numberOfChannels: 2 })
    const meta = getAudioMeta(file, buffer)
    const expected: AudioFileMeta = {
      fileName: 'demo.flac',
      fileSize: 2048,
      duration: 12.5,
      sampleRate: 48000,
      numberOfChannels: 2,
    }
    expect(meta).toEqual(expected)
  })

  it('单声道音频 numberOfChannels 为 1', () => {
    const file = makeFileStub('mono.wav', 512)
    const buffer = makeBufferStub({ duration: 3, sampleRate: 44100, numberOfChannels: 1 })
    expect(getAudioMeta(file, buffer).numberOfChannels).toBe(1)
  })

  it('不同采样率与时长均能正确读取', () => {
    const file = makeFileStub('hi.m4a', 99999)
    const buffer = makeBufferStub({ duration: 0.5, sampleRate: 96000, numberOfChannels: 2 })
    const meta = getAudioMeta(file, buffer)
    expect(meta.sampleRate).toBe(96000)
    expect(meta.duration).toBe(0.5)
    expect(meta.fileSize).toBe(99999)
    expect(meta.fileName).toBe('hi.m4a')
  })
})

// ===================== getAudioContext / decodeAudioFile（mock） =====================

/** 模块动态引用类型。 */
type DecoderModule = typeof import('./decoder')

/** 构造带 arrayBuffer 方法的 File 桩，供 decodeAudioFile 使用。 */
function makeDecodableFile(name = 'test.mp3', bytes = new ArrayBuffer(8)): File {
  return {
    name,
    size: bytes.byteLength,
    arrayBuffer: () => Promise.resolve(bytes),
  } as unknown as File
}

/**
 * 在全局注入 mock AudioContext 构造器。
 * @param decodeAudioData - 自定义的 decodeAudioData 行为
 * @returns 构造器 spy 与创建出的 mock context
 */
function stubAudioContext(decodeAudioData: (...args: any[]) => unknown): {
  mockContext: AudioContext
  mockCtor: ReturnType<typeof vi.fn>
} {
  const mockContext = { decodeAudioData } as unknown as AudioContext
  // 注意：构造器 mock 必须使用 function 实现，否则无法被 `new` 调用（箭头函数不可作构造器）。
  // 构造器返回对象时，`new` 表达式结果即为该对象。
  const mockCtor = vi.fn(function (this: unknown) {
    return mockContext
  })
  vi.stubGlobal('AudioContext', mockCtor)
  return { mockContext, mockCtor }
}

describe('getAudioContext', () => {
  let decoder: DecoderModule

  beforeEach(async () => {
    // 重置模块以重置内部单例，确保每个用例从全新状态开始
    vi.resetModules()
    decoder = await import('./decoder')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('首次调用创建实例，后续返回同一实例', () => {
    const { mockCtor } = stubAudioContext(vi.fn(() => Promise.resolve(makeBufferStub())))

    const ctx1 = decoder.getAudioContext()
    const ctx2 = decoder.getAudioContext()

    expect(ctx1).toBe(ctx2)
    expect(mockCtor).toHaveBeenCalledTimes(1)
  })
})

describe('decodeAudioFile', () => {
  let decoder: DecoderModule

  beforeEach(async () => {
    vi.resetModules()
    decoder = await import('./decoder')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('成功解码返回 AudioBuffer（现代 Promise 式 API）', async () => {
    const mockBuffer = makeBufferStub({ duration: 2 })
    stubAudioContext(vi.fn(() => Promise.resolve(mockBuffer)))

    const result = await decoder.decodeAudioFile(makeDecodableFile())
    expect(result).toBe(mockBuffer)
  })

  it('兼容旧版回调式 API：通过 success 回调返回结果', async () => {
    const mockBuffer = makeBufferStub({ duration: 4 })
    stubAudioContext(
      vi.fn((_buf: unknown, success?: (b: AudioBuffer) => void) => {
        success?.(mockBuffer)
        return undefined
      }),
    )

    const result = await decoder.decodeAudioFile(makeDecodableFile())
    expect(result).toBe(mockBuffer)
  })

  it('解码失败抛出中文错误（Promise reject 分支）', async () => {
    stubAudioContext(vi.fn(() => Promise.reject(new DOMException('fail'))))

    await expect(decoder.decodeAudioFile(makeDecodableFile())).rejects.toThrow(
      '音频文件解码失败，可能已损坏或编码不支持',
    )
  })

  it('解码失败抛出中文错误（回调 error 分支）', async () => {
    stubAudioContext(
      vi.fn((_buf: unknown, _success?: () => void, error?: () => void) => {
        error?.()
        return undefined
      }),
    )

    await expect(decoder.decodeAudioFile(makeDecodableFile())).rejects.toThrow(
      '音频文件解码失败，可能已损坏或编码不支持',
    )
  })

  it('decodeAudioData 同步抛出时也转为中文错误', async () => {
    stubAudioContext(
      vi.fn(() => {
        throw new Error('not supported')
      }),
    )

    await expect(decoder.decodeAudioFile(makeDecodableFile())).rejects.toThrow(
      '音频文件解码失败，可能已损坏或编码不支持',
    )
  })

  it('读取文件二进制后调用 decodeAudioData', async () => {
    const payload = new ArrayBuffer(16)
    const mockBuffer = makeBufferStub()
    // 声明首参类型，使 mock.calls 的元素元组含该参数，便于断言。
    const decodeMock = vi.fn((_buf: ArrayBuffer) => Promise.resolve(mockBuffer))
    stubAudioContext(decodeMock)

    await decoder.decodeAudioFile(makeDecodableFile('clip.mp3', payload))

    expect(decodeMock).toHaveBeenCalledTimes(1)
    // decodeAudioData 首参为 ArrayBuffer
    const firstArg = decodeMock.mock.calls[0]?.[0]
    expect(firstArg).toBeInstanceOf(ArrayBuffer)
  })
})
