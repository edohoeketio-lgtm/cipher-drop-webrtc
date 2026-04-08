const STATIC_SALT = new TextEncoder().encode('cipher-drop-v2-salt-strong-v1');

self.onmessage = async (e: MessageEvent<{ code: string }>) => {
  try {
    const { code } = e.data;
    
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(code),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const rawBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: STATIC_SALT,
        iterations: 100000, 
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );

    self.postMessage({ success: true, rawBits });
  } catch (err: unknown) {
    self.postMessage({ success: false, error: err instanceof Error ? err.message : 'Unknown crypto error' });
  }
};
