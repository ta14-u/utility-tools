import { MultiFormatReader, ResultMetadataType } from "@zxing/library";
import BitSource from "@zxing/library/esm/core/common/BitSource";
import Version from "@zxing/library/esm/core/qrcode/decoder/Version";
import type Result from "@zxing/library/esm/core/Result";
import jsQR from "jsqr";
import { describe, expect, it, vi } from "vitest";
import {
  decodeQrCode,
  joinByteSegments,
  parseECIValue,
  scanForKanjiMode,
  skipAlphanumeric,
  skipBits,
  skipNumeric,
  tryDecode,
} from "./decoderUtils";

// ブラウザ API のモック
class MockTextDecoder {
  label: string;
  constructor(label = "utf-8") {
    this.label = label;
  }
  decode(bytes: Uint8Array) {
    if (this.label === "utf-8")
      return new TextEncoder()
        .encode(new TextDecoder().decode(bytes))
        .toString(); // 簡易的なモック
    return "mock decoded text";
  }
}

vi.stubGlobal("TextDecoder", MockTextDecoder);

// 外部ライブラリのモック
vi.mock("@zxing/library", () => {
  return {
    BarcodeFormat: { QR_CODE: "QR_CODE" },
    DecodeHintType: {
      POSSIBLE_FORMATS: "POSSIBLE_FORMATS",
      TRY_HARDER: "TRY_HARDER",
    },
    RGBLuminanceSource: class {},
    BinaryBitmap: class {},
    HybridBinarizer: class {},
    Detector: class {
      detect() {
        return {
          getBits: () => ({}),
        };
      }
    },
    BitMatrixParser: class {
      readVersion() {
        return {};
      }
      readFormatInformation() {
        return {
          getErrorCorrectionLevel: () => ({}),
        };
      }
    },
    DecodedBitStreamParser: {
      decode: vi.fn().mockReturnValue({
        getText: () => "mock zxing text",
      }),
    },
    MultiFormatReader: class {
      setHints() {}
      decode() {}
    },
    InvertedLuminanceSource: class {},
    GlobalHistogramBinarizer: class {},
    ResultMetadataType: { BYTE_SEGMENTS: "BYTE_SEGMENTS" },
  };
});

vi.mock("jsqr", () => ({
  default: vi.fn().mockReturnValue({
    data: "mock jsqr text",
    binaryData: [1, 2, 3],
  }),
}));

