/**
 * lamejs 类型声明（lamejs 未随包提供官方类型，此处声明使用到的 API）。
 * 未使用 @types/lamejs 以避免重复声明冲突；如后续用到更多 API，按需补充。
 */
declare module 'lamejs' {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, kbps: number)
    encodeBuffer(left: Int16Array, right?: Int16Array): Uint8Array
    flush(): Uint8Array
  }

  export class WavHeader {
    static encodeHeader(data: unknown): Int8Array
  }

  const lamejs: {
    Mp3Encoder: typeof Mp3Encoder
    WavHeader: typeof WavHeader
  }
  export default lamejs
}
