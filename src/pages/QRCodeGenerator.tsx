import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

const QRCodeGenerator = () => {
  const [text, setText] = useState("");
  const [qrCodeText, setQrCodeText] = useState("");

  const handleGenerateQRCode = () => {
    setQrCodeText(text);
  };

  return (
    <div className="qr-code-generator">
      <h1>QR Code Generator</h1>
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
      {qrCodeText && (
        <div className="qr-code-container">
          <QRCodeSVG value={qrCodeText} size={256} />
        </div>
      )}
    </div>
  );
};

export default QRCodeGenerator;
