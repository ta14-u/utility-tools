import { useState } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as decoderUtils from "../utils/qr/decode/decoder";
import { useQRCodeDecoder } from "./useQRCodeDecoder";

vi.mock("react", () => ({
  useState: vi.fn(),
}));

vi.mock("../utils/qr/decode/decoder", () => ({
  decodeQrCode: vi.fn(),
}));

// 型定義
interface MockFileReader {
  readAsDataURL: Mock;
  onload: ((event: { target: { result: string } }) => void) | null;
  onerror: ((error: Error) => void) | null;
}

// Image のグローバルモック
let lastImageInstance: MockImage | null = null;
class MockImage {
  onload: (() => Promise<void>) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  src = "";
  constructor() {
    lastImageInstance = this;
  }
}
vi.stubGlobal("Image", MockImage);

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
    const mockFileReader: MockFileReader = {
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

    hook.handleImageUpload(mockEvent);

    expect(setDecodeStatus).toHaveBeenCalledWith("Processing image...");
    expect(setDecodedText).toHaveBeenCalledWith("");
    expect(setDecodedEncoding).toHaveBeenCalledWith("");
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);

    // FileReaderのonloadを手動で呼び出し
    const mockEventLoad = { target: { result: "data:image/png;base64,..." } };
    mockFileReader.onload?.(mockEventLoad);

    // Imageのonloadを手動で呼び出し
    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }

    expect(setDecodedText).toHaveBeenCalledWith("decoded text");
    expect(setDecodedEncoding).toHaveBeenCalledWith("UTF-8");
    expect(setDecodeStatus).toHaveBeenCalledWith("Successfully decoded!");
  });

  it("should handle decoding failure", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockResolvedValue(null);

    const hook = useQRCodeDecoder();
    const mockFile = { name: "test.png", type: "image/png" };
    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImageUpload(mockEvent);

    const mockFileReader = (globalThis.FileReader as unknown as Mock).mock
      .results[0].value as MockFileReader;
    mockFileReader.onload?.({ target: { result: "data:..." } });

    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }

    expect(setDecodeStatus).toHaveBeenCalledWith(
      expect.stringContaining("Could not decode QR code"),
    );
    expect(setDecodedText).toHaveBeenCalledWith("");
  });

  it("should handle unexpected error during decoding", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockRejectedValue(
      new Error("Unexpected error"),
    );

    const hook = useQRCodeDecoder();
    const mockFile = { name: "test.png", type: "image/png" };
    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImageUpload(mockEvent);

    const mockFileReader = (globalThis.FileReader as unknown as Mock).mock
      .results[0].value as MockFileReader;
    mockFileReader.onload?.({ target: { result: "data:..." } });

    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }

    expect(setDecodeStatus).toHaveBeenCalledWith("Error: Unexpected error");
  });

  it("should handle FileReader error", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    const hook = useQRCodeDecoder();
    const mockFile = { name: "test.png", type: "image/png" };
    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImageUpload(mockEvent);

    const mockFileReader = (globalThis.FileReader as unknown as Mock).mock
      .results[0].value as MockFileReader;
    mockFileReader.onerror?.(new Error("File read error"));

    expect(setDecodeStatus).toHaveBeenCalledWith("Error: Failed to read file.");
  });

  it("should handle Image load error", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    const hook = useQRCodeDecoder();
    const mockFile = { name: "test.png", type: "image/png" };
    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImageUpload(mockEvent);

    const mockFileReader = (globalThis.FileReader as unknown as Mock).mock
      .results[0].value as MockFileReader;
    mockFileReader.onload?.({ target: { result: "data:..." } });

    if (lastImageInstance?.onerror) {
      lastImageInstance.onerror(new Error("Image load error"));
    }

    expect(setDecodeStatus).toHaveBeenCalledWith(
      "Error: Failed to load image.",
    );
  });

  it("should handle copy failure", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["text to copy", setDecodedText])
      .mockReturnValueOnce(["UTF-8", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Copy failed")),
      },
    });

    const hook = useQRCodeDecoder();
    await hook.handleCopy();

    expect(setCopyStatus).toHaveBeenCalledWith("Failed to copy");
  });

  it("should do nothing if no file is selected", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    const hook = useQRCodeDecoder();
    const mockEvent = {
      target: { files: [] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImageUpload(mockEvent);
    expect(useState).not.toHaveBeenCalledWith("Processing image...");
  });

  it("should handle empty decoded text", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockResolvedValue({
      text: "",
      encoding: "UTF-8",
    });

    const hook = useQRCodeDecoder();
    const mockFile = { name: "test.png", type: "image/png" };
    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImageUpload(mockEvent);

    const mockFileReader = (globalThis.FileReader as unknown as Mock).mock
      .results[0].value as MockFileReader;
    mockFileReader.onload?.({ target: { result: "data:..." } });

    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }

    expect(setDecodedText).toHaveBeenCalledWith("[Empty string decoded]");
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

  it("should handle non-Error rejection during decode", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockRejectedValue("string error");

    const hook = useQRCodeDecoder();
    const mockFile = { name: "test.png", type: "image/png" };
    const mockEvent = {
      target: { files: [mockFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    hook.handleImageUpload(mockEvent);

    const mockFileReader = (globalThis.FileReader as unknown as Mock).mock
      .results[0].value as MockFileReader;
    mockFileReader.onload?.({ target: { result: "data:..." } });

    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }

    expect(setDecodeStatus).toHaveBeenCalledWith("Error: string error");
  });
});
