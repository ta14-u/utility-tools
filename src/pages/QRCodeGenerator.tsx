import { QRCodeCanvas } from "qrcode.react";

import { useQRCodeDecoder } from "../hooks/useQRCodeDecoder";
import { useQRCodeGenerator } from "../hooks/useQRCodeGenerator";

const QRCodeGenerator = () => {
  const { text, setText, qrCodeText, generateError, handleGenerateQRCode } =
    useQRCodeGenerator();
  const {
    decodedText,
    decodedEncoding,
    decodeStatus,
    copyStatus,
    handleImageUpload,
    handleCopy,
  } = useQRCodeDecoder();

  const downloadPNG = () => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
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

      {qrCodeText && (
        <div className="qr-code-container">
          <QRCodeCanvas value={qrCodeText} size={256} includeMargin={true} />
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
