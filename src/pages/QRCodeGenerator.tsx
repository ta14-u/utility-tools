import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const QRCodeGenerator = () => {
  const [text, setText] = useState('');
  const [qrCodeText, setQrCodeText] = useState('');

  const handleGenerateQRCode = () => {
    setQrCodeText(text);
  };

  return (
    <div className="qr-code-generator">
      <h1>QR Code Generator</h1>
      <div className="input-container">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to generate QR code"
        />
        <button onClick={handleGenerateQRCode}>Generate</button>
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
