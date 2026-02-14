import { describe, expect, it } from "vitest";

import { joinByteSegments, tryDecodeAsText } from "./encoding";

describe("qr/encoding", () => {
  describe("joinByteSegments", () => {
    it("should join multiple Uint8Arrays", () => {
      const seg1 = new Uint8Array([1, 2]);
      const seg2 = new Uint8Array([3, 4]);
      const joined = joinByteSegments([seg1, seg2]);
      expect(joined).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
  });

  describe("tryDecodeAsText", () => {
    it("should return null for empty/null bytes", () => {
      expect(tryDecodeAsText(null, "utf-8", true)).toBeNull();
      expect(tryDecodeAsText(new Uint8Array(0), "utf-8", true)).toBeNull();
    });

    it("should return null on error when fatal is true", () => {
      // 0xFF は不正な UTF-8
      const invalidUtf8 = new Uint8Array([0xff]);
      expect(tryDecodeAsText(invalidUtf8, "utf-8", true)).toBeNull();
    });
  });
});
