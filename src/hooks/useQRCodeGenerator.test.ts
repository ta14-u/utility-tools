import { useState } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as encodeUtils from "../utils/qr/encode/kanji";
import * as shiftjisUtils from "../utils/qr/shiftjis";
import { useQRCodeGenerator } from "./useQRCodeGenerator";

vi.mock("react", () => ({
  useState: vi.fn(),
}));

vi.mock("../utils/qr/encode/kanji", () => ({
  encodeKanjiQRCode: vi.fn(),
}));

vi.mock("../utils/qr/shiftjis", () => ({
  isKanjiModeCompatible: vi.fn(),
}));

describe("useQRCodeGenerator", () => {
  let setText: Mock,
    setQrCodeText: Mock,
    setQrCodeMatrix: Mock,
    setGenerateError: Mock,
    setUseKanjiMode: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    setText = vi.fn();
    setQrCodeText = vi.fn();
    setQrCodeMatrix = vi.fn();
    setGenerateError = vi.fn();
    setUseKanjiMode = vi.fn();
  });

  it("should generate QR code in standard mode", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["Hello", setText])
      .mockReturnValueOnce(["", setQrCodeText])
      .mockReturnValueOnce([null, setQrCodeMatrix])
      .mockReturnValueOnce(["", setGenerateError])
      .mockReturnValueOnce([false, setUseKanjiMode]);

    const hook = useQRCodeGenerator();
    hook.handleGenerateQRCode();

    expect(setGenerateError).toHaveBeenCalledWith("");
    expect(setQrCodeText).toHaveBeenCalledWith("Hello");
    expect(setQrCodeMatrix).toHaveBeenCalledWith(null);
  });

  it("should generate QR code in Kanji mode", () => {
    const mockMatrix = { matrix: [[1]], size: 1 };
    vi.mocked(shiftjisUtils.isKanjiModeCompatible).mockReturnValue(true);
    vi.mocked(encodeUtils.encodeKanjiQRCode).mockReturnValue(mockMatrix);

    vi.mocked(useState)
      .mockReturnValueOnce(["日本語", setText])
      .mockReturnValueOnce(["", setQrCodeText])
      .mockReturnValueOnce([null, setQrCodeMatrix])
      .mockReturnValueOnce(["", setGenerateError])
      .mockReturnValueOnce([true, setUseKanjiMode]);

    const hook = useQRCodeGenerator();
    hook.handleGenerateQRCode();

    expect(setGenerateError).toHaveBeenCalledWith("");
    expect(shiftjisUtils.isKanjiModeCompatible).toHaveBeenCalledWith("日本語");
    expect(encodeUtils.encodeKanjiQRCode).toHaveBeenCalledWith("日本語", false);
    expect(setQrCodeMatrix).toHaveBeenCalledWith(mockMatrix);
  });

  it("should handle error when text is too long", () => {
    const longText = "a".repeat(5000);
    vi.mocked(useState)
      .mockReturnValueOnce([longText, setText])
      .mockReturnValueOnce(["", setQrCodeText])
      .mockReturnValueOnce([null, setQrCodeMatrix])
      .mockReturnValueOnce(["", setGenerateError])
      .mockReturnValueOnce([false, setUseKanjiMode]);

    const hook = useQRCodeGenerator();
    hook.handleGenerateQRCode();

    expect(setGenerateError).toHaveBeenCalledWith(
      expect.stringContaining("too long"),
    );
    expect(setQrCodeText).toHaveBeenCalledWith("");
    expect(setQrCodeMatrix).toHaveBeenCalledWith(null);
  });

  it("should handle error during generation", () => {
    vi.mocked(shiftjisUtils.isKanjiModeCompatible).mockReturnValue(true);
    vi.mocked(encodeUtils.encodeKanjiQRCode).mockImplementation(() => {
      throw new Error("generation failed");
    });

    vi.mocked(useState)
      .mockReturnValueOnce(["日本語", setText])
      .mockReturnValueOnce(["", setQrCodeText])
      .mockReturnValueOnce([null, setQrCodeMatrix])
      .mockReturnValueOnce(["", setGenerateError])
      .mockReturnValueOnce([true, setUseKanjiMode]);

    const hook = useQRCodeGenerator();
    hook.handleGenerateQRCode();

    expect(setGenerateError).toHaveBeenCalledWith("generation failed");
    expect(setQrCodeText).toHaveBeenCalledWith("");
    expect(setQrCodeMatrix).toHaveBeenCalledWith(null);
  });

  it("should handle non-Error throw in Kanji mode", () => {
    vi.mocked(shiftjisUtils.isKanjiModeCompatible).mockReturnValue(true);
    vi.mocked(encodeUtils.encodeKanjiQRCode).mockImplementation(() => {
      throw "string error";
    });

    vi.mocked(useState)
      .mockReturnValueOnce(["日本語", setText])
      .mockReturnValueOnce(["", setQrCodeText])
      .mockReturnValueOnce([null, setQrCodeMatrix])
      .mockReturnValueOnce(["", setGenerateError])
      .mockReturnValueOnce([true, setUseKanjiMode]);

    const hook = useQRCodeGenerator();
    hook.handleGenerateQRCode();

    expect(setGenerateError).toHaveBeenCalledWith(
      "Failed to generate a Kanji mode QR code.",
    );
  });
});
