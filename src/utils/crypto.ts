export async function hashString(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.substring(0, 24); // 24 hex chars is plenty for PeerJS collision avoidance
}

export async function deriveKey(code: string): Promise<CryptoKey> {
  return new Promise((resolve, reject) => {
    // Spawn worker to handle 100k PBKDF2 iterations off the main thread.
    // Using native ES modules worker syntax for Vite.
    const worker = new Worker(new URL('./crypto.worker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = async (e) => {
      const { success, rawBits, error } = e.data;
      if (success && rawBits) {
        try {
          const key = await crypto.subtle.importKey(
            'raw',
            rawBits,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
          );
          resolve(key);
        } catch (importErr) {
          reject(importErr);
        }
      } else {
        reject(new Error(error || 'Worker derivation failed'));
      }
      worker.terminate();
    };

    worker.onerror = (e) => {
      reject(new Error(`Worker error: ${e.message}`));
      worker.terminate();
    };

    worker.postMessage({ code });
  });
}

export async function encryptBuffer(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result.buffer;
}

export async function decryptBuffer(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const buffer = new Uint8Array(data);
  const iv = buffer.slice(0, 12);
  const ciphertext = buffer.slice(12);

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
}
