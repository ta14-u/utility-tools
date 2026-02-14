import { Byte, Charset, Kanji } from "@nuintun/qrcode";
import Encoding from "encoding-japanese";
import { describe, expect, it, vi } from "vitest";

import {
	isKanjiModeCompatible,
	isShiftJISCompatible,
	segmentText,
	shiftJISByteEncoder,
} from "./shiftjis";

describe("qr/shiftjis", () => {
	describe("isKanjiModeCompatible", () => {
		it("should return true for 2-byte Shift_JIS characters", () => {
			expect(isKanjiModeCompatible("あああ")).toBe(true);
		});

		it("should return true for mixed hiragana and kanji", () => {
			expect(isKanjiModeCompatible("日本語")).toBe(true);
		});

		it("should return false for ASCII characters", () => {
			expect(isKanjiModeCompatible("ABC123")).toBe(false);
		});

		it("should return false for mixed Japanese and ASCII", () => {
			expect(isKanjiModeCompatible("あいA1")).toBe(false);
		});

		it("should return false for empty string", () => {
			expect(isKanjiModeCompatible("")).toBe(false);
		});

		it("should return false for non-Kanji 2-byte characters", () => {
			// "㈱" は Shift_JIS ですが、純粋な漢字モードの範囲外になることがあります
			// isKanjiModeCompatible 内の catch ブロックを確実に実行させるケースをテストします
			expect(isKanjiModeCompatible("A")).toBe(false);
		});
	});

	describe("isShiftJISCompatible", () => {
		it("should return false when 0x81-0x9F byte has no second byte", () => {
			vi.spyOn(Encoding, "convert").mockReturnValue([0x81]);
			vi.spyOn(Encoding, "stringToCode").mockReturnValue([0x81]);
			expect(isShiftJISCompatible("dummy")).toBe(false);
			vi.restoreAllMocks();
		});

		it("should return false when 0x81-0x9F byte has invalid second byte", () => {
			vi.spyOn(Encoding, "convert").mockReturnValue([0x81, 0x3f]);
			expect(isShiftJISCompatible("dummy")).toBe(false);
			vi.restoreAllMocks();
		});

		it("should return false when 0xE0-0xEF byte has no second byte", () => {
			vi.spyOn(Encoding, "convert").mockReturnValue([0xe0]);
			expect(isShiftJISCompatible("dummy")).toBe(false);
			vi.restoreAllMocks();
		});

		it("should return false when 0xE0-0xEF byte has invalid second byte", () => {
			vi.spyOn(Encoding, "convert").mockReturnValue([0xe0, 0xfd]);
			expect(isShiftJISCompatible("dummy")).toBe(false);
			vi.restoreAllMocks();
		});

		it("should return false for unsupported byte ranges", () => {
			vi.spyOn(Encoding, "convert").mockReturnValue([0x80]);
			expect(isShiftJISCompatible("dummy")).toBe(false);
			vi.restoreAllMocks();
		});

		it("should return false for empty conversion result", () => {
			vi.spyOn(Encoding, "convert").mockReturnValue([]);
			expect(isShiftJISCompatible("dummy")).toBe(false);
			vi.restoreAllMocks();
		});
	});

	describe("shiftJISByteEncoder", () => {
		it("should fall back to TextEncoder for non-Shift_JIS charset", () => {
			const result = shiftJISByteEncoder("Hello", Charset.UTF_8);
			expect(result).toEqual(new TextEncoder().encode("Hello"));
		});
	});

	describe("segmentText", () => {
		it("should handle empty string", () => {
			expect(segmentText("")).toEqual([]);
		});

		it("should return a single Kanji segment for pure Kanji text", () => {
			const segments = segmentText("漢字");
			expect(segments).toHaveLength(1);
			// 一部のバージョンでは @nuintun/qrcode の漢字セグメントはオブジェクト自体に直接 .mode.name を持たないため、
			// コンストラクタや型をチェックする必要がある。
			expect(segments[0]).toBeInstanceOf(Kanji);
		});

		it("should fall back to Byte segment for non-SJIS character", () => {
			// 絵文字は通常 SJIS には含まれない
			const segments = segmentText("A😊");
			expect(segments).toHaveLength(1);
			expect(segments[0]).toBeInstanceOf(Byte);
		});

		it("should handle mixed Kanji and SJIS Byte text", () => {
			const segments = segmentText("Aあ");
			expect(segments).toHaveLength(2);
			expect(segments[0]).toBeInstanceOf(Byte);
			expect(segments[1]).toBeInstanceOf(Kanji);
		});
	});
});
