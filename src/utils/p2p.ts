import Peer, { type DataConnection } from "peerjs";
import { encryptBuffer, decryptBuffer } from './crypto';

export type Payload = 
  | { type: 'text', data: string, expiry?: number, id?: string, peerId?: string }
  | { type: 'sys-nuke' }
  | { type: 'sys-room-update', size: number }
  | { type: 'file-metadata', fileId: string, name: string, mimeType: string, totalSize: number, totalChunks: number, peerId?: string, expiry?: number }
  | { type: 'file-ready', fileId: string, blob: Blob, name: string, peerId?: string, expiry?: number }
  | { type: 'sys-identity', peerId: string, codename: string }
  | { type: 'sys-error', message: string }
  | { type: 'sys-typing', peerId: string, isTyping: boolean };

type ConnectionListener = (payload: Payload) => void;
type StatusListener = (status: 'disconnected' | 'connecting' | 'connected' | 'error', message?: string) => void;
type ProgressListener = (fileId: string, transferred: number, total: number, isUpload: boolean) => void;

interface IncomingFile {
  meta: Extract<Payload, { type: 'file-metadata' }>;
  chunks: ArrayBuffer[];
  receivedChunks: number;
  receivedBytes: number;
}

const CHUNK_SIZE = 64 * 1024; // 64KB
const MAX_BUFFER_AMOUNT = 1 * 1024 * 1024; // 1MB backpressure threshold
const WEBRTC_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      { 
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  },
  pingInterval: 5000,
  debug: 1
};

export const GROUP_FILE_LIMIT = 50 * 1024 * 1024; // 50MB



export class WebRTCEngine {
  private peer: Peer | null = null;
  public conns: Map<string, DataConnection> = new Map();
  
  private onDataCallback: ConnectionListener | null = null;
  private onStatusCallback: StatusListener | null = null;
  private onProgressCallback: ProgressListener | null = null;

  public isHost: boolean = false;
  private cryptoKey: CryptoKey | null = null;
  public roomSize: number = 1;
  public localCodename: string = "UNKNOWN";
  private hasErrored: boolean = false;
  
  private incomingFiles: Map<string, IncomingFile> = new Map();

  constructor(onData: ConnectionListener, onStatus: StatusListener, onProgress: ProgressListener) {
    this.onDataCallback = onData;
    this.onStatusCallback = onStatus;
    this.onProgressCallback = onProgress;
  }

  private setStatus(status: 'disconnected' | 'connecting' | 'connected' | 'error') {
    if (this.onStatusCallback) this.onStatusCallback(status);
  }

