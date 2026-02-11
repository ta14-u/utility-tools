import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef } from "react";

import { useQRCodeDecoder } from "../hooks/useQRCodeDecoder";
import { useQRCodeGenerator } from "../hooks/useQRCodeGenerator";

const QR_CODE_CANVAS_ID = "generated-qr-code";
const QR_CODE_SIZE = 256;
const QR_CODE_MARGIN = 4;

type QRCodeMatrix = {
  matrix: number[][];
  size: number;
};

type KanjiQRCodeCanvasProps = {
  qrCodeMatrix: QRCodeMatrix;
  size: number;
  canvasId: string;
};

const KanjiQRCodeCanvas = ({
  qrCodeMatrix,
  size,
  canvasId,
}: KanjiQRCodeCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const moduleCount = qrCodeMatrix.size;
    const totalModules = moduleCount + QR_CODE_MARGIN * 2;
    const scale = size / totalModules;

    canvas.width = size;
    canvas.height = size;
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#000000";

    for (let y = 0; y < moduleCount; y += 1) {
      for (let x = 0; x < moduleCount; x += 1) {
        if (qrCodeMatrix.matrix[y][x] === 1) {
          context.fillRect(
            (x + QR_CODE_MARGIN) * scale,
            (y + QR_CODE_MARGIN) * scale,
            scale,
            scale,
          );
        }
      }
    }
  }, [qrCodeMatrix, size]);

  return <canvas id={canvasId} ref={canvasRef} aria-label="QR code" />;
};

const QRCodeGenerator = () => {
  const {
    text,
    setText,
    qrCodeText,
    qrCodeMatrix,
    generateError,
    useKanjiMode,
    setUseKanjiMode,
    handleGenerateQRCode,
  } = useQRCodeGenerator();
  const {
    decodedText,
    decodedEncoding,
    decodeStatus,
    copyStatus,
    handleImageUpload,
    handleCopy,
  } = useQRCodeDecoder();

  const downloadPNG = () => {
    const canvas = document.getElementById(QR_CODE_CANVAS_ID);
    if (canvas instanceof HTMLCanvasElement) {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = "qrcode.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="qr-code-generator">
      <h1>QR Code Tools</h1>
      <div className="input-section">
        <h2>QR Code Generator</h2>
        <div className="input-container">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to generate QR code"
          />
          <button type="button" onClick={handleGenerateQRCode}>
            Generate
          </button>
        </div>
        <label className="kanji-mode-option">
          <input
            type="checkbox"
            checked={useKanjiMode}
            onChange={(event) => setUseKanjiMode(event.target.checked)}
          />
          Generate in Kanji mode (Shift_JIS)
        </label>
        <div className="kanji-mode-hint">
          Kanji mode supports Shift_JIS characters. Mixed mode (Kanji + ASCII)
          is automatically enabled.
        </div>
        <div className="message-container">
          {generateError ? (
            <div className="error-message" style={{ color: "#cf1322" }}>
              {generateError}
            </div>
          ) : (
            <div className="capacity-hint" style={{ color: "#666" }}>
              Maximum capacity: ~4,296 characters.
            </div>
          )}
        </div>
      </div>

      {(qrCodeText || qrCodeMatrix) && (
        <div className="qr-code-container">
          {qrCodeMatrix ? (
            <KanjiQRCodeCanvas
              qrCodeMatrix={qrCodeMatrix}
              size={QR_CODE_SIZE}
              canvasId={QR_CODE_CANVAS_ID}
            />
          ) : (
            <QRCodeCanvas
              id={QR_CODE_CANVAS_ID}
              value={qrCodeText}
              size={QR_CODE_SIZE}
              includeMargin={true}
            />
          )}
          <div className="action-container">
            <button type="button" onClick={downloadPNG}>
              Download PNG
            </button>
          </div>
        </div>
      )}

      <hr />

      <div className="decoder-container">
        <h2>QR Code Decoder</h2>
        <input type="file" accept="image/*" onChange={handleImageUpload} />
        {(decodeStatus || decodedText) && (
          <div className="decoded-result">
            <h3>
              Decoded Result:
              {decodedEncoding && (
                <span
                  style={{
                    fontSize: "0.8em",
                    fontWeight: "normal",
                    color: "#666",
                    marginLeft: "10px",
                  }}
                >
                  (Encoding: {decodedEncoding})
                </span>
              )}
            </h3>
            <div
              className="decoded-result-container"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                width: "100%",
              }}
            >
              {decodeStatus && (
                <div
                  className="status-message"
                  style={{
                    fontSize: "0.9em",
                    color:
                      decodeStatus.includes("Error") ||
                      decodeStatus.includes("Could not decode")
                        ? "#cf1322"
                        : "#666",
                    fontStyle: "italic",
                    textAlign: "left",
                    padding: "0 5px",
                  }}
                >
                  {decodeStatus}
                </div>
              )}
              {decodedText && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    width: "100%",
                  }}
                >
                  <div
                    className="decoded-text-box"
                    style={{
                      backgroundColor: "#e8f0fe",
                      border: "2px solid #4285f4",
                      color: "#1a0dab",
                    }}
                  >
                    {decodedText}
                  </div>
                  <div
                    className="copy-action-container"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "5px",
                      flexShrink: 0,
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleCopy}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      Copy
                    </button>
                    {copyStatus && (
                      <span style={{ fontSize: "0.8em", color: "green" }}>
                        {copyStatus}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeGenerator;
