import { useState } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as decoderUtils from "../utils/decoderUtils";
import { useQRCodeDecoder } from "./useQRCodeDecoder";

vi.mock("react", () => ({
  useState: vi.fn(),
}));

vi.mock("../utils/decoderUtils", () => ({
  decodeQrCode: vi.fn(),
}));

describe("useQRCodeDecoder", () => {
  let setDecodedText: Mock,
    setDecodedEncoding: Mock,
    setDecodeStatus: Mock,
    setCopyStatus: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    setDecodedText = vi.fn();
    setDecodedEncoding = vi.fn();
    setDecodeStatus = vi.fn();
    setCopyStatus = vi.fn();
  });

  it("should handle image upload and successful decoding", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockResolvedValue({
      text: "decoded text",
      encoding: "UTF-8",
    });

    // FileReaderのモック
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null,
      onerror: null,
    };
    const MockFileReader = vi.fn().mockImplementation(function (this: unknown) {
      return mockFileReader;
    });
    vi.stubGlobal("FileReader", MockFileReader);

    const hook = useQRCodeDecoder();

    const mockFile = { name: "test.png", type: "image/png" };
    const mockEvent = {
      target: {
        files: [mockFile],
      },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    // handleImageUploadをトリガー
    hook.handleImageUpload(mockEvent);

    expect(setDecodeStatus).toHaveBeenCalledWith("Processing image...");
    expect(setDecodedText).toHaveBeenCalledWith("");
    expect(setDecodedEncoding).toHaveBeenCalledWith("");
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);
  });

  it("should handle copying to clipboard", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["text to copy", setDecodedText])
      .mockReturnValueOnce(["UTF-8", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    // navigator.clipboardのモック
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("navigator", { clipboard: mockClipboard });

    const hook = useQRCodeDecoder();
    await hook.handleCopy();

    expect(mockClipboard.writeText).toHaveBeenCalledWith("text to copy");
    expect(setCopyStatus).toHaveBeenCalledWith("Copied!");
  });
});