  public host(hashedId: string, key: CryptoKey) {
    this.isHost = true;
    this.cryptoKey = key;
    this.setStatus('connecting');
    this.peer = new Peer(`cdropv1-${hashedId}`, WEBRTC_CONFIG);

    // Watchdog to aggressively bypass free tier stealth drops
    const watchdog = setInterval(() => {
        if (!this.peer || this.peer.destroyed) {
            clearInterval(watchdog);
            return;
        }
        if (this.peer.disconnected) {
            this.peer.reconnect();
        }
    }, 5000);

    this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
           this.peer.reconnect();
        }
    });

    this.peer.on('error', (err: any) => {
      console.error("Peer Error:", err);
      this.hasErrored = true;
      if (this.onDataCallback) this.onDataCallback({ type: 'sys-error', message: err.type || err.message });
      this.setStatus('error');
    });

    this.peer.on('open', () => {
       this.roomSize = 1; 
    });

    this.peer.on('connection', (connection) => {
      this.conns.set(connection.peer, connection);
      this.setupConnection(connection);
    });
  }

  private broadcastRoomSize() {
      if (!this.isHost) return;
      this.roomSize = this.conns.size + 1;
      this.sendPayload({ type: 'sys-room-update', size: this.roomSize });
  }

  public join(hashedId: string, key: CryptoKey) {
    this.isHost = false;
    this.cryptoKey = key;
    this.setStatus('connecting');
    this.peer = new Peer(WEBRTC_CONFIG);

    this.peer.on('disconnected', () => {
        if (this.peer && !this.peer.destroyed) {
           this.peer.reconnect();
        }
    });

    this.peer.on('error', (err: any) => {
      console.error("Peer Error:", err);
      this.hasErrored = true;
      if (this.onDataCallback) this.onDataCallback({ type: 'sys-error', message: err.type || err.message });
      this.setStatus('error');
    });

    this.peer.on('open', () => {
      const conn = this.peer!.connect(`cdropv1-${hashedId}`, { reliable: true });
      this.conns.set(conn.peer, conn);
      this.setupConnection(conn);
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('open', () => {
      if (!this.isHost) {
        this.setStatus('connected');
      } else {
        if (this.conns.size === 1) {
          this.setStatus('connected');
        }
        this.broadcastRoomSize();
      }
      
      // Automatically broadcast own identity to the new connection
      if (this.peer) {
        setTimeout(() => {
          this.sendPayload({ type: 'sys-identity', peerId: this.peer!.id, codename: this.localCodename });
        }, 1000);
      }
    });

    conn.on('data', async (data: unknown) => {
      if (!this.cryptoKey) return;
      const buffer = data as ArrayBuffer;

      // HOST RELAY LOGIC (STAR TOPOLOGY)
      // Broadcast identical encrypted packet to all other connected peers
      if (this.isHost) {
          for (const [peerId, otherConn] of this.conns.entries()) {
              if (peerId !== conn.peer && otherConn.open) {
                 otherConn.send(buffer);
              }
          }
      }

      try {
        const decryptedBuffer = await decryptBuffer(this.cryptoKey, buffer);
        await this.handleDecryptedPacket(decryptedBuffer);
      } catch (err) {
         console.warn("Decryption failure or rogue packet dropped.", err);
      }
    });

    const handleDrop = () => {
       this.conns.delete(conn.peer);
       if (this.isHost) {
          this.broadcastRoomSize();
       } else {
          // Dead-Man's Switch
          if (!this.hasErrored) {
              this.setStatus('disconnected');
          }
          this.triggerLocalNuke();
       }
    }

    conn.on('close', handleDrop);
    conn.on('error', handleDrop);

    if (conn.peerConnection) {
        conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
            const state = conn.peerConnection.iceConnectionState;
            if (['failed', 'closed'].includes(state)) {
                handleDrop();
            }
        });
    }
  }

  private triggerLocalNuke() {
      if (this.onDataCallback) {
          this.onDataCallback({ type: 'sys-nuke' });
      }
  }

  private async handleDecryptedPacket(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    const packetType = bytes[0];

    if (packetType === 0) {
      // JSON Metadata / Text Payload
      const jsonStr = new TextDecoder().decode(bytes.slice(1));
      const payload = JSON.parse(jsonStr) as Payload;
      
      if (payload.type === 'file-metadata') {
        this.incomingFiles.set(payload.fileId, {
          meta: payload,
          chunks: new Array(payload.totalChunks),
          receivedChunks: 0,
          receivedBytes: 0
        });
      }

      if (payload.type === 'sys-room-update') {
          this.roomSize = payload.size;
      }
      
      if (this.onDataCallback) {
          this.onDataCallback(payload);
      }
      
    } else if (packetType === 1) {
      // Binary File Chunk
      // Format: [1 byte type] [36 bytes fileId] [4 bytes chunkIndex] [data]
      const fileIdBytes = bytes.slice(1, 37);
      const fileId = new TextDecoder().decode(fileIdBytes).trim();
      const chunkIndex = new DataView(buffer).getUint32(37, true);
      const chunkData = buffer.slice(41);

      const incoming = this.incomingFiles.get(fileId);
      if (incoming) {
        incoming.chunks[chunkIndex] = chunkData;
        incoming.receivedChunks++;
        incoming.receivedBytes += chunkData.byteLength;

        if (this.onProgressCallback) {
          this.onProgressCallback(fileId, incoming.receivedBytes, incoming.meta.totalSize, false);
        }

        if (incoming.receivedChunks === incoming.meta.totalChunks) {
          // File completion! Construct blob
          const blob = new Blob(incoming.chunks, { type: incoming.meta.mimeType });
          this.incomingFiles.delete(fileId); // Cleanup RAM
          
          if (this.onDataCallback) {
            this.onDataCallback({
              type: 'file-ready',
              fileId: incoming.meta.fileId,
              blob,
              name: incoming.meta.name,
              peerId: incoming.meta.peerId, // Keep peer ID for UI
              expiry: incoming.meta.expiry  // Propagate expiry from metadata
            } as Payload);
          }
        }
      }
    }
  }

  private async sendPacket(packetBuffer: ArrayBuffer) {
    if (!this.cryptoKey) return;
    const encrypted = await encryptBuffer(this.cryptoKey, packetBuffer);
    
    for (const conn of this.conns.values()) {
        if (conn.open) {
            conn.send(encrypted);
        }
    }
  }

  private async sendPayload(payload: Payload) {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(payload));
    const packetBuffer = new Uint8Array(1 + jsonBytes.byteLength);
    packetBuffer[0] = 0; 
    packetBuffer.set(jsonBytes, 1);
    await this.sendPacket(packetBuffer.buffer);
  }

  public async sendText(text: string, expiry?: number): Promise<string> {
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    await this.sendPayload({ type: 'text', data: text, expiry, id, peerId: this.peer?.id });
    return id;
  }

  public async sendNuke() {
      if (this.isHost) {
          await this.sendPayload({ type: 'sys-nuke' });
          this.triggerLocalNuke();
      }
  }

  public async sendIdentity(codename: string) {
      if (!this.peer) return;
      this.localCodename = codename;
      await this.sendPayload({ type: 'sys-identity', peerId: this.peer.id, codename });
  }

  public async sendTyping(isTyping: boolean) {
      if (!this.peer) return;
      await this.sendPayload({ type: 'sys-typing', peerId: this.peer.id, isTyping });
  }

  public async sendFile(file: File, expiry?: number) {
    if (!this.cryptoKey || this.conns.size === 0) return;

    if (this.roomSize > 2 && file.size > GROUP_FILE_LIMIT) {
        throw new Error(`File size ${Math.round(file.size/1024/1024)}MB exceeds 50MB group limit.`);
    }

    // 1. Generate unique file ID
    const fileId = crypto.randomUUID();
    const totalSize = file.size;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    // 2. Send Metadata
    await this.sendPayload({
      type: 'file-metadata',
      fileId,
      name: file.name,
      mimeType: file.type,
      totalSize,
      totalChunks,
      peerId: this.peer?.id,
      expiry
    });

    // 3. Begin Chunking Loop with Backpressure
    let offset = 0;
    let chunkIndex = 0;
    const fileIdBytes = new TextEncoder().encode(fileId.padEnd(36, ' '));

    while (offset < totalSize) {
      // Respect backpressure across ALL connections
      let isCongested = true;
      while (isCongested) {
         isCongested = false;
         for (const conn of this.conns.values()) {
             if (conn.open && conn.dataChannel && conn.dataChannel.bufferedAmount > MAX_BUFFER_AMOUNT) {
                 isCongested = true;
             }
         }
         if (isCongested) {
             await new Promise<void>(resolve => setTimeout(resolve, 10));
         }
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const chunkData = await slice.arrayBuffer();
      
      const chunkHeader = new ArrayBuffer(4);
      new DataView(chunkHeader).setUint32(0, chunkIndex, true);
      
      const packetBuffer = new Uint8Array(1 + 36 + 4 + chunkData.byteLength);
      packetBuffer[0] = 1; // Chunk type
      packetBuffer.set(fileIdBytes, 1);
      packetBuffer.set(new Uint8Array(chunkHeader), 1 + 36);
      packetBuffer.set(new Uint8Array(chunkData), 1 + 36 + 4);

      await this.sendPacket(packetBuffer.buffer);

      offset += chunkData.byteLength;
      chunkIndex++;

      if (this.onProgressCallback) {
        this.onProgressCallback(fileId, offset, totalSize, true);
      }
    }
  }

  public disconnect() {
    for (const conn of this.conns.values()) {
        conn.close();
    }
    this.conns.clear();
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.setStatus('disconnected');
    this.roomSize = 1;
  }
}
