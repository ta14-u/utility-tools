import { useState } from "react";

import { decodeQrCode } from "../utils/qr/decode/decoder";

const useQRCodeDecoder = () => {
  const [decodedText, setDecodedText] = useState("");
  const [decodedEncoding, setDecodedEncoding] = useState("");
  const [decodeStatus, setDecodeStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

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
        } finally {
          // Processing finished
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

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
    handleCopy,
  };
};

export { useQRCodeDecoder };