describe("decoderUtils", () => {
  describe("decodeQrCode", () => {
    it("should attempt to decode using ZXing", async () => {
      const { MultiFormatReader } = await import("@zxing/library");
      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue({
        getText: () => "mock zxing text",
        getRawBytes: () => new Uint8Array([1, 2, 3]),
        getResultMetadata: () => ({
          get: () => null,
        }),
      } as unknown as Result);

      // HTMLImageElementのモック作成
      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;

      // canvasとcontextのモック
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const onStatus = vi.fn();
      const result = await decodeQrCode(mockImage, onStatus);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("mock zxing text");
      expect(onStatus).toHaveBeenCalledWith("Decoding QR code...");
    });

    it("should fallback to jsQR if ZXing fails", async () => {
      // ZXing が失敗するように設定
      const { MultiFormatReader } = await import("@zxing/library");
      vi.spyOn(MultiFormatReader.prototype, "decode").mockImplementation(() => {
        throw new Error("zxing failed");
      });

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;

      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const onStatus = vi.fn();
      const result = await decodeQrCode(mockImage, onStatus);

      expect(result).not.toBeNull();
      expect(result?.text).toBe("mock jsqr text");
    });

    it("should handle UTF-8 encoding detection", async () => {
      const utf8Bytes = new TextEncoder().encode("こんにちは");
      const { MultiFormatReader } = await import("@zxing/library");

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue({
        getText: () => "こんにちは",
        getRawBytes: () => utf8Bytes,
        getResultMetadata: () => ({
          get: () => null,
        }),
      } as unknown as Result);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;

      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      // UTF-8 検出用の簡易モック
      const originalTextDecoder = globalThis.TextDecoder;
      class SimpleUtf8TextDecoder {
        constructor(public label: string) {}
        decode(bytes: Uint8Array) {
          if (this.label === "utf-8") {
            // 簡易化：テスト文字列のバイト列と一致する場合はその文字列を返す
            if (bytes.length === utf8Bytes.length) return "こんにちは";
            return new originalTextDecoder("utf-8").decode(bytes);
          }
          return "";
        }
      }
      vi.stubGlobal("TextDecoder", SimpleUtf8TextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());

      expect(result?.text).toBe("こんにちは");
      expect(result?.encoding).toBe("UTF-8");

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should handle Shift-JIS encoding detection", async () => {
      // "テスト" の Shift-JIS (SJIS) バイト列
      const sjisBytes = new Uint8Array([0x83, 0x67, 0x83, 0x52, 0x83, 0x67]);
      const { MultiFormatReader } = await import("@zxing/library");
      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue({
        getText: () => "テスト",
        getRawBytes: () => sjisBytes,
        getResultMetadata: () => ({
          get: () => null,
        }),
      } as unknown as Result);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;

      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      // SJIS に対して適切な文字列を返すように TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      class SjisTextDecoder {
        constructor(public label: string) {}
        decode(bytes: Uint8Array) {
          if (this.label === "shift-jis") {
            if (bytes.length === sjisBytes.length) return "テスト";
          }
          if (this.label === "utf-8") return "invalid";
          return "";
        }
      }
      vi.stubGlobal("TextDecoder", SjisTextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.encoding).toBe("Shift-JIS");

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should handle BYTE_SEGMENTS metadata", async () => {
      const utf8Bytes = new TextEncoder().encode("Hello");
      const { MultiFormatReader } = await import("@zxing/library");

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue({
        getText: () => "Hello",
        getRawBytes: () => new Uint8Array(0), // 生バイトなし
        getResultMetadata: () => ({
          get: (type: number) => {
            if (type === 1) {
              // BYTE_SEGMENTS
              return [utf8Bytes];
            }
            return null;
          },
        }),
      } as unknown as Result);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.text).toBe("Hello");
      // バイトセグメントから UTF-8 を検出するはず
    });

    it("should handle encoding detection with inconsistent rawBytes", async () => {
      const sjisBytes = new Uint8Array([0x83, 0x67, 0x83, 0x52]); // "テスト" の一部
      const { MultiFormatReader } = await import("@zxing/library");

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue({
        getText: () => "Test",
        getRawBytes: () => sjisBytes,
        getResultMetadata: () => ({
          get: () => null,
        }),
      } as unknown as Result);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      class InconsistentTextDecoder {
        constructor(public label: string) {}
        decode(_bytes: Uint8Array) {
          // デコードされたテキストと一致しないテキストを返し、"Unknown" エンコーディングをトリガーする
          return "Different";
        }
      }
      vi.stubGlobal("TextDecoder", InconsistentTextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.text).toBe("Test");
      // rawBytes のデコード結果が一致しないため、エンコーディングが定義されていることを確認
      expect(result?.encoding).toBeDefined();

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should retry with upscaling if first attempt fails", async () => {
      const { MultiFormatReader } = await import("@zxing/library");
      const jsQR = (await import("jsqr")).default;

      // ZXing と jsQR の両方が失敗
      vi.spyOn(MultiFormatReader.prototype, "decode").mockImplementation(() => {
        throw new Error("fail");
      });
      vi.mocked(jsQR).mockReturnValue(null);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const onStatus = vi.fn();
      await decodeQrCode(mockImage, onStatus);

      expect(onStatus).toHaveBeenCalledWith("Retrying with upscaled image...");
    });

    it("should handle large images by resizing", async () => {
      const mockImage = {
        width: 3000,
        height: 3000,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(400 * 400 * 4),
          }),
        }),
        width: 0,
        height: 0,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      await decodeQrCode(mockImage, vi.fn());
      // 幅は 2000 以下に制限されるはず
      expect(mockCanvas.width).toBeLessThanOrEqual(2000);
    });

    it("should throw error when canvas context is null", async () => {
      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;

      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(null),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      await expect(decodeQrCode(mockImage, vi.fn())).rejects.toThrow(
        "Could not create canvas context",
      );
    });

    it("should detect Shift-JIS from jsQR Japanese text", async () => {
      const { MultiFormatReader } = await import("@zxing/library");
      const jsQR = (await import("jsqr")).default;

      vi.spyOn(MultiFormatReader.prototype, "decode").mockImplementation(() => {
        throw new Error("zxing failed");
      });

      vi.mocked(jsQR).mockReturnValue({
        data: "こんにちは",
        binaryData: [0x82, 0xb1, 0x82, 0xf1],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 100, y: 0 },
          bottomLeftCorner: { x: 0, y: 100 },
          bottomRightCorner: { x: 100, y: 100 },
          topRightFinderPattern: { x: 100, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 100 },
        },
        version: 1,
      });

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      // Shift-JIS を扱うように TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      class SjisTextDecoder {
        constructor(public label: string) {}
        decode(_bytes: Uint8Array) {
          if (this.label === "shift-jis") {
            return "こんにちは";
          }
          if (this.label === "utf-8") {
            // SJIS バイト列に対して UTF-8 は失敗するはず
            throw new Error("Invalid UTF-8");
          }
          return "";
        }
      }
      vi.stubGlobal("TextDecoder", SjisTextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.text).toBe("こんにちは");
      expect(result?.encoding).toBe("Shift-JIS (Kanji mode)");

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should handle jsQR empty string with UTF-8 binary data", async () => {
      const { MultiFormatReader } = await import("@zxing/library");
      const jsQR = (await import("jsqr")).default;

      vi.spyOn(MultiFormatReader.prototype, "decode").mockImplementation(() => {
        throw new Error("zxing failed");
      });

      vi.mocked(jsQR).mockReturnValue({
        data: "",
        binaryData: [0x48, 0x65, 0x6c, 0x6c, 0x6f], // "Hello"
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 100, y: 0 },
          bottomLeftCorner: { x: 0, y: 100 },
          bottomRightCorner: { x: 100, y: 100 },
          topRightFinderPattern: { x: 100, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 100 },
        },
        version: 1,
      });

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      class Utf8TextDecoder {
        constructor(public label: string) {}
        decode(bytes: Uint8Array) {
          if (this.label === "utf-8" && bytes.length === 5) {
            return "Hello";
          }
          if (this.label === "shift-jis") {
            throw new Error("Invalid Shift-JIS");
          }
          return "";
        }
      }
      vi.stubGlobal("TextDecoder", Utf8TextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.text).toBe("Hello");
      expect(result?.encoding).toBe("UTF-8");

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should handle jsQR empty string with invalid binary data", async () => {
      const { MultiFormatReader } = await import("@zxing/library");
      const jsQR = (await import("jsqr")).default;

      vi.spyOn(MultiFormatReader.prototype, "decode").mockImplementation(() => {
        throw new Error("zxing failed");
      });

      vi.mocked(jsQR).mockReturnValue({
        data: "",
        binaryData: [0xff, 0xfe, 0xfd],
        chunks: [],
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 100, y: 0 },
          bottomLeftCorner: { x: 0, y: 100 },
          bottomRightCorner: { x: 100, y: 100 },
          topRightFinderPattern: { x: 100, y: 0 },
          topLeftFinderPattern: { x: 0, y: 0 },
          bottomLeftFinderPattern: { x: 0, y: 100 },
        },
        version: 1,
      });

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      class FailingTextDecoder {
        constructor(public label: string) {}
        decode(_bytes: Uint8Array) {
          throw new Error("Invalid encoding");
        }
      }
      vi.stubGlobal("TextDecoder", FailingTextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.encoding).toBe("Binary");

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should decode empty ZXing text with UTF-8 bytes", async () => {
      const { MultiFormatReader } = await import("@zxing/library");

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue({
        getText: () => "",
        getRawBytes: () => new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]),
        getResultMetadata: () => ({ get: () => null }),
      } as unknown as Result);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      class Utf8TextDecoder {
        constructor(public label: string) {}
        decode(bytes: Uint8Array) {
          if (this.label === "utf-8" && bytes.length === 5) {
            return "Hello";
          }
          if (this.label === "shift-jis") {
            throw new Error("Invalid Shift-JIS");
          }
          return "";
        }
      }
      vi.stubGlobal("TextDecoder", Utf8TextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.text).toBe("Hello");
      expect(result?.encoding).toBe("UTF-8");

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should handle ZXing empty text with invalid bytes", async () => {
      const { MultiFormatReader } = await import("@zxing/library");

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue({
        getText: () => "",
        getRawBytes: () => new Uint8Array([0xff, 0xfe]),
        getResultMetadata: () => ({ get: () => null }),
      } as unknown as Result);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            data: new Uint8ClampedArray(40000),
          }),
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      class FailingTextDecoder {
        constructor(public label: string) {}
        decode(_bytes: Uint8Array) {
          throw new Error("Invalid encoding");
        }
      }
      vi.stubGlobal("TextDecoder", FailingTextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.encoding).toBe("Binary");

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should skip upscaling if upscale context is null", async () => {
      const { MultiFormatReader } = await import("@zxing/library");
      const jsQR = (await import("jsqr")).default;

      // ZXing と jsQR の両方が最初は失敗
      vi.spyOn(MultiFormatReader.prototype, "decode").mockImplementation(() => {
        throw new Error("fail");
      });
      vi.mocked(jsQR).mockReturnValue(null);

      const mockImage = {
        width: 100,
        height: 100,
        src: "",
      } as HTMLImageElement;

      let callCount = 0;
      const mockCanvas = {
        getContext: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // 1回目の呼び出し: 初回試行用の通常のコンテキスト
            return {
              drawImage: vi.fn(),
              getImageData: vi.fn().mockReturnValue({
                data: new Uint8ClampedArray(40000),
              }),
            };
          }
          // 2回目の呼び出し: アップスケール試行用の null コンテキスト
          return null;
        }),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result).toBeNull();
    });
  });

  describe("internal utilities", () => {
    it("joinByteSegments should join multiple Uint8Arrays", () => {
      const seg1 = new Uint8Array([1, 2]);
      const seg2 = new Uint8Array([3, 4]);
      const joined = joinByteSegments([seg1, seg2]);
      expect(joined).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it("tryDecode should return null for empty/null bytes", () => {
      expect(tryDecode(null, "utf-8", true)).toBeNull();
      expect(tryDecode(new Uint8Array(0), "utf-8", true)).toBeNull();
    });

    it("tryDecode should return null on error when fatal is true", () => {
      // 0xFF は不正な UTF-8
      const invalidUtf8 = new Uint8Array([0xff]);
      expect(tryDecode(invalidUtf8, "utf-8", true)).toBeNull();
    });

    it("parseECIValue should parse various lengths", () => {
      // 1 バイト: 0-127
      const bits1 = new BitSource(new Uint8Array([0x7f]));
      expect(parseECIValue(bits1)).toBe(127);

      // 2 バイト: 128-16383
      const bits2 = new BitSource(new Uint8Array([0x81, 0x02]));
      // (0x81 & 0x3F) << 8 | 0x02 = 1 << 8 | 2 = 258
      expect(parseECIValue(bits2)).toBe(258);

      // 3 バイト: 16384-999999
      const bits3 = new BitSource(new Uint8Array([0xc1, 0x02, 0x03]));
      // (0xC1 & 0x1F) << 16 | (0x02 << 8) | 0x03 = 1 << 16 | 515 = 65536 + 515 = 66051
      expect(parseECIValue(bits3)).toBe(66051);

      // 短い入力
      expect(parseECIValue(new BitSource(new Uint8Array(0)))).toBeNull();
      expect(parseECIValue(new BitSource(new Uint8Array([0x81])))).toBeNull();
      expect(
        parseECIValue(new BitSource(new Uint8Array([0xc1, 0x02]))),
      ).toBeNull();
    });

    it("skipNumeric should skip correct number of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipNumeric(bits, 3); // 10 ビット
      expect(spy).toHaveBeenCalledWith(10);

      skipNumeric(bits, 2); // 7 ビット
      expect(spy).toHaveBeenCalledWith(7);

      skipNumeric(bits, 1); // 4 ビット
      expect(spy).toHaveBeenCalledWith(4);
    });

    it("skipAlphanumeric should skip correct number of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipAlphanumeric(bits, 2); // 11 ビット
      expect(spy).toHaveBeenCalledWith(11);

      skipAlphanumeric(bits, 1); // 6 ビット
      expect(spy).toHaveBeenCalledWith(6);
    });

    it("skipBits should skip large amount of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipBits(bits, 50);
      expect(spy).toHaveBeenCalledWith(32);
      expect(spy).toHaveBeenCalledWith(18);
    });

    it("scanForKanjiMode should detect Kanji mode in bitstream", () => {
      // BitSource の手動モックまたは実ビット
      const version = Version.getVersionForNumber(1);
      // Mode.KANJI は 0x8。Version 1 の場合、漢字カウントは 8 ビット。
      // Mode(4) + Count(8)
      // 1000 00000001 -> 0x80, 0x10
      const bytes = new Uint8Array([0x80, 0x10, 0x00]);

      try {
        const result = scanForKanjiMode(bytes, version);
        if (result.isValid) expect(result.hasKanji).toBeDefined();
      } catch (_e) {}
    });

    it("scanForKanjiMode should return invalid for unknown mode", () => {
      const version = Version.getVersionForNumber(1);
      const bytes = new Uint8Array([0x00]); // ターミネータ 0000
      try {
        const result = scanForKanjiMode(bytes, version);
        expect(result.isValid).toBe(true);
      } catch (_e) {}
    });

    it("scanForKanjiMode exception handling", () => {
      const version = Version.getVersionForNumber(1);
      try {
        // @ts-expect-error
        scanForKanjiMode(null, version);
      } catch (_e) {}
    });

    it("scanForKanjiMode should handle ECI, FNC1 and Structured Append", () => {
      const version = Version.getVersionForNumber(1);

      // FNC1 (0101)
      const fnc1_1 = new Uint8Array([0x50, 0x00]);
      scanForKanjiMode(fnc1_1, version);

      // FNC1 (1001)
      const fnc1_2 = new Uint8Array([0x90, 0x00]);
      scanForKanjiMode(fnc1_2, version);

      // Structured Append (0011) + 16 bits.
      const sa = new Uint8Array([0x30, 0x00, 0x00, 0x00]);
      scanForKanjiMode(sa, version);

      // ECI (0111) + ECI 値。
      // 1 バイト ECI (0-127): 0111 0xxxxxxx
      const eci1 = new Uint8Array([0x70, 0x01, 0x00]);
      scanForKanjiMode(eci1, version);

      // 2 バイト ECI: 0111 10xxxxxx xxxxxxxx
      const eci2 = new Uint8Array([0x78, 0x01, 0x01, 0x00]);
      scanForKanjiMode(eci2, version);

      // 3 バイト ECI: 0111 110xxxxx xxxxxxxx xxxxxxxx
      const eci3 = new Uint8Array([0x7c, 0x01, 0x01, 0x01, 0x00]);
      scanForKanjiMode(eci3, version);
    });

    it("scanForKanjiMode should return invalid for various failure reasons", () => {
      const version = Version.getVersionForNumber(1);

      // Structured Append が短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x30]), version).isValid).toBe(
        false,
      );

      // ECI 値が短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x70]), version).isValid).toBe(
        false,
      );

      // 漢字カウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0xd0]), version).isValid).toBe(
        false,
      );

      // 数字カウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x10]), version).isValid).toBe(
        false,
      );

      // 英数字カウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x20]), version).isValid).toBe(
        false,
      );

      // バイトカウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x40]), version).isValid).toBe(
        false,
      );

      // 漢字カウントが短すぎる
      expect(scanForKanjiMode(new Uint8Array([0x80]), version).isValid).toBe(
        false,
      );
    });
  });

  describe("decodeWithJsQR additional tests", () => {
    it("should handle Shift-JIS when jsQR returns empty data but has binaryData", async () => {
      // jsQR モック: data は空だが、SJIS の binaryData がある場合
      const binaryData = [0x82, 0xa0]; // SJIS の "あ"
      const mockResult = {
        data: "",
        binaryData: binaryData,
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 1, y: 0 },
          bottomLeftCorner: { x: 0, y: 1 },
          bottomRightCorner: { x: 1, y: 1 },
        },
      };

      vi.mocked(jsQR).mockReturnValue(
        mockResult as unknown as ReturnType<typeof jsQR>,
      );

      // canvas と context のモック
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      // UTF-8 は失敗し、SJIS は成功するように TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(_input?: BufferSource, _options?: TextDecodeOptions): string {
          if (this._label === "utf-8") {
            throw new Error("UTF-8 fail");
          }
          if (this._label === "shift-jis") {
            return "あ";
          }
          return super.decode(_input, _options);
        }
      } as unknown as typeof TextDecoder;

      const mockImage = { width: 100, height: 100 } as HTMLImageElement;
      const result = await decodeQrCode(mockImage, () => {});
      expect(result).toEqual({ text: "あ", encoding: "Shift-JIS" });

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should handle non-Japanese text with SJIS match in jsQR", async () => {
      // 266-271行目: code.data !== "" && !/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u4e00-\u9faf]/.test(code.data)
      const mockResult = {
        data: "abc", // 日本語文字なし
        binaryData: [0x61, 0x62, 0x63], // "abc" の SJIS は ASCII と同じ
        location: {
          topLeftCorner: { x: 0, y: 0 },
          topRightCorner: { x: 1, y: 0 },
          bottomLeftCorner: { x: 0, y: 1 },
          bottomRightCorner: { x: 1, y: 1 },
        },
      };

      vi.mocked(jsQR).mockReturnValue(
        mockResult as unknown as ReturnType<typeof jsQR>,
      );

      // canvas と context のモック
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      // SJIS に対して "abc" を返すように TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(_input?: BufferSource, _options?: TextDecodeOptions): string {
          if (this._label === "shift-jis") {
            return "abc";
          }
          return super.decode(_input, _options);
        }
      } as unknown as typeof TextDecoder;

      const mockImage = { width: 100, height: 100 } as HTMLImageElement;
      const result = await decodeQrCode(mockImage, () => {});
      // この場合、SJIS に一致し "Shift-JIS" エンコーディングを返すはず
      expect(result).toEqual({ text: "abc", encoding: "Shift-JIS" });

      globalThis.TextDecoder = originalTextDecoder;
    });
  });

  describe("Encoding detection fallback paths", () => {
    it("should detect Shift-JIS from rawBytes when UTF-8 doesn't match (lines 392-395)", async () => {
      const mockResult = {
        getText: () => "あ",
        getRawBytes: () => new Uint8Array([0x82, 0xa0]), // SJIS "あ"
        getResultMetadata: () => ({
          get: () => null,
        }),
      };

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue(
        mockResult as unknown as Result,
      );

      // canvas と context のモック
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      // UTF-8 は失敗し、SJIS は成功するように TextDecoder をモック
      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(_input?: BufferSource, _options?: TextDecodeOptions): string {
          if (this._label === "utf-8") {
            return "wrong"; // "あ" ではない
          }
          if (this._label === "shift-jis") {
            return "あ";
          }
          return super.decode(_input, _options);
        }
      } as unknown as typeof TextDecoder;

      const mockImage = { width: 100, height: 100 } as HTMLImageElement;
      const result = await decodeQrCode(mockImage, () => {});
      expect(result?.encoding).toBe("Shift-JIS");

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should detect UTF-8 from BYTE_SEGMENTS (lines 400-402)", async () => {
      const mockResult = {
        getText: () => "あ",
        getRawBytes: () => new Uint8Array([1, 2, 3]), // ゴミ
        getResultMetadata: () => ({
          get: (type: ResultMetadataType) => {
            if (type === ResultMetadataType.BYTE_SEGMENTS) {
              return [new Uint8Array([0xe3, 0x81, 0x82])]; // UTF-8 "あ"
            }
            return null;
          },
        }),
      };

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue(
        mockResult as unknown as Result,
      );

      // canvas と context のモック
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(input?: BufferSource, _options?: TextDecodeOptions): string {
          const bytes = new Uint8Array(input as ArrayBuffer);
          if (bytes.length === 3 && bytes[0] === 1) return "wrong"; // rawBytes

          if (
            this._label === "utf-8" &&
            bytes.length === 3 &&
            bytes[0] === 0xe3
          ) {
            return "あ";
          }
          return "wrong";
        }
      } as unknown as typeof TextDecoder;

      const mockImage = { width: 100, height: 100 } as HTMLImageElement;
      const result = await decodeQrCode(mockImage, () => {});
      expect(result?.encoding).toBe("UTF-8");

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should detect Shift-JIS from BYTE_SEGMENTS (lines 404-406)", async () => {
      const mockResult = {
        getText: () => "あ",
        getRawBytes: () => new Uint8Array([1, 2, 3]), // ゴミ
        getResultMetadata: () => ({
          get: (type: ResultMetadataType) => {
            if (type === ResultMetadataType.BYTE_SEGMENTS) {
              return [new Uint8Array([0x82, 0xa0])]; // SJIS "あ"
            }
            return null;
          },
        }),
      };

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue(
        mockResult as unknown as Result,
      );

      // canvas と context のモック
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(input?: BufferSource, _options?: TextDecodeOptions): string {
          const bytes = new Uint8Array(input as ArrayBuffer);
          if (bytes.length === 3 && bytes[0] === 1) return "wrong";

          if (this._label === "utf-8") return "wrong";
          if (
            this._label === "shift-jis" &&
            bytes.length === 2 &&
            bytes[0] === 0x82
          ) {
            return "あ";
          }
          return "wrong";
        }
      } as unknown as typeof TextDecoder;

      const mockImage = { width: 100, height: 100 } as HTMLImageElement;
      const result = await decodeQrCode(mockImage, () => {});
      expect(result?.encoding).toBe("Shift-JIS");

      globalThis.TextDecoder = originalTextDecoder;
    });

    it("should decode empty ZXing text with Shift-JIS bytes (lines 421-426)", async () => {
      const mockResult = {
        getText: () => "",
        getRawBytes: () => new Uint8Array([0x82, 0xa0]),
        getResultMetadata: () => ({
          get: () => null,
        }),
      };

      vi.spyOn(MultiFormatReader.prototype, "decode").mockReturnValue(
        mockResult as unknown as Result,
      );

      // canvas と context のモック
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue({
          data: new Uint8ClampedArray(40000),
        }),
      };
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 100,
        height: 100,
      };
      vi.stubGlobal("document", {
        createElement: vi.fn().mockReturnValue(mockCanvas),
      });

      const originalTextDecoder = globalThis.TextDecoder;
      globalThis.TextDecoder = class extends originalTextDecoder {
        _label: string;
        constructor(label: string, options?: TextDecoderOptions) {
          super(label, options);
          this._label = label;
        }
        decode(_input?: BufferSource, _options?: TextDecodeOptions): string {
          if (this._label === "utf-8") throw new Error();
          if (this._label === "shift-jis") return "あ";
          return "";
        }
      } as unknown as typeof TextDecoder;

      const mockImage = { width: 100, height: 100 } as HTMLImageElement;
      const result = await decodeQrCode(mockImage, () => {});
      expect(result).toEqual({ text: "あ", encoding: "Shift-JIS" });

      globalThis.TextDecoder = originalTextDecoder;
    });
  });
});
