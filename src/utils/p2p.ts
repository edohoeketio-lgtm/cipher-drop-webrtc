import { Peer, DataConnection } from "peerjs";

export type Payload = 
  | { type: 'text', data: string }
  | { type: 'image', data: ArrayBuffer, mimeType: string, name: string }
  | { type: 'audio', data: ArrayBuffer, mimeType: string, name: string }
  | { type: 'file', data: ArrayBuffer, mimeType: string, name: string };

type ConnectionListener = (payload: Payload) => void;
type StatusListener = (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;

export class WebRTCEngine {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  
  private onDataCallback: ConnectionListener | null = null;
  private onStatusCallback: StatusListener | null = null;

  public isHost: boolean = false;

  constructor(onData: ConnectionListener, onStatus: StatusListener) {
    this.onDataCallback = onData;
    this.onStatusCallback = onStatus;
  }

  private setStatus(status: 'disconnected' | 'connecting' | 'connected' | 'error') {
    if (this.onStatusCallback) this.onStatusCallback(status);
  }

  // Hosts a new room, forces the ID to be the generated mnemonic code
  public host(roomCode: string) {
    this.isHost = true;
    this.setStatus('connecting');
    // Using a public peerjs server, we'll prefix with 'cdropv1-' to avoid collision
    this.peer = new Peer(`cdropv1-${roomCode}`);

    this.peer.on('open', (id) => {
      // Waiting for connection... handled by UI normally, but we remain in 'connecting' 
      // state until a peer actually joins.
    });

    this.peer.on('connection', (connection) => {
      this.conn = connection;
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.error("Peer Error:", err);
      this.setStatus('error');
    });
  }

  // Joins an existing room
  public join(roomCode: string) {
    this.isHost = false;
    this.setStatus('connecting');
    this.peer = new Peer();

    this.peer.on('open', (id) => {
      // Connect to the host
      this.conn = this.peer!.connect(`cdropv1-${roomCode}`, {
        reliable: true
      });
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.error("Peer Error:", err);
      this.setStatus('error');
    });
  }

  private setupConnection() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.setStatus('connected');
    });

    this.conn.on('data', (data: unknown) => {
      // Cast the received data. PeerJS automatically handles (de)serialization of ArrayBuffers!
      const payload = data as Payload;
      if (this.onDataCallback && payload && payload.type) {
        this.onDataCallback(payload);
      }
    });

    this.conn.on('close', () => {
      this.setStatus('disconnected');
    });
    
    this.conn.on('error', () => {
      this.setStatus('error');
    })
  }

  public sendText(text: string) {
    if (this.conn && this.conn.open) {
      const payload: Payload = { type: 'text', data: text };
      this.conn.send(payload);
    }
  }

  public sendFile(file: File) {
    if (this.conn && this.conn.open) {
      file.arrayBuffer().then(buffer => {
        let type: Payload['type'] = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('audio/')) type = 'audio';
        
        const payload: Payload = {
          type,
          data: buffer,
          mimeType: file.type,
          name: file.name
        };
        this.conn.send(payload);
      });
    }
  }

  public disconnect() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.setStatus('disconnected');
  }
}
