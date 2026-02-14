import {
  BinaryBitmap,
  type DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  InvertedLuminanceSource,
  MultiFormatReader,
  type RGBLuminanceSource,
} from "@zxing/library";

/**
 * ZXingライブラリを使用して複数の二値化戦略でQRコードをデコードする
 * HybridBinarizerとGlobalHistogramBinarizerの両方を試行し、
 * さらに反転した輝度ソースでもデコードを試みることで高い成功率を実現する
 * @param luminanceSource - デコードする輝度ソース
 * @param hints - デコードヒント（フォーマット、TRY_HARDERフラグなど）
 * @returns デコード結果とビットマップ、またはデコードに失敗した場合はnull
 */
export const decodeWithZXing = (
  luminanceSource: RGBLuminanceSource,
  hints: Map<DecodeHintType, unknown>,
) => {
  const zxingReader = new MultiFormatReader();
  zxingReader.setHints(hints);

  const zxingDecode = (
    source: RGBLuminanceSource | InvertedLuminanceSource,
  ) => {
    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(source));
      return { result: zxingReader.decode(bitmap), bitmap };
    } catch {
      try {
        const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(source));
        return { result: zxingReader.decode(bitmap), bitmap };
      } catch {
        return null;
      }
    }
  };

  let zxingResult = zxingDecode(luminanceSource);
  if (!zxingResult) {
    const invertedSource = new InvertedLuminanceSource(luminanceSource);
    zxingResult = zxingDecode(invertedSource);
  }

  return zxingResult;
};
