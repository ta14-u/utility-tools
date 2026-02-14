import {
	BinaryBitmap,
	BarcodeFormat,
	DecodeHintType,
	GlobalHistogramBinarizer,
	HybridBinarizer,
	InvertedLuminanceSource,
	MultiFormatReader,
	RGBLuminanceSource,
} from "@zxing/library";
import { describe, expect, it, vi } from "vitest";

import { decodeWithZXing } from "./zxing";

// ZXing ライブラリのモック
vi.mock("@zxing/library", async () => {
	const actual = await vi.importActual("@zxing/library");
	return {
		...actual,
		MultiFormatReader: vi.fn(),
		BinaryBitmap: vi.fn(),
		HybridBinarizer: vi.fn(),
		GlobalHistogramBinarizer: vi.fn(),
		InvertedLuminanceSource: vi.fn(),
	};
});

describe("qr/decode/zxing", () => {
	describe("decodeWithZXing", () => {
		it("should decode successfully with HybridBinarizer on first attempt", () => {
			const mockResult = { getText: () => "test" };
			const mockDecode = vi.fn().mockReturnValue(mockResult);
			const mockSetHints = vi.fn();

			vi.mocked(MultiFormatReader).mockImplementation(
				function (this: { decode: typeof mockDecode; setHints: typeof mockSetHints }) {
					this.decode = mockDecode;
					this.setHints = mockSetHints;
					return this;
				} as unknown as typeof MultiFormatReader,
			);

			const mockLuminanceSource = {} as RGBLuminanceSource;
			const hints = new Map<DecodeHintType, unknown>([
				[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
			]);

			const result = decodeWithZXing(mockLuminanceSource, hints);

			expect(result).not.toBeNull();
			expect(result?.result).toBe(mockResult);
			expect(mockSetHints).toHaveBeenCalledWith(hints);
			expect(BinaryBitmap).toHaveBeenCalledWith(expect.any(Object));
			expect(HybridBinarizer).toHaveBeenCalledWith(mockLuminanceSource);
		});

		it("should fallback to GlobalHistogramBinarizer when HybridBinarizer fails", () => {
			const mockResult = { getText: () => "test" };
			let callCount = 0;
			const mockDecode = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					throw new Error("HybridBinarizer failed");
				}
				return mockResult;
			});
			const mockSetHints = vi.fn();

			vi.mocked(MultiFormatReader).mockImplementation(
				function (this: { decode: typeof mockDecode; setHints: typeof mockSetHints }) {
					this.decode = mockDecode;
					this.setHints = mockSetHints;
					return this;
				} as unknown as typeof MultiFormatReader,
			);

			const mockLuminanceSource = {} as RGBLuminanceSource;
			const hints = new Map<DecodeHintType, unknown>();

			const result = decodeWithZXing(mockLuminanceSource, hints);

			expect(result).not.toBeNull();
			expect(result?.result).toBe(mockResult);
			expect(GlobalHistogramBinarizer).toHaveBeenCalledWith(
				mockLuminanceSource,
			);
			expect(mockDecode).toHaveBeenCalledTimes(2);
		});

		it("should try inverted luminance source when normal source fails", () => {
			const mockResult = { getText: () => "test" };
			let callCount = 0;
			const mockDecode = vi.fn().mockImplementation(() => {
				callCount++;
				// 最初の2回（通常ソース）は失敗、3回目（反転ソース + HybridBinarizer）で成功
				if (callCount <= 2) {
					throw new Error("Normal source failed");
				}
				return mockResult;
			});
			const mockSetHints = vi.fn();

			vi.mocked(MultiFormatReader).mockImplementation(
				function (this: { decode: typeof mockDecode; setHints: typeof mockSetHints }) {
					this.decode = mockDecode;
					this.setHints = mockSetHints;
					return this;
				} as unknown as typeof MultiFormatReader,
			);

			const mockLuminanceSource = {} as RGBLuminanceSource;
			const mockInvertedSource = {} as InvertedLuminanceSource;
			vi.mocked(InvertedLuminanceSource).mockImplementation(
				function (this: InvertedLuminanceSource) {
					return mockInvertedSource as InvertedLuminanceSource;
				} as unknown as typeof InvertedLuminanceSource,
			);

			const hints = new Map<DecodeHintType, unknown>();

			const result = decodeWithZXing(mockLuminanceSource, hints);

			expect(result).not.toBeNull();
			expect(result?.result).toBe(mockResult);
			expect(InvertedLuminanceSource).toHaveBeenCalledWith(mockLuminanceSource);
			expect(HybridBinarizer).toHaveBeenCalledWith(mockInvertedSource);
		});

		it("should try inverted source with GlobalHistogramBinarizer when HybridBinarizer fails", () => {
			const mockResult = { getText: () => "test" };
			let callCount = 0;
			const mockDecode = vi.fn().mockImplementation(() => {
				callCount++;
				// 最初の2回（通常ソース）は失敗
				// 3回目（反転ソース + HybridBinarizer）も失敗
				// 4回目（反転ソース + GlobalHistogramBinarizer）で成功
				if (callCount <= 3) {
					throw new Error("Failed");
				}
				return mockResult;
			});
			const mockSetHints = vi.fn();

			vi.mocked(MultiFormatReader).mockImplementation(
				function (this: { decode: typeof mockDecode; setHints: typeof mockSetHints }) {
					this.decode = mockDecode;
					this.setHints = mockSetHints;
					return this;
				} as unknown as typeof MultiFormatReader,
			);

			const mockLuminanceSource = {} as RGBLuminanceSource;
			const mockInvertedSource = {} as InvertedLuminanceSource;
			vi.mocked(InvertedLuminanceSource).mockImplementation(
				function (this: InvertedLuminanceSource) {
					return mockInvertedSource as InvertedLuminanceSource;
				} as unknown as typeof InvertedLuminanceSource,
			);

			const hints = new Map<DecodeHintType, unknown>();

			const result = decodeWithZXing(mockLuminanceSource, hints);

			expect(result).not.toBeNull();
			expect(result?.result).toBe(mockResult);
			expect(GlobalHistogramBinarizer).toHaveBeenCalledWith(mockInvertedSource);
			expect(mockDecode).toHaveBeenCalledTimes(4);
		});

		it("should return null when all decoding strategies fail", () => {
			const mockDecode = vi.fn().mockImplementation(() => {
				throw new Error("All strategies failed");
			});
			const mockSetHints = vi.fn();

			vi.mocked(MultiFormatReader).mockImplementation(
				function (this: { decode: typeof mockDecode; setHints: typeof mockSetHints }) {
					this.decode = mockDecode;
					this.setHints = mockSetHints;
					return this;
				} as unknown as typeof MultiFormatReader,
			);

			const mockLuminanceSource = {} as RGBLuminanceSource;
			const mockInvertedSource = {} as InvertedLuminanceSource;
			vi.mocked(InvertedLuminanceSource).mockImplementation(
				function (this: InvertedLuminanceSource) {
					return mockInvertedSource as InvertedLuminanceSource;
				} as unknown as typeof InvertedLuminanceSource,
			);

			const hints = new Map<DecodeHintType, unknown>();

			const result = decodeWithZXing(mockLuminanceSource, hints);

			expect(result).toBeNull();
			// 通常ソース2回 + 反転ソース2回 = 4回試行
			expect(mockDecode).toHaveBeenCalledTimes(4);
		});
	});
});
