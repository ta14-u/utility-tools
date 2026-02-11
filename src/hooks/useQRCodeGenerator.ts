import { useState } from "react";

import {
  encodeKanjiQRCode,
  isKanjiModeCompatible,
} from "../utils/qrCodeGeneratorUtils";

const MAX_QR_CODE_LENGTH = 4296;

type QRCodeMatrix = {
  matrix: number[][];
  size: number;
};

const useQRCodeGenerator = () => {
  const [text, setText] = useState("");
  const [qrCodeText, setQrCodeText] = useState("");
  const [qrCodeMatrix, setQrCodeMatrix] = useState<QRCodeMatrix | null>(null);
  const [generateError, setGenerateError] = useState("");
  const [useKanjiMode, setUseKanjiMode] = useState(false);

  const handleGenerateQRCode = () => {
    if (text.length > MAX_QR_CODE_LENGTH) {
      setGenerateError(
        "Text is too long for a QR code (maximum 4,296 characters).",
      );
      setQrCodeText("");
      setQrCodeMatrix(null);
    } else {
      setGenerateError("");
      if (useKanjiMode) {
        try {
          // Check if text is compatible with pure Kanji mode
          const isPureKanji = isKanjiModeCompatible(text);
          // Use mixed mode if text contains non-Kanji characters
          const result = encodeKanjiQRCode(text, !isPureKanji);
          setQrCodeText("");
          setQrCodeMatrix(result);
        } catch (error) {
          console.error("Failed to encode QR code in Kanji mode.", error);
          setGenerateError(
            error instanceof Error
              ? error.message
              : "Failed to generate a Kanji mode QR code.",
          );
          setQrCodeText("");
          setQrCodeMatrix(null);
        }
      } else {
        setQrCodeText(text);
        setQrCodeMatrix(null);
      }
    }
  };

  return {
    text,
    setText,
    qrCodeText,
    qrCodeMatrix,
    generateError,
    useKanjiMode,
    setUseKanjiMode,
    handleGenerateQRCode,
  };
};

export { useQRCodeGenerator };
