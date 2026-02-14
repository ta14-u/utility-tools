import { describe, expect, it, vi } from "vitest";
import { decodeQrCode } from "./decoderUtils";

// ブラウザAPIのモック
const MockTextDecoder = vi.fn().mockImplementation((label) => ({
  decode: (bytes: Uint8Array) => {
    if (label === "utf-8")
      return new TextEncoder()
        .encode(new TextDecoder().decode(bytes))
        .toString(); // 簡易的なモック
    return "mock decoded text";
  },
}));

vi.stubGlobal("TextDecoder", MockTextDecoder);

// 外部ライブラリのモック
vi.mock("@zxing/library", () => {
  const MultiFormatReader = vi.fn();
  MultiFormatReader.prototype.setHints = vi.fn();
  MultiFormatReader.prototype.decode = vi.fn().mockReturnValue({
    getText: () => "mock zxing text",
    getRawBytes: () => new Uint8Array([1, 2, 3]),
    getResultMetadata: () => ({
      get: () => null,
    }),
  });

  return {
    BarcodeFormat: { QR_CODE: "QR_CODE" },
    DecodeHintType: {
      POSSIBLE_FORMATS: "POSSIBLE_FORMATS",
      TRY_HARDER: "TRY_HARDER",
    },
    RGBLuminanceSource: vi.fn(),
    BinaryBitmap: vi.fn(),
    HybridBinarizer: vi.fn(),
    MultiFormatReader: MultiFormatReader,
    InvertedLuminanceSource: vi.fn(),
    GlobalHistogramBinarizer: vi.fn(),
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
      MultiFormatReader.prototype.decode = vi.fn().mockImplementation(() => {
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
  });
});
