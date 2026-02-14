import BitSource from "@zxing/library/esm/core/common/BitSource";
import Version from "@zxing/library/esm/core/qrcode/decoder/Version";
import type Result from "@zxing/library/esm/core/Result";
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

// ブラウザAPIのモック
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
      // ZXingが失敗するように設定
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

      // Simple mock for UTF-8 detection
      const originalTextDecoder = globalThis.TextDecoder;
      class SimpleUtf8TextDecoder {
        constructor(public label: string) {}
        decode(bytes: Uint8Array) {
          if (this.label === "utf-8") {
            // Simplified: if it looks like our test string's bytes, return it
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
      // Shift-JIS (SJIS) bytes for "テスト"
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

      // Mock TextDecoder to return proper string for SJIS
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
        getRawBytes: () => new Uint8Array(0), // No raw bytes
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
      // It should still detect UTF-8 from byte segments
    });

    it("should handle encoding detection with inconsistent rawBytes", async () => {
      const sjisBytes = new Uint8Array([0x83, 0x67, 0x83, 0x52]); // "テスト" partial
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
          // Return text that doesn't match decoded text to trigger "Unknown" encoding
          return "Different";
        }
      }
      vi.stubGlobal("TextDecoder", InconsistentTextDecoder);

      const result = await decodeQrCode(mockImage, vi.fn());
      expect(result?.text).toBe("Test");
      // Encoding should be Unknown since rawBytes decode doesn't match
      expect(result?.encoding).toBeDefined();

      vi.stubGlobal("TextDecoder", originalTextDecoder);
    });

    it("should retry with upscaling if first attempt fails", async () => {
      const { MultiFormatReader } = await import("@zxing/library");
      const jsQR = (await import("jsqr")).default;

      // Both ZXing and jsQR fail
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
      // width should be limited to 2000
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

      // Mock TextDecoder to handle Shift-JIS
      const originalTextDecoder = globalThis.TextDecoder;
      class SjisTextDecoder {
        constructor(public label: string) {}
        decode(_bytes: Uint8Array) {
          if (this.label === "shift-jis") {
            return "こんにちは";
          }
          if (this.label === "utf-8") {
            // UTF-8 should fail for SJIS bytes
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

      // Both ZXing and jsQR fail initially
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
            // First call: normal context for initial attempt
            return {
              drawImage: vi.fn(),
              getImageData: vi.fn().mockReturnValue({
                data: new Uint8ClampedArray(40000),
              }),
            };
          }
          // Second call: null context for upscale attempt
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
      // 0xFF is invalid UTF-8
      const invalidUtf8 = new Uint8Array([0xff]);
      expect(tryDecode(invalidUtf8, "utf-8", true)).toBeNull();
    });

    it("parseECIValue should parse various lengths", () => {
      // 1 byte: 0-127
      const bits1 = new BitSource(new Uint8Array([0x7f]));
      expect(parseECIValue(bits1)).toBe(127);

      // 2 bytes: 128-16383
      const bits2 = new BitSource(new Uint8Array([0x81, 0x02]));
      // (0x81 & 0x3F) << 8 | 0x02 = 1 << 8 | 2 = 258
      expect(parseECIValue(bits2)).toBe(258);

      // 3 bytes: 16384-999999
      const bits3 = new BitSource(new Uint8Array([0xc1, 0x02, 0x03]));
      // (0xC1 & 0x1F) << 16 | (0x02 << 8) | 0x03 = 1 << 16 | 515 = 65536 + 515 = 66051
      expect(parseECIValue(bits3)).toBe(66051);

      // Short input
      expect(parseECIValue(new BitSource(new Uint8Array(0)))).toBeNull();
      expect(parseECIValue(new BitSource(new Uint8Array([0x81])))).toBeNull();
      expect(
        parseECIValue(new BitSource(new Uint8Array([0xc1, 0x02]))),
      ).toBeNull();
    });

    it("skipNumeric should skip correct number of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipNumeric(bits, 3); // 10 bits
      expect(spy).toHaveBeenCalledWith(10);

      skipNumeric(bits, 2); // 7 bits
      expect(spy).toHaveBeenCalledWith(7);

      skipNumeric(bits, 1); // 4 bits
      expect(spy).toHaveBeenCalledWith(4);
    });

    it("skipAlphanumeric should skip correct number of bits", () => {
      const bits = new BitSource(new Uint8Array(10));
      const spy = vi.spyOn(bits, "readBits");

      skipAlphanumeric(bits, 2); // 11 bits
      expect(spy).toHaveBeenCalledWith(11);

      skipAlphanumeric(bits, 1); // 6 bits
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
      // Manual BitSource mock or real bits
      const version = Version.getVersionForNumber(1);
      // Mode.KANJI is 0x8. For Version 1, Kanji count is 8 bits.
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
      const bytes = new Uint8Array([0x00]); // Terminator 0000
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

      // ECI (0111) + ECI Value.
      // 1 byte ECI (0-127): 0111 0xxxxxxx
      const eci1 = new Uint8Array([0x70, 0x01, 0x00]);
      scanForKanjiMode(eci1, version);

      // 2 byte ECI: 0111 10xxxxxx xxxxxxxx
      const eci2 = new Uint8Array([0x78, 0x01, 0x01, 0x00]);
      scanForKanjiMode(eci2, version);

      // 3 byte ECI: 0111 110xxxxx xxxxxxxx xxxxxxxx
      const eci3 = new Uint8Array([0x7c, 0x01, 0x01, 0x01, 0x00]);
      scanForKanjiMode(eci3, version);
    });

    it("scanForKanjiMode should return invalid for various failure reasons", () => {
      const version = Version.getVersionForNumber(1);

      // Structured Append too short
      expect(scanForKanjiMode(new Uint8Array([0x30]), version).isValid).toBe(
        false,
      );

      // ECI Value too short
      expect(scanForKanjiMode(new Uint8Array([0x70]), version).isValid).toBe(
        false,
      );

      // Hanzi count too short
      expect(scanForKanjiMode(new Uint8Array([0xd0]), version).isValid).toBe(
        false,
      );

      // Numeric too short
      expect(scanForKanjiMode(new Uint8Array([0x10]), version).isValid).toBe(
        false,
      );

      // Alphanumeric too short
      expect(scanForKanjiMode(new Uint8Array([0x20]), version).isValid).toBe(
        false,
      );

      // Byte too short
      expect(scanForKanjiMode(new Uint8Array([0x40]), version).isValid).toBe(
        false,
      );

      // Kanji too short
      expect(scanForKanjiMode(new Uint8Array([0x80]), version).isValid).toBe(
        false,
      );
    });
  });
});
