import React, { useState, useEffect, useRef } from 'react';
import { Shield, Fingerprint, XSquare, Send, Upload } from 'lucide-react';
import { WebRTCEngine, Payload } from './utils/p2p';
import { generateRoomCode } from './utils/wordlist';

type AppState = 'lobby' | 'joining' | 'hosting' | 'chat';

export default function App() {
  const [appState, setAppState] = useState<AppState>('lobby');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [status, setStatus] = useState<string>('disconnected');
  const [messages, setMessages] = useState<Payload[]>([]);
  const [textInput, setTextInput] = useState('');

  const engineRef = useRef<WebRTCEngine | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initEngine = () => {
    if (engineRef.current) engineRef.current.disconnect();
    
    engineRef.current = new WebRTCEngine(
      (payload) => setMessages((prev) => [...prev, payload]),
      (newStatus) => {
        setStatus(newStatus);
        if (newStatus === 'connected') setAppState('chat');
        if (newStatus === 'disconnected' || newStatus === 'error') {
          setAppState('lobby');
          alert(newStatus === 'error' ? 'Connection Error!' : 'Peer Disconnected.');
        }
      }
    );
  };

  const handleHost = () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setAppState('hosting');
    initEngine();
    engineRef.current?.host(code);
  };

  const handleJoinInit = () => {
    setAppState('joining');
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput) return;
    initEngine();
    engineRef.current?.join(joinCodeInput.trim().toUpperCase());
  };

  const handleDisconnect = () => {
    engineRef.current?.disconnect();
    setAppState('lobby');
    setMessages([]);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !engineRef.current) return;
    const payload: Payload = { type: 'text', data: textInput };
    // Optimistic local update
    setMessages((prev) => [...prev, payload]);
    engineRef.current.sendText(textInput);
    setTextInput('');
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      engineRef.current?.sendFile(file);
      // We don't optimistically render files locally to save memory, 
      // just a text stub to confirm it sent.
      setMessages((prev) => [...prev, { type: 'text', data: `[SENT FILE: ${file.name}]` }]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Renders the correct blob preview
  const renderPayload = (msg: Payload, index: number) => {
    if (msg.type === 'text') {
      return <div key={index} style={{ marginBottom: '16px', overflowWrap: 'break-word' }}>&gt; {msg.data}</div>;
    }
    
    // Convert ArrayBuffer back to an object URL for rendering
    const blob = new Blob([msg.data], { type: msg.mimeType });
    const url = URL.createObjectURL(blob);

    return (
      <div key={index} className="brutal-border" style={{ padding: '8px', marginBottom: '16px', display: 'inline-block' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--neon-green)', marginBottom: '8px' }}>[RCV: {msg.name}]</div>
        {msg.type === 'image' && <img src={url} alt="received" style={{ maxWidth: '300px', display: 'block' }} />}
        {msg.type === 'audio' && <audio src={url} controls style={{ display: 'block' }} />}
        {msg.type === 'file' && <a href={url} download={msg.name} style={{ color: 'var(--neon-green)' }}>Download {msg.name}</a>}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      
      {/* Header */}
      <h1 style={{ fontSize: '3rem', textTransform: 'uppercase', marginBottom: '40px', textAlign: 'center', letterSpacing: '-2px' }}>
        <Shield size={48} style={{ verticalAlign: 'middle', marginRight: '16px', color: 'var(--neon-green)' }} />
        Cipher Drop
      </h1>

      {appState === 'lobby' && (
        <div style={{ display: 'flex', gap: '24px', flexDirection: 'column', width: '100%', maxWidth: '400px' }}>
          <button className="brutal-button" style={{ padding: '24px', fontSize: '1.5rem' }} onClick={handleHost}>
            Host Drop
          </button>
          <button className="brutal-button" style={{ padding: '24px', fontSize: '1.5rem' }} onClick={handleJoinInit}>
            Join Drop
          </button>
          <p style={{ textAlign: 'center', opacity: 0.6, fontSize: '0.9rem', marginTop: '32px' }}>
            A stateless, zero-knowledge, WebRTC transient drop point. <br />Nothing is saved.
          </p>
        </div>
      )}

      {appState === 'joining' && (
        <form onSubmit={handleJoinSubmit} style={{ width: '100%', maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: 'var(--neon-green)' }}>ENTER HOST CODE:</p>
          <input 
            type="text" 
            className="brutal-input" 
            placeholder="e.g. NEON-WOLF-ECHO-BASE" 
            value={joinCodeInput} 
            onChange={e => setJoinCodeInput(e.target.value)} 
            autoFocus 
          />
          <button type="submit" className="brutal-button" disabled={status === 'connecting'}>
            {status === 'connecting' ? 'CONNECTING...' : 'INITIATE CONNECTION'}
          </button>
          <button type="button" onClick={() => setAppState('lobby')} style={{ background: 'none', border: 'none', color: 'var(--text-white)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'monospace' }}>
            Cancel
          </button>
        </form>
      )}

      {appState === 'hosting' && (
        <div className="brutal-border-green brutal-shadow" style={{ padding: '48px', width: '100%', maxWidth: '600px', textAlign: 'center' }}>
          <Fingerprint size={64} style={{ color: 'var(--neon-green)', marginBottom: '24px' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>YOUR OVERRIDE CODE</h2>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '2px', color: 'var(--neon-green)', wordBreak: 'break-all' }}>
            {roomCode}
          </div>
          <p style={{ marginTop: '32px' }}>
            {status === 'connecting' ? 'WAITING FOR PEER TO CONNECT...' : 'ERROR: REFRESH'}
          </p>
          <button onClick={handleDisconnect} className="brutal-button" style={{ marginTop: '24px', fontSize: '1rem', padding: '8px 16px', borderColor: 'var(--error-red)', color: 'var(--error-red)' }}>
            Abort
          </button>
        </div>
      )}

      {appState === 'chat' && (
        <div 
          className="brutal-border" 
          style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', height: '70vh' }}
          onDrop={handleFileDrop}
          onDragOver={handleDragOver}
        >
          {/* View Toolbar */}
          <div style={{ padding: '16px', borderBottom: '2px solid var(--text-white)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--neon-green)' }}>●</span> PEER CONNECTED (E2E)
            </div>
            <button onClick={handleDisconnect} style={{ background: 'none', border: 'none', color: 'var(--error-red)', cursor: 'pointer' }}>
              <XSquare />
            </button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            {messages.length === 0 && (
              <div style={{ opacity: 0.5, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                TUNNEL ACTIVE.<br/>Drag & Drop files here, or type below.
              </div>
            )}
            {messages.map((msg, idx) => renderPayload(msg, idx))}
            <div ref={messagesEndRef} />
          </div>

          {/* Drag Overlay Hint */}
          <div style={{ padding: '8px', borderTop: '2px solid var(--dim-gray)', fontSize: '0.8rem', opacity: 0.7, textAlign: 'center' }}>
            <Upload size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            DRAG FILES ANYWHERE TO SEND
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendText} style={{ display: 'flex', borderTop: '2px solid var(--text-white)' }}>
            <input 
              type="text" 
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="Inject payload..."
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--neon-green)', padding: '24px', fontSize: '1.2rem', fontFamily: 'Space Mono, monospace', outline: 'none' }}
              autoFocus
            />
            <button type="submit" style={{ padding: '0 32px', background: 'var(--text-white)', color: 'var(--bg-black)', border: 'none', cursor: 'pointer' }}>
              <Send />
            </button>
          </form>
        </div>
      )}

    </div>
  );
}
