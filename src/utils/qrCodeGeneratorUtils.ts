import { Byte, Charset, Encoder, Kanji } from "@nuintun/qrcode";
import Encoding from "encoding-japanese";

type QRCodeResult = {
  matrix: number[][];
  size: number;
};

const isKanjiModeCompatible = (text: string): boolean => {
  const unicodeCodes = Encoding.stringToCode(text);
  const sjisCodes = Encoding.convert(unicodeCodes, {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  });
  const sjisArray = Array.isArray(sjisCodes)
    ? sjisCodes
    : Array.from(sjisCodes);

  for (let i = 0; i < sjisArray.length; i += 1) {
    const byte = sjisArray[i];

    // Shift_JIS 2-byte character range check
    if (byte >= 0x81 && byte <= 0x9f) {
      // First byte of 2-byte character (0x8140-0x9FFC)
      if (i + 1 >= sjisArray.length) {
        return false;
      }
      const nextByte = sjisArray[i + 1];
      if (
        (nextByte >= 0x40 && nextByte <= 0x7e) ||
        (nextByte >= 0x80 && nextByte <= 0xfc)
      ) {
        i += 1; // Skip next byte
        continue;
      }
      return false;
    }
    if (byte >= 0xe0 && byte <= 0xeb) {
      // First byte of 2-byte character (0xE040-0xEBBF)
      if (i + 1 >= sjisArray.length) {
        return false;
      }
      const nextByte = sjisArray[i + 1];
      if (
        (nextByte >= 0x40 && nextByte <= 0x7e) ||
        (nextByte >= 0x80 && nextByte <= 0xbf)
      ) {
        i += 1; // Skip next byte
        continue;
      }
      return false;
    }
    // 1-byte character or unsupported range - not compatible with Kanji mode
    return false;
  }

  if (sjisArray.length === 0) {
    return false;
  }

  // Final validation: try to create a Kanji segment to ensure @nuintun/qrcode accepts it
  try {
    new Kanji(text);
    return true;
  } catch {
    return false;
  }
};

const isShiftJISCompatible = (text: string): boolean => {
  const unicodeCodes = Encoding.stringToCode(text);
  const sjisCodes = Encoding.convert(unicodeCodes, {
    from: "UNICODE",
    to: "SJIS",
    type: "array",
  });
  const sjisArray = Array.isArray(sjisCodes)
    ? sjisCodes
    : Array.from(sjisCodes);

  for (let i = 0; i < sjisArray.length; i += 1) {
    const byte = sjisArray[i];

    // ASCII range (0x00-0x7F)
    if (byte <= 0x7f) {
      continue;
    }

    // Half-width katakana (0xA1-0xDF)
    if (byte >= 0xa1 && byte <= 0xdf) {
      continue;
    }

    // Shift_JIS 2-byte character range
    if (byte >= 0x81 && byte <= 0x9f) {
      // First byte of 2-byte character (0x8140-0x9FFC)
      if (i + 1 >= sjisArray.length) {
        return false;
      }
      const nextByte = sjisArray[i + 1];
      if (
        (nextByte >= 0x40 && nextByte <= 0x7e) ||
        (nextByte >= 0x80 && nextByte <= 0xfc)
      ) {
        i += 1; // Skip next byte
        continue;
      }
      return false;
    }
    if (byte >= 0xe0 && byte <= 0xef) {
      // First byte of 2-byte character (0xE040-0xEFFC)
      if (i + 1 >= sjisArray.length) {
        return false;
      }
      const nextByte = sjisArray[i + 1];
      if (
        (nextByte >= 0x40 && nextByte <= 0x7e) ||
        (nextByte >= 0x80 && nextByte <= 0xfc)
      ) {
        i += 1; // Skip next byte
        continue;
      }
      return false;
    }

    // Unsupported character
    return false;
  }

  return sjisArray.length > 0;
};

const segmentText = (text: string) => {
  const segments: (Kanji | Byte)[] = [];
  let currentSegment = "";
  let isKanjiSegment = false;

  for (const char of text) {
    const isKanjiChar = isKanjiModeCompatible(char);
    const isSJISChar = isShiftJISCompatible(char);

    // If character is not Shift_JIS compatible, encode entire text as Byte
    if (!isSJISChar) {
      return [new Byte(text)];
    }

    if (currentSegment === "") {
      // Start new segment
      currentSegment = char;
      isKanjiSegment = isKanjiChar;
    } else if (isKanjiChar === isKanjiSegment) {
      // Continue current segment
      currentSegment += char;
    } else {
      // Flush current segment and start new one
      if (isKanjiSegment) {
        segments.push(new Kanji(currentSegment));
      } else {
        segments.push(new Byte(currentSegment, Charset.SHIFT_JIS));
      }
      currentSegment = char;
      isKanjiSegment = isKanjiChar;
    }
  }

  // Flush remaining segment
  if (currentSegment !== "") {
    if (isKanjiSegment) {
      segments.push(new Kanji(currentSegment));
    } else {
      segments.push(new Byte(currentSegment, Charset.SHIFT_JIS));
    }
  }

  return segments;
};

const customShiftJISEncoder = (
  content: string,
  charset: Charset,
): Uint8Array => {
  // Check if the requested charset is Shift_JIS
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

  // Fallback to default encoding
  return new TextEncoder().encode(content);
};

const encodeKanjiQRCode = (
  text: string,
  useMixedMode = false,
): QRCodeResult => {
  const encoder = new Encoder({
    level: "L",
    encode: customShiftJISEncoder,
  });

  if (useMixedMode) {
    // Check if text is pure Shift_JIS compatible
    const isFullySJIS = isShiftJISCompatible(text);

    if (isFullySJIS) {
      // Check if we can use pure Kanji mode or need mixed segments
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

      // Has non-Kanji Shift_JIS chars (like half-width katakana)
      // Use segmented encoding
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

    // Not Shift_JIS compatible, use plain Byte mode
    const qrcode = encoder.encode(new Byte(text));
    const size = qrcode.size;
    return {
      matrix: Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => qrcode.get(x, y)),
      ),
      size,
    };
  }

  // Pure Kanji mode: validate text
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

export { encodeKanjiQRCode, isKanjiModeCompatible };
