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

import { validateAudioFile, getAudioMeta, verifyMagicBytes } from './decoder'
import type { AudioFileMeta } from '../types'

/** 构造仅含 name / size 的 File 桩，用于纯函数测试（无需真实数据）。 */
function makeFileStub(name: string, size: number, type = ''): File {
  return { name, size, type } as unknown as File
}

/** 构造 AudioBuffer 桩，仅填充 getAudioMeta 所需字段。 */
function makeBufferStub(
  opts: {
    duration?: number
    sampleRate?: number
    numberOfChannels?: number
  } = {},
): AudioBuffer {
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

  // ---- MIME 类型校验（P3-2 新增）----

  it('接受匹配扩展名的 MIME 类型', () => {
    expect(validateAudioFile(makeFileStub('a.mp3', 1024, 'audio/mpeg')).valid).toBe(true)
    expect(validateAudioFile(makeFileStub('b.wav', 1024, 'audio/wav')).valid).toBe(true)
    expect(validateAudioFile(makeFileStub('c.flac', 1024, 'audio/flac')).valid).toBe(true)
    expect(validateAudioFile(makeFileStub('d.ogg', 1024, 'audio/ogg')).valid).toBe(true)
    expect(validateAudioFile(makeFileStub('e.m4a', 1024, 'audio/mp4')).valid).toBe(true)
  })

  it('接受空 MIME 类型（浏览器未提供时放行）', () => {
    expect(validateAudioFile(makeFileStub('a.mp3', 1024, '')).valid).toBe(true)
    expect(validateAudioFile(makeFileStub('b.wav', 1024)).valid).toBe(true)
  })

  it('拒绝与扩展名不匹配的 MIME 类型', () => {
    const result = validateAudioFile(makeFileStub('a.mp3', 1024, 'text/plain'))
    expect(result.valid).toBe(false)
    expect(result.error).toContain('MIME')
    expect(result.error).toContain('text/plain')
  })

  it('拒绝伪装成音频的可执行文件（MIME 不匹配）', () => {
    const result = validateAudioFile(
      makeFileStub('malicious.mp3', 1024, 'application/x-msdownload'),
    )
    expect(result.valid).toBe(false)
  })
})

// ===================== verifyMagicBytes =====================

/** 构造带 slice/arrayBuffer 的 File 桩，用于魔数校验测试。 */
function makeFileWithHeader(name: string, header: number[]): File {
  const bytes = new Uint8Array(Math.max(header.length, 12))
  bytes.set(header, 0)
  return {
    name,
    size: bytes.byteLength,
    type: '',
    slice: (start: number, end: number) => ({
      arrayBuffer: () => Promise.resolve(bytes.slice(start, end).buffer),
    }),
  } as unknown as File
}

describe('verifyMagicBytes', () => {
  it('接受正确的 MP3 文件头（ID3）', async () => {
    // "ID3" + 填充
    const file = makeFileWithHeader(
      'a.mp3',
      [0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    )
    const result = await verifyMagicBytes(file)
    expect(result.valid).toBe(true)
  })

  it('接受正确的 WAV 文件头（RIFF）', async () => {
    // "RIFF"...."WAVE"
    const file = makeFileWithHeader(
      'a.wav',
      [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45],
    )
    const result = await verifyMagicBytes(file)
    expect(result.valid).toBe(true)
  })

  it('接受正确的 FLAC 文件头（fLaC）', async () => {
    const file = makeFileWithHeader(
      'a.flac',
      [0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    )
    const result = await verifyMagicBytes(file)
    expect(result.valid).toBe(true)
  })

  it('接受正确的 OGG 文件头（OggS）', async () => {
    const file = makeFileWithHeader(
      'a.ogg',
      [0x4f, 0x67, 0x67, 0x53, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    )
    const result = await verifyMagicBytes(file)
    expect(result.valid).toBe(true)
  })

  it('接受正确的 M4A 文件头（offset=4 处 ftyp）', async () => {
    // 前 4 字节为 size，offset=4 处为 "ftyp"
    const file = makeFileWithHeader(
      'a.m4a',
      [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20],
    )
    const result = await verifyMagicBytes(file)
    expect(result.valid).toBe(true)
  })

  it('拒绝伪装文件：txt 改名为 mp3', async () => {
    // "hello world" 文本，非 ID3 头
    const file = makeFileWithHeader(
      'fake.mp3',
      [0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x00],
    )
    const result = await verifyMagicBytes(file)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('不匹配')
  })

  it('拒绝伪装文件：exe 改名为 wav', async () => {
    // MZ 头（Windows PE）
    const file = makeFileWithHeader(
      'trojan.wav',
      [0x4d, 0x5a, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    )
    const result = await verifyMagicBytes(file)
    expect(result.valid).toBe(false)
  })

  it('拒绝过小文件（无法读取魔数）', async () => {
    const tinyFile = {
      name: 'tiny.mp3',
      size: 3,
      type: '',
      slice: () => ({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(3)) }),
    } as unknown as File
    const result = await verifyMagicBytes(tinyFile)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('损坏')
  })

  it('读取失败时返回错误', async () => {
    const errorFile = {
      name: 'error.mp3',
      size: 100,
      type: '',
      slice: () => ({ arrayBuffer: () => Promise.reject(new Error('IO')) }),
    } as unknown as File
    const result = await verifyMagicBytes(errorFile)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('读取')
  })
})

// ===================== getAudioMeta =====================

describe('getAudioMeta', () => {
  it('正确提取元数据', () => {
    const file = makeFileStub('demo.flac', 2048)
    const buffer = makeBufferStub({
      duration: 12.5,
      sampleRate: 48000,
      numberOfChannels: 2,
    })
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
    const buffer = makeBufferStub({
      duration: 0.5,
      sampleRate: 96000,
      numberOfChannels: 2,
    })
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

/** context 模块动态引用类型。 */
type ContextModule = typeof import('./context')

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
  let context: ContextModule

  beforeEach(async () => {
    // 重置模块以重置内部单例，确保每个用例从全新状态开始
    vi.resetModules()
    context = await import('./context')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('首次调用创建实例，后续返回同一实例', () => {
    const { mockCtor } = stubAudioContext(vi.fn(() => Promise.resolve(makeBufferStub())))

    const ctx1 = context.getAudioContext()
    const ctx2 = context.getAudioContext()

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
