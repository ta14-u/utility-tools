import BitSource from "@zxing/library/esm/core/common/BitSource";
import Mode from "@zxing/library/esm/core/qrcode/decoder/Mode";
import type Version from "@zxing/library/esm/core/qrcode/decoder/Version";

/**
 * ビットストリームからECI（拡張チャネル解釈）値を解析する
 * ECI値は1〜3バイトで表現され、エンコーディング情報を含む
 * @param bits - ビットソース
 * @returns ECI値、または解析に失敗した場合はnull
 */
export const parseECIValue = (bits: BitSource) => {
  if (bits.available() < 8) {
    return null;
  }
  const firstByte = bits.readBits(8);
  if ((firstByte & 0x80) === 0) {
    return firstByte & 0x7f;
  }
  if ((firstByte & 0xc0) === 0x80) {
    if (bits.available() < 8) {
      return null;
    }
    const secondByte = bits.readBits(8);
    return (((firstByte & 0x3f) << 8) & 0xffffffff) | secondByte;
  }
  if ((firstByte & 0xe0) === 0xc0) {
    if (bits.available() < 16) {
      return null;
    }
    const secondThirdBytes = bits.readBits(16);
    return (((firstByte & 0x1f) << 16) & 0xffffffff) | secondThirdBytes;
  }
  return null;
};

/**
 * ビットストリーム内の数字モードデータをスキップする
 * 数字モードは3桁ごとに10ビット、残り2桁は7ビット、1桁は4ビットで表現される
 * @param bits - ビットソース
 * @param count - スキップする数字の文字数
 */
export const skipNumeric = (bits: BitSource, count: number) => {
  while (count >= 3) {
    bits.readBits(10);
    count -= 3;
  }
  if (count === 2) {
    bits.readBits(7);
  } else if (count === 1) {
    bits.readBits(4);
  }
};

/**
 * ビットストリーム内の英数字モードデータをスキップする
 * 英数字モードは2文字ごとに11ビット、残り1文字は6ビットで表現される
 * @param bits - ビットソース
 * @param count - スキップする英数字の文字数
 */
export const skipAlphanumeric = (bits: BitSource, count: number) => {
  while (count > 1) {
    bits.readBits(11);
    count -= 2;
  }
  if (count === 1) {
    bits.readBits(6);
  }
};

/**
 * ビットストリーム内の指定されたビット数をスキップする
 * 32ビット以上のデータは32ビットずつ分割して読み飛ばす
 * @param bits - ビットソース
 * @param totalBits - スキップする総ビット数
 */
export const skipBits = (bits: BitSource, totalBits: number) => {
  let remaining = totalBits;
  while (remaining > 0) {
    const toRead = Math.min(32, remaining);
    bits.readBits(toRead);
    remaining -= toRead;
  }
};

/** データを保持するQRセグメントモード名（NUMERIC, ALPHANUMERIC, BYTE, KANJI, HANZI） */
export type DataSegmentMode =
  | "NUMERIC"
  | "ALPHANUMERIC"
  | "BYTE"
  | "KANJI"
  | "HANZI";

/**
 * QRコードの生バイトデータをスキャンして漢字モードの使用とセグメントモード一覧を取得する
 * QRコードのビットストリームをパースし、各セグメントのモードを確認する
 * @param bytes - QRコードの生バイトデータ
 * @param version - QRコードのバージョン情報
 * @returns { hasKanji: 漢字モードが含まれているか, modes: データセグメントのモード名の並び, isValid: ビットストリームが有効か, failureReason: 失敗理由（エラー時のみ）}
 */
export const scanForKanjiMode = (
  bytes: Uint8Array,
  version: Version,
): {
  hasKanji: boolean;
  modes: DataSegmentMode[];
  isValid: boolean;
  failureReason: string | null;
} => {
  const bits = new BitSource(bytes);
  let hasKanji = false;
  const modes: DataSegmentMode[] = [];
  let isValid = true;
  let failureReason: string | null = null;
  try {
    while (true) {
      if (bits.available() < 4) {
        break;
      }
      const mode = Mode.forBits(bits.readBits(4));
      if (mode === Mode.TERMINATOR) {
        break;
      }
      if (
        mode === Mode.FNC1_FIRST_POSITION ||
        mode === Mode.FNC1_SECOND_POSITION
      ) {
        continue;
      }
      if (mode === Mode.STRUCTURED_APPEND) {
        if (bits.available() < 16) {
          isValid = false;
          failureReason = "structured-append length";
          break;
        }
        bits.readBits(16);
        continue;
      }
      if (mode === Mode.ECI) {
        if (parseECIValue(bits) === null) {
          isValid = false;
          failureReason = "eci value";
          break;
        }
        continue;
      }
      if (mode === Mode.HANZI) {
        modes.push("HANZI");
        if (bits.available() < 4) {
          isValid = false;
          failureReason = "hanzi subset";
          break;
        }
        bits.readBits(4);
        const countBits = mode.getCharacterCountBits(version);
        if (bits.available() < countBits) {
          isValid = false;
          failureReason = "hanzi count";
          break;
        }
        const count = bits.readBits(countBits);
        const totalBits = 13 * count;
        if (bits.available() < totalBits) {
          isValid = false;
          failureReason = "hanzi data";
          break;
        }
        skipBits(bits, totalBits);
        continue;
      }

      const countBits = mode.getCharacterCountBits(version);
      if (bits.available() < countBits) {
        isValid = false;
        failureReason = "count bits";
        break;
      }
      const count = bits.readBits(countBits);
      if (mode === Mode.NUMERIC) {
        modes.push("NUMERIC");
        skipNumeric(bits, count);
      } else if (mode === Mode.ALPHANUMERIC) {
        modes.push("ALPHANUMERIC");
        skipAlphanumeric(bits, count);
      } else if (mode === Mode.BYTE) {
        modes.push("BYTE");
        const totalBits = 8 * count;
        if (bits.available() < totalBits) {
          isValid = false;
          failureReason = "byte data";
          break;
        }
        skipBits(bits, totalBits);
      } else if (mode === Mode.KANJI) {
        hasKanji = true;
        modes.push("KANJI");
        const totalBits = 13 * count;
        if (bits.available() < totalBits) {
          isValid = false;
          failureReason = "kanji data";
          break;
        }
        skipBits(bits, totalBits);
      } else {
        isValid = false;
        failureReason = "unknown mode";
        break;
      }
    }
  } catch {
    isValid = false;
    failureReason = "exception";
  }
  return { hasKanji, modes, isValid, failureReason };
};
