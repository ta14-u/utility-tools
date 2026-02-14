import { Byte, Charset, Kanji } from "@nuintun/qrcode";
import Encoding from "encoding-japanese";

/**
 * 指定されたインデックスでShift_JIS2バイト文字シーケンスを検証する
 * @param sjisArray - Shift_JISバイト配列
 * @param index - 現在のインデックス（2バイト文字の1バイト目）
 * @param range - 範囲設定 { first: [min, max], second: [[min1, max1], [min2, max2]] }
 * @returns 2バイト文字の次のインデックス、または無効な場合は-1、この範囲に該当しない場合は元のindex
 */
const validateSJISDoubleByteAt = (
  sjisArray: number[],
  index: number,
  range: {
    first: [number, number];
    second: [number, number][];
  },
): number => {
  const byte = sjisArray[index];
  const [firstMin, firstMax] = range.first;

  if (byte >= firstMin && byte <= firstMax) {
    // 2バイト文字の1バイト目
    if (index + 1 >= sjisArray.length) {
      return -1;
    }
    const nextByte = sjisArray[index + 1];
    for (const [secMin, secMax] of range.second) {
      if (nextByte >= secMin && nextByte <= secMax) {
        return index + 2; // 有効な2バイト文字、次のインデックスを返す
      }
    }
    return -1; // 無効な2バイト目
  }

  return index; // この範囲ではない、変更なし
};

/**
 * テキストがQRコード漢字モード（Shift_JIS2バイト文字のみ）と互換性があるかチェックする
 * 漢字モードは以下の範囲の2バイト文字のみをサポート:
 * - 0x8140-0x9FFC
 * - 0xE040-0xEBBF
 * @param text - チェックするテキスト
 * @returns 漢字モードと互換性がある場合はtrue
 */
