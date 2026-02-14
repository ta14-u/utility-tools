import jsQR from "jsqr";
import type { DecodeResult } from "../types";

/**
 * jsQRライブラリを使用してQRコードをデコードする
 * ZXingでのデコードが失敗した場合のフォールバックとして使用される
 * 日本語文字の検出によりShift_JIS漢字モードの自動判定を行う
 * @param rgba - RGBA画像データ
 * @param width - 画像の幅
 * @param height - 画像の高さ
 * @returns デコード結果、またはデコードに失敗した場合はnull
 */
export const decodeWithJsQR = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): DecodeResult | null => {
  const code = jsQR(rgba, width, height, {
    inversionAttempts: "attemptBoth",
  });

  if (code) {
    const binary = new Uint8Array(code.binaryData);

    // デコードされたテキストに日本語文字が含まれているかチェック（漢字モードを示す）
    const hasJapanese =
      /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uff66-\uff9f]/.test(
        code.data,
      );

    if (hasJapanese) {
      // 日本語文字を含む - おそらくShift_JIS漢字モード
      return { text: code.data, encoding: "Shift-JIS (Kanji mode)" };
    }

    // 日本語でないテキストに対してShift_JISデコードを試行
    try {
      const sjis = new TextDecoder("shift-jis", { fatal: true }).decode(binary);
      if (sjis.length > 0 && sjis === code.data) {
        return { text: sjis, encoding: "Shift-JIS" };
      }
    } catch {}

    if (code.data === "" && code.binaryData.length > 0) {
      try {
        const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(binary);
        if (utf8.length > 0) {
          return { text: utf8, encoding: "UTF-8" };
        }
      } catch {
        try {
          const sjis = new TextDecoder("shift-jis", { fatal: true }).decode(
            binary,
          );
          if (sjis.length > 0) {
            return { text: sjis, encoding: "Shift-JIS" };
          }
        } catch {
          // テキストとしてのデコードに失敗
        }
      }
      return {
        text: `[Decoded empty string, but found ${code.binaryData.length} bytes of binary data]`,
        encoding: "Binary",
      };
    }
    return { text: code.data, encoding: "UTF-8" };
  }

  return null;
};
