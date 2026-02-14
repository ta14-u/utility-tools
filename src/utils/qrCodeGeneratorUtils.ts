// 後方互換性のための再エクスポート
// このファイルは将来のリファクタリング段階で削除される予定

export { encodeKanjiQRCode } from "./qr/encode/kanji";
export {
  isKanjiModeCompatible,
  isShiftJISCompatible,
  segmentText,
  shiftJISByteEncoder as customShiftJISEncoder,
} from "./qr/shiftjis";
