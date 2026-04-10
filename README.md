# Cipher Drop

> **A fast, serverless peer-to-peer messaging and zero-knowledge file sharing experiment.**

Cipher Drop is a browser-native WebRTC app built to test client-side encryption and P2P data channels. It lets peers exchange messages and media directly over the network—no backend database, no intermediate storage, and no plaintext ever leaving the browser. 

![Cipher Drop Architecture Overview](docs/hero-placeholder.png)

## Architecture

This project skips the server entirely and handles all state, binary streaming, and cryptography directly on the client.

- **Zero-Knowledge:** There is no backend storage. The signaling server just handles the initial WebRTC handshake. After that, everything flows directly over SCTP data channels.
- **Real-Time AES-GCM:** Every strict payload (messages, file chunks, typing logic) is independently encrypted and decrypted on the fly via the WebCrypto API.
- **Web Worker Key Derivation:** To keep the React thread from locking up, we throw 100,000 iterations of PBKDF2 into a Web Worker to derive the symmetric master key from the room passphrase.
- **Ephemeral DRM-Lite:** Media assets use a "Click-to-Reveal" UI that blocks right-clicks and drag-and-drops. Unused or timed-out assets are purged from memory (`URL.revokeObjectURL()`).
- **Signaling Watchdog:** Free signaling nodes tend to drop idle WebSockets. The host runs a polling heartbeat to force silent reconnects if the socket dies, keeping the room alive for late joiners.

## Tech Stack

- **Framework:** React 18 / TypeScript
- **Build Tool:** Vite (compiles to a < 100kb payload)
- **Networking:** WebRTC Data Channels (PeerJS wrapper)
- **Cryptography:** Native WebCrypto API (`AES-GCM`, `PBKDF2`, `SHA-256`)
- **Styling:** Brutalist UI with pure CSS variables

## Local Development

To run this locally:

```bash
git clone https://github.com/edohoeketio-lgtm/cipher-drop-webrtc.git
cd cipher-drop-webrtc
npm install
npm run dev
```

Visit `http://localhost:5173`. Open a second incognito window to act as the joining peer.

## Continuous Integration

GitHub Actions handles the CI pipeline. Pushes to `master` automatically trigger static type checking (`tsc`) and generate the optimized production static bundle (`vite build`).

## License

MIT License.
