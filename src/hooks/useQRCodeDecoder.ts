import { useState } from "react";

import { decodeQrCode } from "../utils/decoderUtils";

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

    console.log("DEBUG: File selected:", file.name, file.type, file.size);
    setDecodeStatus("Processing image...");
    setDecodedText("");
    setDecodedEncoding("");

    const reader = new FileReader();
    reader.onerror = (err) => {
      console.error("DEBUG: FileReader error:", err);
      setDecodeStatus("Error: Failed to read file.");
    };
    reader.onload = (event) => {
      console.log("DEBUG: FileReader loaded");
      const img = new Image();
      img.onerror = (err) => {
        console.error("DEBUG: Image load error:", err);
        setDecodeStatus("Error: Failed to load image.");
      };
      img.onload = async () => {
        console.log("DEBUG: Image object loaded", img.width, "x", img.height);

        try {
          const finalResult = await decodeQrCode(img, setDecodeStatus);

          if (finalResult !== null) {
            console.log("DEBUG: Setting final decoded text");

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
          console.error("DEBUG: Unexpected error during decoding:", err);
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