export const isKanjiModeCompatible = (text: string): boolean => {
  const unicodeCodes = Encoding.stringToCode(text);
  const sjisCodes = Encoding.convert(unicodeCodes, {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  });
  const sjisArray = Array.isArray(sjisCodes)
    ? sjisCodes
    : Array.from(sjisCodes);

  let i = 0;
  while (i < sjisArray.length) {
    // 0x8140-0x9FFC範囲をチェック
    let next = validateSJISDoubleByteAt(sjisArray, i, {
      first: [0x81, 0x9f],
      second: [
        [0x40, 0x7e],
        [0x80, 0xfc],
      ],
    });
    if (next === -1) {
      return false;
    }
    if (next > i) {
      i = next;
      continue;
    }

    // 0xE040-0xEBBF範囲をチェック
    next = validateSJISDoubleByteAt(sjisArray, i, {
      first: [0xe0, 0xeb],
      second: [
        [0x40, 0x7e],
        [0x80, 0xbf],
      ],
    });
    if (next === -1) {
      return false;
    }
    if (next > i) {
      i = next;
      continue;
    }

    // 1バイト文字またはサポート外の範囲 - 漢字モード非互換
    return false;
  }

  if (sjisArray.length === 0) {
    return false;
  }

  // 最終検証: @nuintun/qrcodeが受け入れることを確認するため漢字セグメントを作成してみる
  try {
    new Kanji(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * テキストがShift_JISエンコーディングと互換性があるかチェックする
 * ASCII（0x00-0x7F）、半角カタカナ（0xA1-0xDF）、2バイト文字（0x8140-0x9FFC, 0xE040-0xEFFC）をサポート
 * @param text - チェックするテキスト
 * @returns Shift_JISと互換性がある場合はtrue
 */
export const isShiftJISCompatible = (text: string): boolean => {
  const unicodeCodes = Encoding.stringToCode(text);
  const sjisCodes = Encoding.convert(unicodeCodes, {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  });
  const sjisArray = Array.isArray(sjisCodes)
    ? sjisCodes
    : Array.from(sjisCodes);

  let i = 0;
  while (i < sjisArray.length) {
    const byte = sjisArray[i];

    // ASCII範囲 (0x00-0x7F)
    if (byte <= 0x7f) {
      i += 1;
      continue;
    }

    // 半角カタカナ (0xA1-0xDF)
    if (byte >= 0xa1 && byte <= 0xdf) {
      i += 1;
      continue;
    }

    // 0x8140-0x9FFC範囲をチェック
    let next = validateSJISDoubleByteAt(sjisArray, i, {
      first: [0x81, 0x9f],
      second: [
        [0x40, 0x7e],
        [0x80, 0xfc],
      ],
    });
    if (next === -1) {
      return false;
    }
    if (next > i) {
      i = next;
      continue;
    }

    // 0xE040-0xEFFC範囲をチェック
    next = validateSJISDoubleByteAt(sjisArray, i, {
      first: [0xe0, 0xef],
      second: [
        [0x40, 0x7e],
        [0x80, 0xfc],
      ],
    });
    if (next === -1) {
      return false;
    }
    if (next > i) {
      i = next;
      continue;
    }

    // サポート外の文字
    return false;
  }

  return sjisArray.length > 0;
};

/**
 * テキストを漢字セグメントとバイトセグメントに分割する（ミックスモードQRコードエンコード用）
 * Shift_JIS互換の文字列を効率的にエンコードするため、連続する漢字文字は漢字セグメント、
 * それ以外（ASCII、半角カタカナ）はバイトセグメントとしてグループ化する
 * @param text - 分割するテキスト
 * @returns 漢字セグメントとバイトセグメントの配列。Shift_JIS非互換文字が含まれる場合は全体を1つのバイトセグメントとして返す
 */
export const segmentText = (text: string) => {
  const segments: (Kanji | Byte)[] = [];
  let currentSegment = "";
  let isKanjiSegment = false;

  for (const char of text) {
    const isKanjiChar = isKanjiModeCompatible(char);
    const isSJISChar = isShiftJISCompatible(char);

    // 文字がShift_JIS互換でない場合、テキスト全体をバイトとしてエンコード
    if (!isSJISChar) {
      return [new Byte(text)];
    }

    if (currentSegment === "") {
      // 新しいセグメントを開始
      currentSegment = char;
      isKanjiSegment = isKanjiChar;
    } else if (isKanjiChar === isKanjiSegment) {
      // 現在のセグメントを継続
      currentSegment += char;
    } else {
      // 現在のセグメントをフラッシュして新しいセグメントを開始
      if (isKanjiSegment) {
        segments.push(new Kanji(currentSegment));
      } else {
        segments.push(new Byte(currentSegment, Charset.SHIFT_JIS));
      }
      currentSegment = char;
      isKanjiSegment = isKanjiChar;
    }
  }

  // 残りのセグメントをフラッシュ
  if (currentSegment !== "") {
    if (isKanjiSegment) {
      segments.push(new Kanji(currentSegment));
    } else {
      segments.push(new Byte(currentSegment, Charset.SHIFT_JIS));
    }
  }

  return segments;
};

/**
 * コンテンツをShift_JISバイト列としてエンコードする
 * @nuintun/qrcodeライブラリのカスタムエンコーダとして使用される
 * @param content - エンコードするテキスト
 * @param charset - 文字セット（Shift_JISの場合のみShift_JISエンコードを使用）
 * @returns エンコードされたバイト配列
 */
export const shiftJISByteEncoder = (
  content: string,
  charset: Charset,
): Uint8Array => {
  // リクエストされた文字セットがShift_JISかチェック
  if (charset.label === "Shift_JIS") {
    const unicodeCodes = Encoding.stringToCode(content);
    const sjisCodes = Encoding.convert(unicodeCodes, {
      from: "UNICODE",
      to: "SJIS",
      type: "array",
    });
    const sjisArray = Array.isArray(sjisCodes)
      ? sjisCodes
      : Array.from(sjisCodes);
    return new Uint8Array(sjisArray);
  }

  // デフォルトエンコーディングにフォールバック
  return new TextEncoder().encode(content);
};
