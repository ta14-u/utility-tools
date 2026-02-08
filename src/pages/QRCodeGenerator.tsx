import jsQR from "jsqr";
import { QRCodeCanvas } from "qrcode.react";
import { useState } from "react";

const QRCodeGenerator = () => {
  const [text, setText] = useState("");
  const [qrCodeText, setQrCodeText] = useState("");
  const [decodedText, setDecodedText] = useState("");
  const [generateError, setGenerateError] = useState("");

  const [copyStatus, setCopyStatus] = useState("");

  const handleGenerateQRCode = () => {
    if (text.length > 4296) {
      setGenerateError(
        "Text is too long for a QR code (maximum 4,296 characters).",
      );
      setQrCodeText("");
    } else {
      setGenerateError("");
      setQrCodeText(text);
    }
  };

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (context) {
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0, img.width, img.height);
            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            const code = jsQR(
              imageData.data,
              imageData.width,
              imageData.height,
            );
            if (code) {
              setDecodedText(code.data);
            } else {
              setDecodedText(
                "Could not decode QR code. Please ensure the image is clear and the QR code is not too small or distorted. Note: QR codes have a maximum capacity (approx. 4,296 alphanumeric characters).",
              );
            }
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
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
        {decodedText && (
          <div className="decoded-result">
            <h3>Decoded Text:</h3>
            <div
              className="decoded-result-container"
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
                  backgroundColor: decodedText.startsWith("Could not decode")
                    ? "#fff3f3"
                    : "#e8f0fe",
                  border: decodedText.startsWith("Could not decode")
                    ? "2px solid #ff4d4f"
                    : "2px solid #4285f4",
                  color: decodedText.startsWith("Could not decode")
                    ? "#cf1322"
                    : "#1a0dab",
                }}
              >
                {decodedText}
              </div>
              {!decodedText.startsWith("Could not decode") && (
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeGenerator;
