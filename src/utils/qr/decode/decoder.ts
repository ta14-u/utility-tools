import {
  BarcodeFormat,
  DecodeHintType,
  ResultMetadataType,
  RGBLuminanceSource,
} from "@zxing/library";
import BitMatrixParser from "@zxing/library/esm/core/qrcode/decoder/BitMatrixParser";
import DecodedBitStreamParser from "@zxing/library/esm/core/qrcode/decoder/DecodedBitStreamParser";
import Version from "@zxing/library/esm/core/qrcode/decoder/Version";
import Detector from "@zxing/library/esm/core/qrcode/detector/Detector";
import type { DataSegmentMode } from "../bitstream";
import { scanForKanjiMode } from "../bitstream";
import { detectEncoding, joinByteSegments } from "../encoding";
import type { DecodeResult, StatusHandler } from "../types";
import { decodeWithJsQR } from "./jsqr";
import { decodeWithZXing } from "./zxing";

/**
 * QRコードデコードを実行する内部関数
 * Canvas操作、輝度変換、ZXingデコード、エンコーディング検出、jsQRフォールバックを統括する
 * @param imageSource - デコードする画像ソース（HTMLImageElementまたはHTMLCanvasElement）
 * @param onStatus - ステータス更新コールバック
 * @param isRetry - リトライモード（アップスケール後の再試行）かどうか
 * @returns デコード結果、またはデコードに失敗した場合はnull
 */
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
    }
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(imageSource, 0, 0, width, height);

  onStatus(isRetry ? "Retrying with upscaled image..." : "Decoding QR code...");

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

    let scanResult: {
      hasKanji: boolean;
      modes: DataSegmentMode[];
      isValid: boolean;
    } | null = null;

    // ビットストリームからセグメントモードを取得（漢字・英数字・バイト等の判別に利用）
    if (rawBytes && rawBytes.length > 0) {
      try {
        const detectorResult = new Detector(bitmap.getBlackMatrix()).detect(
          hints,
        );
        const parser = new BitMatrixParser(detectorResult.getBits());
        const version = parser.readVersion();
        const ecLevel = parser
          .readFormatInformation()
          .getErrorCorrectionLevel();
        scanResult = scanForKanjiMode(rawBytes, version);
        const decodedFromRaw = DecodedBitStreamParser.decode(
          rawBytes,
          version,
          ecLevel,
          hints,
        ).getText();
        if (scanResult.isValid && scanResult.hasKanji) {
          if (decodedFromRaw === decoded) {
            encoding = "Shift-JIS (Kanji mode)";
          }
        }
      } catch {}

      // Detector 失敗等で scanResult が取れなかった場合、rawBytes のみでモード解析を試行（複数バージョンでフォールバック）
      if (scanResult === null && rawBytes && rawBytes.length > 0) {
        for (const v of [1, 10, 27]) {
          try {
            const fallbackScan = scanForKanjiMode(
              rawBytes,
              Version.getVersionForNumber(v),
            );
            if (fallbackScan.isValid) {
              scanResult = fallbackScan;
              break;
            }
          } catch {
            // 次のバージョンを試す
          }
        }
      }
    }

    // 漢字モードでない場合、セグメントモードに応じて表示用 encoding を設定
    if (encoding === "Unknown" && scanResult?.isValid && scanResult.modes) {
      const modes = scanResult.modes;
      if (modes.length === 1 && modes[0] === "ALPHANUMERIC") {
        encoding = "Alphanumeric mode";
      } else if (modes.length === 1 && modes[0] === "NUMERIC") {
        encoding = "Numeric mode";
      }
    }

    // 上記で決まらなかった場合、detectEncoding で UTF-8 / Shift-JIS を検出
    if (encoding === "Unknown" && rawBytes && rawBytes.length > 0) {
      encoding = detectEncoding(rawBytes, decoded);
    }

    if (encoding === "Unknown" && byteSegmentsBytes) {
      encoding = detectEncoding(byteSegmentsBytes, decoded);
    }

    // Byte モードのみの場合は「(Byte mode)」を付けて判別しやすくする（単一・複数セグメント両方）
    const isByteModeOnly =
      scanResult?.isValid &&
      scanResult.modes.length >= 1 &&
      scanResult.modes.every((m) => m === "BYTE");
    if (isByteModeOnly) {
      if (encoding === "UTF-8" || encoding === "Shift-JIS") {
        encoding = `${encoding} (Byte mode)`;
      } else if (encoding === "Unknown") {
        encoding = "Unknown (Byte mode)";
      }
    }

    // デコードは成功しているが encoding がまだ Unknown の場合は、Byte モードとみなして表示する（多くのテキストQRは Byte モード）
    if (
      encoding === "Unknown" &&
      decoded.length > 0 &&
      rawBytes &&
      rawBytes.length > 0
    ) {
      encoding = "Unknown (Byte mode)";
    }

    if (decoded === "" && rawBytes && rawBytes.length > 0) {
      const binary = rawBytes;
      try {
        const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(binary);
        if (utf8.length > 0) {
          decoded = utf8;
          encoding = "UTF-8";
        }
      } catch {
        try {
          const sjis = new TextDecoder("shift-jis", { fatal: true }).decode(
            binary,
          );
          if (sjis.length > 0) {
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

/**
 * 画像からQRコードをデコードする（メインエントリーポイント）
 * ZXingとjsQRの両方を使用し、低解像度画像の場合は自動的にアップスケールして再試行する
 * エンコーディング検出により、UTF-8、Shift-JIS、Shift-JIS漢字モード、バイナリデータを自動判別する
 * @param image - QRコードを含む画像要素
 * @param onStatus - ステータス更新のコールバック関数
 * @returns デコード結果、またはデコードに失敗した場合はnull
 */
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
