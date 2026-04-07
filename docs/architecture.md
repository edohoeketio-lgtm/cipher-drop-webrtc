# Cipher Drop (Zero-Knowledge Encryption App)

This plan outlines the architecture and UI construction for a standalone, brutalist encryption web app. Because we want to ship this immediately without configuring external databases like Firebase or Supabase, it is built as a Zero-Knowledge Architecture.

## The Pivot
Instead of dealing with databases, we build an incredibly impressive Zero-Knowledge Encrypter. The user types a message, and it is encrypted locally inside their browser's V8 engine using the Web Crypto API (AES-GCM). It outputs a massive, terrifying-looking Base64 cipher block. They send that block to a friend via email/Slack, and the friend uses your site to decrypt it.

Why this looks good on a portfolio: It proves an understanding of client-side security, cryptography (window.crypto.subtle), ArrayBuffer manipulation, and zero-trust engineering.

## Proposed Architecture
- **A highly aggressive, purely brutalist UI.**
- **Deep black background, lime green (#e0ff4f) accents, huge monospace fonts.**
- **Two tabs/modes:** ENCRYPT and DECRYPT.
  - **Encrypt View:** A large `<textarea>` for the secret, an input for a password, and a massive "LOCK" button.
  - **Decrypt View:** A `<textarea>` for pasting the cipher, a password input, and a "DECRYPT" button.
- **Crypto Engine:** Utilize `window.crypto.subtle.importKey` and `window.crypto.subtle.encrypt` using AES-GCM. Handle password hashing via PBKDF2. Provide functions to encode/decode ArrayBuffers to standard Base64 text.

## URL Injection
Since we are doing zero-knowledge, the output will be a block of random text. We can automatically inject the cipher into the URL (e.g., `#cipher=...`) so someone can just click a link, making it easier than copying and pasting big blocks.
