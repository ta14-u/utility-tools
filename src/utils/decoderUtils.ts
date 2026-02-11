import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  InvertedLuminanceSource,
  MultiFormatReader,
  ResultMetadataType,
  RGBLuminanceSource,
} from "@zxing/library";
import BitSource from "@zxing/library/esm/core/common/BitSource";
import BitMatrixParser from "@zxing/library/esm/core/qrcode/decoder/BitMatrixParser";
import DecodedBitStreamParser from "@zxing/library/esm/core/qrcode/decoder/DecodedBitStreamParser";
import Mode from "@zxing/library/esm/core/qrcode/decoder/Mode";
import Detector from "@zxing/library/esm/core/qrcode/detector/Detector";
import jsQR from "jsqr";

type DecodeResult = { text: string; encoding: string };
type StatusHandler = (status: string) => void;

const joinByteSegments = (segments: Uint8Array[]) => {
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const joined = new Uint8Array(totalLength);
  let offset = 0;
  for (const segment of segments) {
    joined.set(segment, offset);
    offset += segment.length;
  }
  return joined;
};

const tryDecode = (
  bytes: Uint8Array | null,
  label: string,
  fatal: boolean,
) => {
  if (!bytes || bytes.length === 0) {
    return null;
  }
  try {
    return new TextDecoder(label, { fatal }).decode(bytes);
  } catch {
    return null;
  }
};

const dumpHex = (bytes: Uint8Array | null, limit = 128) => {
  if (!bytes || bytes.length === 0) {
    return null;
  }
  const max = Math.min(bytes.length, limit);
  const hex = Array.from(bytes.slice(0, max))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join(" ");
  if (bytes.length > limit) {
    return `${hex} ...(+${bytes.length - limit} bytes)`;
  }
  return hex;
};

const dumpCodePoints = (value: string, limit = 128) => {
  const codePoints = Array.from(value).map((char) =>
    char.codePointAt(0)?.toString(16).padStart(4, "0"),
  );
  if (codePoints.length > limit) {
    return `${codePoints.slice(0, limit).join(" ")} ...(+${codePoints.length - limit} chars)`;
  }
  return codePoints.join(" ");
};

