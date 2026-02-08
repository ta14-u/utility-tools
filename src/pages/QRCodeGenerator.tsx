import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  InvertedLuminanceSource,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import jsQR from "jsqr";
import { QRCodeCanvas } from "qrcode.react";
import { useState } from "react";

const QRCodeGenerator = () => {
  const [text, setText] = useState("");
  const [qrCodeText, setQrCodeText] = useState("");
  const [decodedText, setDecodedText] = useState("");
  const [decodeStatus, setDecodeStatus] = useState("");
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
      console.log("DEBUG: File selected:", file.name, file.type, file.size);
      setDecodeStatus("Processing image...");
      setDecodedText("");

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

          const performDecode = async (
            imageSource: HTMLImageElement | HTMLCanvasElement,
            isRetry = false,
          ) => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", {
              willReadFrequently: true,
            });
            if (!context) {
              throw new Error("Could not create canvas context");
            }

            let width = imageSource.width;
            let height = imageSource.height;

            // If not a retry and the image is small/dense, we might want to upscale it later.
            // For now, let's handle the initial scaling (downscaling for very large images)
            if (!isRetry) {
              const MAX_DIMENSION = 2000;
              if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                const ratio = Math.min(
                  MAX_DIMENSION / width,
                  MAX_DIMENSION / height,
                );
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
                console.log("DEBUG: Image resized to", width, "x", height);
              }
            }

            canvas.width = width;
            canvas.height = height;
            context.drawImage(imageSource, 0, 0, width, height);

            console.log(
              `DEBUG: Starting decode process (retry: ${isRetry}, size: ${width}x${height})`,
            );
            setDecodeStatus(
              isRetry
                ? "Retrying with upscaled image..."
                : "Decoding QR code...",
            );

            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
            hints.set(DecodeHintType.TRY_HARDER, true);

            const zxingReader = new MultiFormatReader();
            zxingReader.setHints(hints);

            const imageData = context.getImageData(0, 0, width, height);
            const rgba = imageData.data;
            const luminances = new Uint8ClampedArray(width * height);

            for (let i = 0; i < luminances.length; i++) {
              const r = rgba[i * 4];
              const g = rgba[i * 4 + 1];
              const b = rgba[i * 4 + 2];
              luminances[i] = (r * 76 + g * 150 + b * 29) >> 8;
            }

            const luminanceSource = new RGBLuminanceSource(
              luminances,
              width,
              height,
            );

            const zxingDecode = (
              source: RGBLuminanceSource | InvertedLuminanceSource,
              label: string,
            ) => {
              console.log(`DEBUG: Attempting ZXing decode (${label})`);
              try {
                const bitmap = new BinaryBitmap(new HybridBinarizer(source));
                return zxingReader.decode(bitmap);
              } catch {
                try {
                  const bitmap = new BinaryBitmap(
                    new GlobalHistogramBinarizer(source),
                  );
                  return zxingReader.decode(bitmap);
                } catch {
                  return null;
                }
              }
            };

            let result = zxingDecode(luminanceSource, "Normal");
            if (!result) {
              console.log("DEBUG: Normal ZXing failed, trying inverted");
              const invertedSource = new InvertedLuminanceSource(
                luminanceSource,
              );
              result = zxingDecode(invertedSource, "Inverted");
            }

            if (result) {
              let decoded = result.getText();
              console.log("DEBUG: ZXing success:", decoded);
              if (decoded === "" && result.getRawBytes()) {
                const binary = result.getRawBytes();
                try {
                  const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(
                    binary,
                  );
                  if (utf8.length > 0) {
                    console.log("DEBUG: ZXing manual UTF-8 success");
                    decoded = utf8;
                  }
                } catch {
                  try {
                    const sjis = new TextDecoder("shift-jis", {
                      fatal: true,
                    }).decode(binary);
                    if (sjis.length > 0) {
                      console.log("DEBUG: ZXing manual Shift-JIS success");
                      decoded = sjis;
                    }
                  } catch {
                    // Fail to decode as text
                  }
                }
              }
              return decoded;
            }

            console.log("DEBUG: ZXing failed, trying jsQR");
            const code = jsQR(rgba, width, height, {
              inversionAttempts: "attemptBoth",
            });

            if (code) {
              console.log(
                "DEBUG: jsQR success, data length:",
                code.data.length,
                "binary length:",
                code.binaryData.length,
              );
              // If data is empty but binaryData exists, it's still a "success" in terms of finding it
              if (code.data === "" && code.binaryData.length > 0) {
                const binary = new Uint8Array(code.binaryData);
                // Try manual decode
                try {
                  const utf8 = new TextDecoder("utf-8", {
                    fatal: true,
                  }).decode(binary);
                  if (utf8.length > 0) {
                    console.log("DEBUG: jsQR manual UTF-8 success");
                    return utf8;
                  }
                } catch {
                  try {
                    const sjis = new TextDecoder("shift-jis", {
                      fatal: true,
                    }).decode(binary);
                    if (sjis.length > 0) {
                      console.log("DEBUG: jsQR manual Shift-JIS success");
                      return sjis;
                    }
                  } catch {
                    // Fail to decode as text
                  }
                }
                return `[Decoded empty string, but found ${code.binaryData.length} bytes of binary data]`;
              }
              return code.data;
            }

            return null;
          };

          try {
            let finalResult = await performDecode(img);

            // If failed (or yielded only placeholder) and image is relatively small, try upscaling it 2x
            const isPlaceholder =
              finalResult?.startsWith("[Decoded empty string") ?? false;

            if (
              (finalResult === null || isPlaceholder) &&
              img.width < 1000 &&
              img.height < 1000
            ) {
              console.log(
                `DEBUG: Initial decode result (${finalResult}) unsatisfactory, trying upscale retry`,
              );
              const upscaleCanvas = document.createElement("canvas");
              upscaleCanvas.width = img.width * 2;
              upscaleCanvas.height = img.height * 2;
              const upscaleCtx = upscaleCanvas.getContext("2d");
              if (upscaleCtx) {
                // Use better image smoothing for upscale
                upscaleCtx.imageSmoothingEnabled = true;
                upscaleCtx.imageSmoothingQuality = "high";
                upscaleCtx.drawImage(
                  img,
                  0,
                  0,
                  upscaleCanvas.width,
                  upscaleCanvas.height,
                );
                const retryResult = await performDecode(upscaleCanvas, true);
                console.log("DEBUG: Upscale retry result:", retryResult);
                // Only use retryResult if it's better than the initial result
                if (retryResult !== null) {
                  const isRetryPlaceholder = retryResult.startsWith(
                    "[Decoded empty string",
                  );
                  if (!isRetryPlaceholder || isPlaceholder) {
                    finalResult = retryResult;
                  }
                }
              }
            }

            if (finalResult !== null) {
              console.log("DEBUG: Setting final decoded text");

              if (finalResult === "") {
                setDecodedText("[Empty string decoded]");
              } else {
                setDecodedText(finalResult);
              }
              setDecodeStatus("Successfully decoded!");
            } else {
              setDecodedText("");
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
        {(decodeStatus || decodedText) && (
          <div className="decoded-result">
            <h3>Decoded Result:</h3>
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
