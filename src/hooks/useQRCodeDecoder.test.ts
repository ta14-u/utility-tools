import { useState } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as decoderUtils from "../utils/qr/decode/decoder";
import { useQRCodeDecoder } from "./useQRCodeDecoder";

vi.mock("react", () => ({
  useState: vi.fn(),
  useCallback: (fn: unknown) => fn,
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

  it("should call processFile on handleDrop with image file", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockResolvedValue({
      text: "dropped",
      encoding: "UTF-8",
    });

    const mockFileReader: MockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null,
      onerror: null,
    };
    const FileReaderCtor = vi.fn().mockImplementation(function (this: unknown) {
      return mockFileReader;
    });
    vi.stubGlobal("FileReader", FileReaderCtor);

    const hook = useQRCodeDecoder();
    const mockFile = { name: "drop.png", type: "image/png" } as File;
    const mockEvent = {
      dataTransfer: { files: [mockFile] },
      preventDefault: vi.fn(),
    } as unknown as React.DragEvent;

    hook.handleDrop(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(mockFile);
    mockFileReader.onload?.({
      target: { result: "data:image/png;base64,..." },
    });
    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }
    expect(setDecodedText).toHaveBeenCalledWith("dropped");
  });

  it("should not call processFile on handleDrop with non-image file", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    const FileReaderCtor = vi.fn();
    vi.stubGlobal("FileReader", FileReaderCtor);

    const hook = useQRCodeDecoder();
    const mockFile = { name: "doc.pdf", type: "application/pdf" } as File;
    const mockEvent = {
      dataTransfer: { files: [mockFile] },
      preventDefault: vi.fn(),
    } as unknown as React.DragEvent;

    hook.handleDrop(mockEvent);

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(FileReaderCtor).not.toHaveBeenCalled();
  });

  it("should call processFile on handleFiles when acceptedFiles contains image", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockResolvedValue({
      text: "from files",
      encoding: "UTF-8",
    });

    const mockFileReader: MockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null,
      onerror: null,
    };
    vi.stubGlobal(
      "FileReader",
      vi.fn().mockImplementation(function (this: unknown) {
        return mockFileReader;
      }),
    );

    const hook = useQRCodeDecoder();
    const imageFile = { name: "a.png", type: "image/png" } as File;
    hook.handleFiles([imageFile]);

    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
    mockFileReader.onload?.({
      target: { result: "data:image/png;base64,..." },
    });
    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }
    expect(setDecodedText).toHaveBeenCalledWith("from files");
  });

  it("should not call processFile on handleFiles when no image in list", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    const FileReaderCtor = vi.fn();
    vi.stubGlobal("FileReader", FileReaderCtor);

    const hook = useQRCodeDecoder();
    const textFile = { name: "x.txt", type: "text/plain" } as File;
    hook.handleFiles([textFile]);

    expect(FileReaderCtor).not.toHaveBeenCalled();
  });

  it("should call processFile on handlePaste when clipboard has image", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockResolvedValue({
      text: "pasted",
      encoding: "UTF-8",
    });

    const mockFileReader: MockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null,
      onerror: null,
    };
    vi.stubGlobal(
      "FileReader",
      vi.fn().mockImplementation(function (this: unknown) {
        return mockFileReader;
      }),
    );

    const hook = useQRCodeDecoder();
    const imageFile = { type: "image/png" } as File;
    const mockEvent = {
      clipboardData: { files: [imageFile] },
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent;

    hook.handlePaste(mockEvent);

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
    mockFileReader.onload?.({
      target: { result: "data:image/png;base64,..." },
    });
    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }
    expect(setDecodedText).toHaveBeenCalledWith("pasted");
  });

  it("should do nothing on handlePaste when clipboard has no image", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    const hook = useQRCodeDecoder();
    const mockEvent = {
      clipboardData: { files: [{ type: "text/plain" }] },
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent;

    hook.handlePaste(mockEvent);

    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("should set error when handlePasteFromClipboard and clipboard API unavailable", () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.stubGlobal("navigator", { clipboard: undefined });
    vi.stubGlobal("document", { body: { focus: vi.fn() } });
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      cb();
      return 0;
    });

    const hook = useQRCodeDecoder();
    hook.handlePasteFromClipboard();

    expect(setDecodeStatus).toHaveBeenCalledWith(
      "Error: Clipboard API is not available. Please select or drop an image.",
    );
  });

  it("should set status when handlePasteFromClipboard finds no image in clipboard", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.stubGlobal("document", { body: { focus: vi.fn() } });
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      cb();
      return 0;
    });
    vi.stubGlobal("navigator", {
      clipboard: {
        read: vi
          .fn()
          .mockResolvedValue([{ types: ["text/plain"], getType: vi.fn() }]),
      },
    });

    const hook = useQRCodeDecoder();
    hook.handlePasteFromClipboard();

    await vi.waitFor(() => {
      expect(setDecodeStatus).toHaveBeenCalledWith("No image in clipboard.");
    });
  });

  it("should set error when handlePasteFromClipboard clipboard read is denied", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    const err = new Error("denied");
    err.name = "NotAllowedError";
    vi.stubGlobal("document", { body: { focus: vi.fn() } });
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      cb();
      return 0;
    });
    vi.stubGlobal("navigator", {
      clipboard: { read: vi.fn().mockRejectedValue(err) },
    });

    const hook = useQRCodeDecoder();
    hook.handlePasteFromClipboard();

    await vi.waitFor(() => {
      expect(setDecodeStatus).toHaveBeenCalledWith(
        "Clipboard access denied. Please allow access when prompted, or select/drop an image.",
      );
    });
  });

  it("should call processFile when handlePasteFromClipboard gets image from clipboard", async () => {
    vi.mocked(useState)
      .mockReturnValueOnce(["", setDecodedText])
      .mockReturnValueOnce(["", setDecodedEncoding])
      .mockReturnValueOnce(["", setDecodeStatus])
      .mockReturnValueOnce(["", setCopyStatus]);

    vi.mocked(decoderUtils.decodeQrCode).mockResolvedValue({
      text: "from clipboard",
      encoding: "UTF-8",
    });

    const mockFileReader: MockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null,
      onerror: null,
    };
    vi.stubGlobal(
      "FileReader",
      vi.fn().mockImplementation(function (this: unknown) {
        return mockFileReader;
      }),
    );
    vi.stubGlobal("document", { body: { focus: vi.fn() } });
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      cb();
      return 0;
    });
    const imageBlob = new Blob([], { type: "image/png" });
    vi.stubGlobal("navigator", {
      clipboard: {
        read: vi.fn().mockResolvedValue([
          {
            types: ["image/png"],
            getType: vi.fn().mockResolvedValue(imageBlob),
          },
        ]),
      },
    });

    const hook = useQRCodeDecoder();
    hook.handlePasteFromClipboard();

    await vi.waitFor(
      () => {
        expect(mockFileReader.readAsDataURL).toHaveBeenCalled();
      },
      { timeout: 500 },
    );
    mockFileReader.onload?.({
      target: { result: "data:image/png;base64,..." },
    });
    if (lastImageInstance?.onload) {
      await lastImageInstance.onload();
    }
    expect(setDecodedText).toHaveBeenCalledWith("from clipboard");
  });
});
