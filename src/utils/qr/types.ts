/**
 * QRコードのデコード結果
 * @property text - デコードされたテキスト
 * @property encoding - 検出されたエンコーディング（Alphanumeric mode, Numeric mode, UTF-8, UTF-8 (Byte mode), Shift-JIS, Shift-JIS (Byte mode), Shift-JIS (Kanji mode), Binary, Unknown, Unknown (Byte mode)）
 */
export type DecodeResult = {
  text: string;
  encoding: string;
};

/**
 * ステータス更新コールバック関数の型
 * デコード処理の進捗状況をUIに通知するために使用される
 * @param status - ステータスメッセージ（例: "Decoding QR code...", "Retrying with upscaled image..."）
 */
export type StatusHandler = (status: string) => void;

/**
 * QRコードのエンコード結果
 * @property matrix - QRコードのマトリックス（2次元配列）。1が黒、0が白を表す
 * @property size - QRコードのサイズ（幅と高さ）
 */
export type QRCodeResult = {
  matrix: number[][];
  size: number;
};
