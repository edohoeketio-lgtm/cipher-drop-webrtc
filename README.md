# 🔒 Cipher Drop

> **A brutally fast, deeply secure, serverless peer-to-peer messaging and zero-knowledge file sharing network.**

Cipher Drop is a completely browser-native communication experiment built to demonstrate high-performance WebRTC data channeling and real-time cryptographic implementations. It allows peers to exchange messages and heavily encrypted media directly over the network without a backend database or intermediate storage ever seeing the plaintext data.

![Cipher Drop Architecture Overview](docs/hero-placeholder.png)

## ⚡ Core Engineering & Architecture

This project was built to solve complex state management, binary streaming, and client-side cryptographic challenges without relying on server-side crutches.

- **Zero-Knowledge Architecture:** No backend storage. The signaling server is only used to establish the initial WebRTC tunnel between peers. Once established, all data travels direct via SCTP data channels.
- **Real-Time AES-GCM Encryption:** Every single payload (messages, file chunks, typing indicators) is individually encrypted and decrypted on the fly using the WebCrypto API.
- **Web Worker Key Derivation:** We use 100,000 iterations of PBKDF2 to derive a symmetric master key from the room passphrase. This computationally heavy task is seamlessly offloaded to dedicated Web Workers to prevent the React main thread from freezing.
- **Ephemeral DRM-Lite:** Media assets are protected using a "Click-to-Reveal" architecture with custom React overlays that aggressively prevent right-clicks, drag-and-drops, and natively purges object memory (`URL.revokeObjectURL()`) when timed assets expire.
- **Smart Signaling Watchdog:** Implements an aggressive polling heartbeat that silently forces the Host to reconnect to free peer-relay signaling nodes if they drop idle websockets, ensuring bulletproof room availability.

## 🛠 Tech Stack

- **Framework:** React 18 / TypeScript
- **Build Tool:** Vite (Ultra-fast HMR and optimized `< 100kb` production bundles)
- **Networking:** WebRTC Data Channels (PeerJS for signaling wrapper)
- **Cryptography:** Native browser WebCrypto API (`AES-GCM`, `PBKDF2`, `SHA-256`)
- **Styling:** Custom Brutalist UI / Pure CSS variables

## 🚀 Local Development

To run this project locally:

```bash
# Clone the repository
git clone https://github.com/edohoeketio-lgtm/cipher-drop-webrtc.git

# Navigate to the directory
cd cipher-drop-webrtc

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

Visit `http://localhost:5173` to view the app. Open a second, separate browser window to act as the second peer!

## 📦 Continuous Integration

This repository is configured with automated GitHub Actions. Every push to the `master` branch triggers the CI pipeline to perform static type checking (`tsc`) and generate the optimized production static bundle (`vite build`). The total uncompressed application footprint is engineered to stay strictly under 1 MB.

## 🛡️ License

MIT License. Open for educational and cryptographic review.
