// 後方互換性のための再エクスポート
// このファイルは将来のリファクタリング段階で削除される予定

export {
  parseECIValue,
  scanForKanjiMode,
  skipAlphanumeric,
  skipBits,
  skipNumeric,
} from "./qr/bitstream";
export { decodeQrCode } from "./qr/decode/decoder";
export {
  joinByteSegments,
  tryDecodeAsText as tryDecode,
} from "./qr/encoding";