const parseECIValue = (bits: BitSource) => {
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

const skipNumeric = (bits: BitSource, count: number) => {
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

const skipAlphanumeric = (bits: BitSource, count: number) => {
  while (count > 1) {
    bits.readBits(11);
    count -= 2;
  }
  if (count === 1) {
    bits.readBits(6);
  }
};

const skipBits = (bits: BitSource, totalBits: number) => {
  let remaining = totalBits;
  while (remaining > 0) {
    const toRead = Math.min(32, remaining);
    bits.readBits(toRead);
    remaining -= toRead;
  }
};

const scanForKanjiMode = (bytes: Uint8Array, version: any) => {
  const bits = new BitSource(bytes);
  let hasKanji = false;
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
      if (mode === Mode.FNC1_FIRST_POSITION || mode === Mode.FNC1_SECOND_POSITION) {
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
        skipNumeric(bits, count);
      } else if (mode === Mode.ALPHANUMERIC) {
        skipAlphanumeric(bits, count);
      } else if (mode === Mode.BYTE) {
        const totalBits = 8 * count;
        if (bits.available() < totalBits) {
          isValid = false;
          failureReason = "byte data";
          break;
        }
        skipBits(bits, totalBits);
      } else if (mode === Mode.KANJI) {
        hasKanji = true;
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
  } catch (err) {
    isValid = false;
    failureReason = "exception";
    console.log(
      "DEBUG: ZXing kanji scan exception:",
      err,
      "byteOffset:",
      bits.getByteOffset(),
      "bitOffset:",
      bits.getBitOffset(),
    );
  }
  return { hasKanji, isValid, failureReason };
};

const decodeWithZXing = (
  luminanceSource: RGBLuminanceSource,
  hints: Map<DecodeHintType, unknown>,
) => {
  const zxingReader = new MultiFormatReader();
  zxingReader.setHints(hints);

  const zxingDecode = (
    source: RGBLuminanceSource | InvertedLuminanceSource,
    label: string,
  ) => {
    console.log(`DEBUG: Attempting ZXing decode (${label})`);
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

  let zxingResult = zxingDecode(luminanceSource, "Normal");
  if (!zxingResult) {
    console.log("DEBUG: Normal ZXing failed, trying inverted");
    const invertedSource = new InvertedLuminanceSource(luminanceSource);
    zxingResult = zxingDecode(invertedSource, "Inverted");
  }

  return zxingResult;
};

const decodeWithJsQR = (rgba: Uint8ClampedArray, width: number, height: number) => {
  console.log("DEBUG: ZXing failed, trying jsQR");
  const code = jsQR(rgba, width, height, {
    inversionAttempts: "attemptBoth",
  });

  if (code) {
    console.log(
      "DEBUG: jsQR success, data length:",
      code.data.length,
      "binary length:",
      code.binaryData.length,
    );
    if (code.data === "" && code.binaryData.length > 0) {
      const binary = new Uint8Array(code.binaryData);
      try {
        const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(binary);
        if (utf8.length > 0) {
          console.log("DEBUG: jsQR manual UTF-8 success");
          return { text: utf8, encoding: "UTF-8" };
        }
      } catch {
        try {
          const sjis = new TextDecoder("shift-jis", { fatal: true }).decode(
            binary,
          );
          if (sjis.length > 0) {
            console.log("DEBUG: jsQR manual Shift-JIS success");
            return { text: sjis, encoding: "Shift-JIS" };
          }
        } catch {
          // Fail to decode as text
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

const performDecode = async (
  imageSource: HTMLImageElement | HTMLCanvasElement,
  onStatus: StatusHandler,
  isRetry = false,
): Promise<DecodeResult | null> => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Could not create canvas context");
  }

  let width = imageSource.width;
  let height = imageSource.height;

  if (!isRetry) {
    const MAX_DIMENSION = 2000;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.floor(width * ratio);
      height = Math.floor(height * ratio);
      console.log("DEBUG: Image resized to", width, "x", height);
    }
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(imageSource, 0, 0, width, height);

  console.log(
    `DEBUG: Starting decode process (retry: ${isRetry}, size: ${width}x${height})`,
  );
  onStatus(
    isRetry ? "Retrying with upscaled image..." : "Decoding QR code...",
  );

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const imageData = context.getImageData(0, 0, width, height);
  const rgba = imageData.data;
  const luminances = new Uint8ClampedArray(width * height);

  for (let i = 0; i < luminances.length; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    luminances[i] = (r * 76 + g * 150 + b * 29) >> 8;
  }

  const luminanceSource = new RGBLuminanceSource(luminances, width, height);
  const zxingResult = decodeWithZXing(luminanceSource, hints);

  if (zxingResult) {
    const { result, bitmap } = zxingResult;
    let decoded = result.getText();
    let encoding = "Unknown";
    const rawBytes = result.getRawBytes();
    const metadata = result.getResultMetadata?.();
    const byteSegments = metadata?.get?.(ResultMetadataType.BYTE_SEGMENTS);
    const byteSegmentsBytes = Array.isArray(byteSegments)
      ? joinByteSegments(byteSegments)
      : null;

    console.log(
      "DEBUG: ZXing rawBytes length:",
      rawBytes ? rawBytes.length : null,
      "metadata:",
      metadata ?? null,
      "byteSegments:",
      Array.isArray(byteSegments) ? byteSegments.map((segment) => segment.length) : null,
    );
    console.log(
      "DEBUG: ZXing metadata entries:",
      metadata ? Array.from(metadata.entries()) : null,
    );
    console.log("DEBUG: ZXing decoded code points:", dumpCodePoints(decoded));
    console.log("DEBUG: ZXing rawBytes hex:", dumpHex(rawBytes));
    console.log("DEBUG: ZXing byteSegments hex:", dumpHex(byteSegmentsBytes));

    if (rawBytes && rawBytes.length > 0) {
      const utf8 = tryDecode(rawBytes, "utf-8", true);
      console.log(
        "DEBUG: ZXing rawBytes utf-8 match:",
        utf8 !== null && utf8 === decoded,
        "decoded length:",
        decoded.length,
      );
      if (utf8 !== null && utf8 === decoded) {
        encoding = "UTF-8";
      } else {
        const sjis = tryDecode(rawBytes, "shift-jis", true);
        console.log(
          "DEBUG: ZXing rawBytes shift-jis match:",
          sjis !== null && sjis === decoded,
        );
        if (sjis !== null && sjis === decoded) {
          encoding = "Shift-JIS";
        }
      }
    }

    if (encoding === "Unknown" && byteSegmentsBytes) {
      const utf8 = tryDecode(byteSegmentsBytes, "utf-8", true);
      console.log(
        "DEBUG: ZXing byteSegments utf-8 match:",
        utf8 !== null && utf8 === decoded,
      );
      if (utf8 !== null && utf8 === decoded) {
        encoding = "UTF-8";
      } else {
        const sjis = tryDecode(byteSegmentsBytes, "shift-jis", true);
        console.log(
          "DEBUG: ZXing byteSegments shift-jis match:",
          sjis !== null && sjis === decoded,
        );
        if (sjis !== null && sjis === decoded) {
          encoding = "Shift-JIS";
        }
      }
    }

    if (encoding === "Unknown" && rawBytes && rawBytes.length > 0) {
      try {
        const detectorResult = new Detector(bitmap.getBlackMatrix()).detect(hints);
        const parser = new BitMatrixParser(detectorResult.getBits());
        const version = parser.readVersion();
        const ecLevel = parser.readFormatInformation().getErrorCorrectionLevel();
        const scanResult = scanForKanjiMode(rawBytes, version);
        const decodedFromRaw = DecodedBitStreamParser.decode(
          rawBytes,
          version,
          ecLevel,
          hints,
        ).getText();
        console.log(
          "DEBUG: ZXing kanji scan:",
          scanResult,
          "decodedFromRaw match:",
          decodedFromRaw === decoded,
        );
        if (scanResult.isValid && scanResult.hasKanji) {
          if (decodedFromRaw === decoded) {
            encoding = "Shift-JIS (Kanji mode)";
          }
        }
      } catch (err) {
        console.log("DEBUG: ZXing kanji parse failed:", err);
      }
    }

    console.log("DEBUG: ZXing success:", decoded, "Encoding:", encoding);

    if (decoded === "" && rawBytes && rawBytes.length > 0) {
      const binary = rawBytes;
      try {
        const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(binary);
        if (utf8.length > 0) {
          console.log("DEBUG: ZXing manual UTF-8 success");
          decoded = utf8;
          encoding = "UTF-8";
        }
      } catch {
        try {
          const sjis = new TextDecoder("shift-jis", { fatal: true }).decode(
            binary,
          );
          if (sjis.length > 0) {
            console.log("DEBUG: ZXing manual Shift-JIS success");
            decoded = sjis;
            encoding = "Shift-JIS";
          }
        } catch {
          encoding = "Binary";
        }
      }
    }

    return { text: decoded, encoding };
  }

  return decodeWithJsQR(rgba, width, height);
};

export const decodeQrCode = async (
  image: HTMLImageElement,
  onStatus: StatusHandler,
): Promise<DecodeResult | null> => {
  let finalResult = await performDecode(image, onStatus);
  const isPlaceholder =
    finalResult?.text.startsWith("[Decoded empty string") ?? false;

  if (
    (finalResult === null || isPlaceholder) &&
    image.width < 1000 &&
    image.height < 1000
  ) {
    console.log(
      `DEBUG: Initial decode result (${finalResult?.text}) unsatisfactory, trying upscale retry`,
    );
    const upscaleCanvas = document.createElement("canvas");
    upscaleCanvas.width = image.width * 2;
    upscaleCanvas.height = image.height * 2;
    const upscaleCtx = upscaleCanvas.getContext("2d");
    if (upscaleCtx) {
      upscaleCtx.imageSmoothingEnabled = true;
      upscaleCtx.imageSmoothingQuality = "high";
      upscaleCtx.drawImage(
        image,
        0,
        0,
        upscaleCanvas.width,
        upscaleCanvas.height,
      );
      const retryResult = await performDecode(upscaleCanvas, onStatus, true);
      console.log("DEBUG: Upscale retry result:", retryResult);
      if (retryResult !== null) {
        const isRetryPlaceholder = retryResult.text.startsWith(
          "[Decoded empty string",
        );
        if (!isRetryPlaceholder || isPlaceholder) {
          finalResult = retryResult;
        }
      }
    }
  }

  return finalResult;
};