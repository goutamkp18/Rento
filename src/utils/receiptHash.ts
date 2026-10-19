/**
 * Computes a cryptographic SHA-256 content hash of an uploaded receipt image.
 * Used for detecting duplicate, repeated, or re-uploaded receipts across different user accounts.
 */
export async function computeReceiptHash(fileOrBuffer: File | Blob | ArrayBuffer): Promise<string> {
  try {
    let arrayBuffer: ArrayBuffer;

    if (fileOrBuffer instanceof ArrayBuffer) {
      arrayBuffer = fileOrBuffer;
    } else {
      arrayBuffer = await fileOrBuffer.arrayBuffer();
    }

    const cryptoApi = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto);
    if (cryptoApi && cryptoApi.subtle) {
      const hashBuffer = await cryptoApi.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }

    // Deterministic simple hash fallback if subtle crypto is somehow unavailable
    const bytes = new Uint8Array(arrayBuffer);
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = (hash * 0x01000193) >>> 0;
    }
    return `sha256_mock_${hash.toString(16).padStart(8, '0')}_${bytes.length}`;
  } catch (err) {
    console.warn('[computeReceiptHash] Error computing receipt hash:', err);
    return `hash_err_${Date.now()}`;
  }
}
