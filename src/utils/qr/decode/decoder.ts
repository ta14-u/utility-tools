import {
  BarcodeFormat,
  DecodeHintType,
  ResultMetadataType,
  RGBLuminanceSource,
} from "@zxing/library";
import BitMatrixParser from "@zxing/library/esm/core/qrcode/decoder/BitMatrixParser";
import DecodedBitStreamParser from "@zxing/library/esm/core/qrcode/decoder/DecodedBitStreamParser";
import Detector from "@zxing/library/esm/core/qrcode/detector/Detector";
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

    // 最初に漢字モードをチェック（最優先）
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
        const scanResult = scanForKanjiMode(rawBytes, version);
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
    }

    // 漢字モードでない場合、統合されたdetectEncodingを使用してUTF-8とShift-JISを検出
    if (encoding === "Unknown" && rawBytes && rawBytes.length > 0) {
      encoding = detectEncoding(rawBytes, decoded);
    }

    if (encoding === "Unknown" && byteSegmentsBytes) {
      encoding = detectEncoding(byteSegmentsBytes, decoded);
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
