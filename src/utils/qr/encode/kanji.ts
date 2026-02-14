import { Byte, Encoder, Kanji } from "@nuintun/qrcode";
import {
  isKanjiModeCompatible,
  isShiftJISCompatible,
  segmentText,
  shiftJISByteEncoder,
} from "../shiftjis";
import type { QRCodeResult } from "../types";

/**
 * テキストを漢字モード（Shift_JIS）を使用してQRコードとしてエンコードする
 *
 * **モード動作:**
 * - `useMixedMode=false`: 純粋な漢字モード。テキストがShift_JIS 2バイト文字のみで構成されている必要がある
 * - `useMixedMode=true`: ミックスモード。漢字、半角カタカナ、ASCIIを含むShift_JIS互換テキストを自動的にセグメント分割
 *
 * **セグメント分割:**
 * - 漢字モード対応文字: Kanjiセグメントとしてエンコード（より効率的）
 * - その他のShift_JIS文字（ASCII、半角カタカナ）: Byteセグメントとしてエンコード
 * - Shift_JIS非互換文字: 全体をUTF-8 Byteモードでエンコード
 *
 * @param text - エンコードするテキスト
 * @param useMixedMode - trueの場合、漢字とバイトセグメントの混在を許可。falseの場合、純粋な漢字モードのみ
 * @returns QRコードマトリックスとサイズ
 * @throws useMixedMode=falseで漢字モード非互換文字が含まれる場合にエラーをスロー
 */
export const encodeKanjiQRCode = (
  text: string,
  useMixedMode = false,
): QRCodeResult => {
  const encoder = new Encoder({
    level: "L",
    encode: shiftJISByteEncoder,
  });

  if (useMixedMode) {
    // テキストが完全にShift_JIS互換かチェック
    const isFullySJIS = isShiftJISCompatible(text);

    if (isFullySJIS) {
      // 純粋な漢字モードを使用できるか、ミックスセグメントが必要かチェック
      const isPureKanji = isKanjiModeCompatible(text);

      if (isPureKanji) {
        const qrcode = encoder.encode(new Kanji(text));
        const size = qrcode.size;
        return {
          matrix: Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, x) => qrcode.get(x, y)),
          ),
          size,
        };
      }

      // 非漢字のShift_JIS文字（半角カタカナなど）を含む
      // セグメント分割エンコーディングを使用
      const segments = segmentText(text);
      const qrcode = encoder.encode(...segments);
      const size = qrcode.size;
      return {
        matrix: Array.from({ length: size }, (_, y) =>
          Array.from({ length: size }, (_, x) => qrcode.get(x, y)),
        ),
        size,
      };
    }

    // Shift_JIS非互換、プレーンなバイトモードを使用
    const qrcode = encoder.encode(new Byte(text));
    const size = qrcode.size;
    return {
      matrix: Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => qrcode.get(x, y)),
      ),
      size,
    };
  }

  // 純粋な漢字モード: テキストを検証
  if (!isKanjiModeCompatible(text)) {
    throw new Error(
      "Text contains characters incompatible with Kanji mode. Only Shift_JIS double-byte characters are supported.",
    );
  }

  const qrcode = encoder.encode(new Kanji(text));
  const size = qrcode.size;

  return {
    matrix: Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => qrcode.get(x, y)),
    ),
    size,
  };
};
