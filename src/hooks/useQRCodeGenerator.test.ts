import { useState } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as qrUtils from "../utils/qrCodeGeneratorUtils";
import { useQRCodeGenerator } from "./useQRCodeGenerator";

vi.mock("react", () => ({
  useState: vi.fn(),
}));

vi.mock("../utils/qrCodeGeneratorUtils", () => ({
  encodeKanjiQRCode: vi.fn(),
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
    vi.mocked(qrUtils.isKanjiModeCompatible).mockReturnValue(true);
    vi.mocked(qrUtils.encodeKanjiQRCode).mockReturnValue(mockMatrix);

    vi.mocked(useState)
      .mockReturnValueOnce(["日本語", setText])
      .mockReturnValueOnce(["", setQrCodeText])
      .mockReturnValueOnce([null, setQrCodeMatrix])
      .mockReturnValueOnce(["", setGenerateError])
      .mockReturnValueOnce([true, setUseKanjiMode]);

    const hook = useQRCodeGenerator();
    hook.handleGenerateQRCode();

    expect(setGenerateError).toHaveBeenCalledWith("");
    expect(qrUtils.isKanjiModeCompatible).toHaveBeenCalledWith("日本語");
    expect(qrUtils.encodeKanjiQRCode).toHaveBeenCalledWith("日本語", false);
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
});
