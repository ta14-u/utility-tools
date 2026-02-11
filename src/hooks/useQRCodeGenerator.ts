import { useState } from "react";

const MAX_QR_CODE_LENGTH = 4296;

const useQRCodeGenerator = () => {
  const [text, setText] = useState("");
  const [qrCodeText, setQrCodeText] = useState("");
  const [generateError, setGenerateError] = useState("");

  const handleGenerateQRCode = () => {
    if (text.length > MAX_QR_CODE_LENGTH) {
      setGenerateError(
        "Text is too long for a QR code (maximum 4,296 characters).",
      );
      setQrCodeText("");
    } else {
      setGenerateError("");
      setQrCodeText(text);
    }
  };

  return {
    text,
    setText,
    qrCodeText,
    generateError,
    handleGenerateQRCode,
  };
};

export { useQRCodeGenerator };