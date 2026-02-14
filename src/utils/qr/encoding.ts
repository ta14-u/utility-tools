/**
 * 複数のバイトセグメントを1つのUint8Arrayに結合する
 * @param segments - 結合するバイトセグメントの配列
 * @returns 結合されたバイト配列
 */
export const joinByteSegments = (segments: Uint8Array[]) => {
  const totalLength = segments.reduce(
    (sum, segment) => sum + segment.length,
    0,
  );
  const joined = new Uint8Array(totalLength);
  let offset = 0;
  for (const segment of segments) {
    joined.set(segment, offset);
    offset += segment.length;
  }
  return joined;
};

/**
 * 指定されたエンコーディングでバイト配列をテキストとしてデコードする
 * @param bytes - デコードするバイト配列
 * @param label - エンコーディングラベル（例: 'utf-8', 'shift-jis'）
 * @param fatal - trueの場合、無効なシーケンスでエラーをスローする
 * @returns デコードされた文字列、またはデコードに失敗した場合はnull
 */
export const tryDecodeAsText = (
  bytes: Uint8Array | null,
  label: string,
  fatal: boolean,
) => {
  if (!bytes || bytes.length === 0) {
    return null;
  }
  try {
    return new TextDecoder(label, { fatal }).decode(bytes);
  } catch {
    return null;
  }
};

/**
 * デコードされたテキストと元のバイト配列を比較してエンコーディングを検出する
 * UTF-8とShift-JISでデコードを試行し、元のテキストと一致するものを返す
 * @param bytes - チェックするバイト配列
 * @param decodedText - 比較対象の元のデコード済みテキスト
 * @returns 検出されたエンコーディング名（"UTF-8", "Shift-JIS"）、または検出できなかった場合は "Unknown"
 */
export const detectEncoding = (
  bytes: Uint8Array | null,
  decodedText: string,
): string => {
  if (!bytes || bytes.length === 0) {
    return "Unknown";
  }

  const utf8 = tryDecodeAsText(bytes, "utf-8", true);
  if (utf8 !== null && utf8 === decodedText) {
    return "UTF-8";
  }

  const sjis = tryDecodeAsText(bytes, "shift-jis", true);
  if (sjis !== null && sjis === decodedText) {
    return "Shift-JIS";
  }

  return "Unknown";
};
