const CHUNK_SIZE = 8192;

/**
 * Convert a Uint8Array to base64 without overflowing the call stack.
 * String.fromCodePoint(...bytes) fails for arrays larger than ~120k elements.
 */
export const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCodePoint(...chunk);
  }
  return btoa(binary);
};
