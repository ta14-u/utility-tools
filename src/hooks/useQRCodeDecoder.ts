import { useCallback, useState } from "react";

import { decodeQrCode } from "../utils/qr/decode/decoder";

const processImageFile = (
  file: File,
  setDecodedText: (v: string) => void,
  setDecodedEncoding: (v: string) => void,
  setDecodeStatus: (v: string) => void,
) => {
  setDecodeStatus("Processing image...");
  setDecodedText("");
  setDecodedEncoding("");

  const reader = new FileReader();
  reader.onerror = (err) => {
    console.error("FileReader error:", err);
    setDecodeStatus("Error: Failed to read file.");
  };
  reader.onload = (event) => {
    const img = new Image();
    img.onerror = (err) => {
      console.error("Image load error:", err);
      setDecodeStatus("Error: Failed to load image.");
    };
    img.onload = async () => {
      try {
        const finalResult = await decodeQrCode(img, setDecodeStatus);

        if (finalResult !== null) {
          if (finalResult.text === "") {
            setDecodedText("[Empty string decoded]");
          } else {
            setDecodedText(finalResult.text);
          }
          setDecodedEncoding(finalResult.encoding);
          setDecodeStatus("Successfully decoded!");
        } else {
          setDecodedText("");
          setDecodedEncoding("");
          setDecodeStatus(
            "Could not decode QR code. This image appears to have a very high-density QR code. ZXing and jsQR both failed to recognize it even after upscaling. Please try a clearer or higher resolution image.",
          );
        }
      } catch (err) {
        console.error("Unexpected error during decoding:", err);
        setDecodeStatus(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };
    img.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const useQRCodeDecoder = () => {
  const [decodedText, setDecodedText] = useState("");
  const [decodedEncoding, setDecodedEncoding] = useState("");
  const [decodeStatus, setDecodeStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const processFile = useCallback(
    (file: File) => {
      processImageFile(
        file,
        setDecodedText,
        setDecodedEncoding,
        setDecodeStatus,
      );
    },
    [],
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      processFile(file);
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file?.type.startsWith("image/")) {
        return;
      }
      e.preventDefault();
      processFile(file);
    },
    [processFile],
  );

  const handleFiles = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles.find((f) => f.type.startsWith("image/"));
      if (file) {
        processFile(file);
      }
    },
    [processFile],
  );

  const handlePasteFromClipboard = useCallback(() => {
    if (!navigator.clipboard?.read) {
      setDecodeStatus(
        "Error: Clipboard API is not available. Please select or drop an image.",
      );
      return;
    }

    setDecodeStatus("Processing image...");
    setDecodedText("");
    setDecodedEncoding("");

    const doRead = () => {
      navigator.clipboard
        .read()
        .then(async (items) => {
        const types = Array.from(items);
        for (const item of types) {
          const itemTypes = Array.from(item.types);
          for (const type of itemTypes) {
            try {
              const blob = await item.getType(type);
              const mime = (blob.type || type).toLowerCase();
              if (mime.startsWith("image/")) {
                const file = new File([blob], "image.png", {
                  type: blob.type || "image/png",
                });
                processFile(file);
                return;
              }
            } catch {
              // Skip types that fail to retrieve (e.g. unsupported)
            }
          }
        }
        setDecodeStatus("No image in clipboard.");
      })
      .catch((err) => {
        console.error("Clipboard read error:", err);
        if (err instanceof Error && err.name === "NotAllowedError") {
          setDecodeStatus(
            "Clipboard access denied. Please allow access when prompted, or select/drop an image.",
          );
        } else {
          setDecodeStatus(
            `Error: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });
    };

    document.body.focus();
    requestAnimationFrame(() => {
      doRead();
    });
  }, [processFile]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files?.length) {
        return;
      }
      for (const file of files) {
        if (file.type.startsWith("image/")) {
          e.preventDefault();
          processFile(file);
          return;
        }
      }
    },
    [processFile],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(decodedText);
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Failed to copy");
    }
  };

  return {
    decodedText,
    decodedEncoding,
    decodeStatus,
    copyStatus,
    handleImageUpload,
    handleDrop,
    handleFiles,
    handlePasteFromClipboard,
    handlePaste,
    handleCopy,
  };
};

export { useQRCodeDecoder };
