import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useRef } from "react";
import { useDropzone } from "react-dropzone";

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

/** 画像を追加する（インポート）を表すアイコン：画像フレーム＋プラス */
const AddImageIcon = () => (
  <svg
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#ccc"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const PlusIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

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
    handleFiles,
    handlePaste,
    handleCopy,
  } = useQRCodeDecoder();

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: { "image/*": [] },
    noClick: true,
    noKeyboard: true,
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) {
        handleFiles(acceptedFiles);
      }
    },
  });

  const dropZoneStyle = useMemo(
    () => ({
      border: `2px dashed ${isDragActive ? "#2196f3" : "#ccc"}`,
      borderRadius: "8px",
      padding: "16px 20px",
      textAlign: "center" as const,
      cursor: "pointer" as const,
      backgroundColor: isDragActive ? "#e3f2fd" : "#fafafa",
      marginBottom: "12px",
      outline: "none" as const,
      transition: "border-color 0.2s, background-color 0.2s",
      display: "flex" as const,
      flexDirection: "column" as const,
      alignItems: "center" as const,
      gap: "6px",
    }),
    [isDragActive],
  );

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
          <div className="generate-row">
            <button type="button" onClick={handleGenerateQRCode}>
              Generate
            </button>
            <div className="kanji-mode-group">
              <label className="kanji-mode-option">
                <input
                  type="checkbox"
                  checked={useKanjiMode}
                  onChange={(event) => setUseKanjiMode(event.target.checked)}
                />
                Generate in Kanji mode (Shift_JIS)
              </label>
              <div className="kanji-mode-hint">
                Kanji mode supports Shift_JIS characters.
              </div>
            </div>
          </div>
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

      <div
        className="decoder-container"
        role="region"
        aria-label="QR Code Decoder"
      >
        <h2>QR Code Decoder</h2>
        <div
          {...getRootProps()}
          onPaste={handlePaste}
          tabIndex={0}
          role="button"
          aria-label="Drop image, click + to select file, or press Ctrl+V to paste"
          className="decoder-drop-zone"
          style={dropZoneStyle}
        >
          <input {...getInputProps()} aria-hidden />

          <div style={{ pointerEvents: "none" }}>
            <AddImageIcon />
          </div>

          <div style={{ color: "#666", fontSize: "0.9em" }}>
            {isDragActive ? "Drop image here" : "Drag and drop image here"}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            aria-label="Select image file"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#555",
              fontSize: "0.95em",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#f5f5f5";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#fff";
            }}
          >
            <PlusIcon /> Select File
          </button>

          <div
            style={{ marginTop: "4px", fontSize: "0.8em", color: "#888" }}
          >
            Or click here and paste with{" "}
            <kbd
              style={{
                backgroundColor: "#eee",
                border: "1px solid #ccc",
                borderRadius: "3px",
                padding: "2px 4px",
                fontFamily: "monospace",
                margin: "0 2px",
              }}
            >
              Ctrl(Cmd)
            </kbd>{" "}
            +{" "}
            <kbd
              style={{
                backgroundColor: "#eee",
                border: "1px solid #ccc",
                borderRadius: "3px",
                padding: "2px 4px",
                fontFamily: "monospace",
                margin: "0 2px",
              }}
            >
              V
            </kbd>
          </div>
        </div>
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
