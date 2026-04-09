import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WebRTCEngine, type Payload, GROUP_FILE_LIMIT } from './utils/p2p';
import { generateRoomCode } from './utils/wordlist';
import { deriveKey, hashString } from './utils/crypto';

type AppState = 'lobby' | 'deriving' | 'joining' | 'hosting' | 'chat';

interface TransferState {
  total: number;
  transferred: number;
  isUpload: boolean;
}

function EphemeralMessage({ 
  msg, isMe, timestamp, senderName, onExpunge
}: { 
  msg: Extract<Payload, {type: 'text'}>, isMe: boolean, timestamp: string, senderName: string, onExpunge?: (id: string) => void
}) {
  const isSystem = !isMe && (msg.data.startsWith('E2E_') || msg.data.startsWith('UPLOAD_COMPLETE') || msg.data.startsWith('SYS_') || msg.data.startsWith('ERR_'));
  
  let tag = isMe ? `<LOCAL: ${senderName}>` : `<REMOTE: ${senderName}>`;
  if (isSystem) tag = '<SYS>';

  let color = isMe ? 'var(--text-bright)' : 'var(--accent-cyan)';
  if (isSystem) color = 'var(--text-muted)';

  const [timeLeft, setTimeLeft] = useState<number | null>(msg.expiry || null);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      if (onExpunge && msg.id && msg.data !== '[DATA EXPUNGED]') {
         onExpunge(msg.id);
      }
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev && prev <= 1) {
          clearInterval(timer);
          if (onExpunge && msg.id && msg.data !== '[DATA EXPUNGED]') {
             onExpunge(msg.id);
          }
          return 0;
        }
        return prev ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, msg.id, onExpunge, msg.data]);

  const isExpunged = msg.data === '[DATA EXPUNGED]';
  const timeStr = (timeLeft !== null && !isExpunged) ? ` (💣 ${timeLeft}s)` : '';

  return (
    <div style={{ marginBottom: '4px', overflowWrap: 'break-word', color: isExpunged ? 'var(--text-muted)' : color }}>
      <span style={{ color: 'var(--text-muted)' }}>[{timestamp}] {tag}</span> {msg.data}{timeStr}
    </div>
  );
}

function EphemeralAsset({ 
  msg, isMe, timestamp, senderName, url, onExpunge 
}: { 
  msg: Extract<Payload, {type: 'file-ready'}>, isMe: boolean, timestamp: string, senderName: string, url: string, onExpunge?: (id: string, url: string) => void
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(msg.expiry || null);
  const [isExpunged, setIsExpunged] = useState(msg.name === '[ASSET_EXPUNGED]');

  useEffect(() => {
    if (!isRevealed || timeLeft === null) return;
    if (timeLeft <= 0) {
      if (!isExpunged) {
          setIsExpunged(true);
          if (onExpunge && msg.fileId) onExpunge(msg.fileId, url);
      }
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev && prev <= 1) {
          clearInterval(timer);
          if (!isExpunged) {
             setIsExpunged(true);
             if (onExpunge && msg.fileId) onExpunge(msg.fileId, url);
          }
          return 0;
        }
        return prev ? prev - 1 : 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRevealed, timeLeft, msg.fileId, onExpunge, isExpunged, url]);

  const tag = isMe ? `<LOCAL: ${senderName}>` : `<REMOTE: ${senderName}>`;
  
  if (isExpunged) {
      return (
        <div style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--text-muted)' }}>[{timestamp}] {tag}</span> [DATA_DEAD_DROP: ASSET_EXPUNGED]
        </div>
      );
  }

  const isTimed = msg.expiry !== undefined && msg.expiry > 0;
  const handleReveal = () => setIsRevealed(true);

  const drmProps = isTimed ? {
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onDragStart: (e: React.DragEvent) => e.preventDefault(),
      style: { userSelect: 'none' as const, WebkitUserDrag: 'none' as const }
  } : {};

  return (
    <div style={{ marginBottom: '8px' }}>
        <div style={{ color: 'var(--accent-success)' }}>
            <span style={{ color: 'var(--text-muted)' }}>[{timestamp}] {tag}</span> [RX_COMPLETE: {msg.name} // {Math.floor(msg.blob.size/1024)}KB]
            {isTimed && isRevealed && <span className="blink" style={{ color: 'var(--accent-alert)', marginLeft: '8px' }}>(💣 {timeLeft}s)</span>}
        </div>
        <div style={{ marginLeft: '16px', marginTop: '4px', paddingLeft: '8px', borderLeft: '1px solid var(--border-subtle)' }}>
            {!isRevealed ? (
                <button onClick={handleReveal} className="ghost-button" style={{ color: 'var(--accent-cyan)', padding: '16px', margin: '8px 0', borderStyle: 'dashed' }}>
                   {isTimed ? '[ 👁 DECRYPT_SECURE_ASSET ]' : '[ 👁 REVEAL_ASSET ]'}
                </button>
            ) : (
                <div style={{ position: 'relative', display: 'inline-block', ...drmProps.style }}>
                    {msg.blob.type.startsWith('image/') && <img src={url} alt="asset" {...drmProps} style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '8px 0', border: '1px solid var(--border-subtle)', ...drmProps.style }} />}
                    {msg.blob.type.startsWith('audio/') && <audio src={url} controls={!isTimed} autoPlay={isTimed} {...drmProps} style={{ display: 'block', marginTop: '8px', opacity: 0.8, height: '30px', ...drmProps.style }} />}
                    {msg.blob.type.startsWith('video/') && <video src={url} controls={!isTimed} autoPlay={isTimed} playsInline {...drmProps} style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '8px 0', ...drmProps.style }} />}
                    
                    {/* DRM Overlay to prevent simple right clicking/saving on elements if browser ignores unselectable */}
                    {isTimed && (
                       <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, background: 'transparent' }} onContextMenu={e => e.preventDefault()} />
                    )}
                </div>
            )}
            
            {!isTimed && (
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
                    <a href={url} download={msg.name} style={{ color: 'var(--text-bright)', textDecoration: 'none', display: 'inline-block' }}>
                        <span className="glow-text">» DOWNLOAD_ASSET</span>
                    </a>
                    <button onClick={() => setIsRevealed(false)} className="ghost-button" style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                        [ CONCEAL ]
                    </button>
                </div>
            )}
        </div>
    </div>
  );
}

const generateCodename = () => {
  const prefixes = ['NULL', 'VOID', 'HEX', 'ZERO', 'SYNTH', 'NEON', 'CHROME', 'DATA', 'CIPHER', 'STATIC', 'GLITCH', 'ROGUE'];
  const suffixes = ['ECHO', 'WRAITH', 'RONIN', 'PROPHET', 'WALKER', 'BREAKER', 'BURNER', 'MONK', 'PROTOCOL', 'GHOST', 'NINJA', 'NOMAD'];
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
};

export default function App() {
  const [appState, setAppState] = useState<AppState>('lobby');
  const [localCodename] = useState(generateCodename());
  const [identities, setIdentities] = useState<Record<string, string>>({});
  const [typingPeers, setTypingPeers] = useState<Set<string>>(new Set());
  const [modalData, setModalData] = useState<{title: string, message: string} | null>(null);
  const [sysError, setSysError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [status, setStatus] = useState<string>('DISCONNECTED');
  const [messages, setMessages] = useState<{msg: Payload, isMe: boolean, timestamp: string}[]>([]);
  const [transfers, setTransfers] = useState<Record<string, TransferState>>({});
  const [textInput, setTextInput] = useState('');
  const [expirySelection, setExpirySelection] = useState<number | undefined>(undefined);
  const [roomSize, setRoomSize] = useState(1);

  const engineRef = useRef<WebRTCEngine | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const isManualDisconnectRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transfers]);

  useEffect(() => {
    // Cleanup typing timeout on unmount or drop to prevent memory leaks
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    // Timeout for ICE traversal (STUN/TURN) - Prevents 2 minute spinning
    if (appState === 'deriving' && status === 'CONNECTING') {
       timeoutId = setTimeout(() => {
           setSysError("NETWORK_TIMEOUT: Peer routing blocked by firewall or symmetric NAT.");
           setStatus("DISCONNECTED");
           engineRef.current?.disconnect();
       }, 15000); 
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [appState, status]);

  const getTimestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });

  const addSystemMessage = (text: string) => {
    setMessages(prev => [...prev, { msg: { type: 'text', data: text }, isMe: false, timestamp: getTimestamp() }]);
  };

  const handleNukeReset = () => {
    if (engineRef.current) engineRef.current.disconnect();
    setAppState('lobby');
    setMessages([]);
    setTransfers({});
    setStatus('DISCONNECTED');
    setRoomSize(1);
    addSystemMessage('SYS_NUKE_EXECUTED');
  };

  const initEngine = () => {
    if (engineRef.current) engineRef.current.disconnect();
    
    engineRef.current = new WebRTCEngine(
      (payload) => {
        if (payload.type === 'sys-room-update') {
          setRoomSize(payload.size);
        }
        else if (payload.type === 'sys-nuke') {
          handleNukeReset();
        }
        else if (payload.type === 'text' || payload.type === 'file-ready') {
          setMessages((prev) => [...prev, {msg: payload, isMe: false, timestamp: getTimestamp()}]);
        }
        else if (payload.type === 'sys-identity') {
          setIdentities(prev => ({ ...prev, [payload.peerId]: payload.codename }));
        }
        else if (payload.type === 'sys-typing') {
          setTypingPeers(prev => {
             const next = new Set(prev);
             if (payload.isTyping) next.add(payload.peerId);
             else next.delete(payload.peerId);
             return next;
          });
        }
      },
      (newStatus) => {
        setStatus(newStatus.toUpperCase());
        if (newStatus === 'connected') {
          setAppState('chat');
          if (engineRef.current?.isHost) {
              setRoomSize(1);
          }
          addSystemMessage('E2E_AES_GCM_SECURE_TUNNEL_ESTABLISHED');
        }
        if (newStatus === 'disconnected' || newStatus === 'error') {
          if (!isManualDisconnectRef.current) {
            setModalData({
              title: newStatus === 'error' ? 'FATAL_EXCEPTION' : 'TUNNEL_SEVERED',
              message: newStatus === 'error' ? 'ERR/01: connection_failure' : 'PEER_DISCONNECTED'
            });
          }
          setAppState('lobby');
          isManualDisconnectRef.current = false;
        }
      },
      (fileId, transferred, total, isUpload) => {
        setTransfers(prev => ({ ...prev, [fileId]: { total, transferred, isUpload } }));
        if (isUpload && transferred >= total) {
           setTimeout(() => {
             setTransfers(prev => { const next = { ...prev }; delete next[fileId]; return next; });
             addSystemMessage(`UPLOAD_COMPLETE: ${fileId.substring(0,8)}`);
           }, 1000);
        } else if (!isUpload && transferred >= total) {
           setTimeout(() => {
               setTransfers(prev => { const next = { ...prev }; delete next[fileId]; return next; });
           }, 1000);
        }
      }
    );
  };

  const handleHost = async () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setAppState('deriving');
    setSysError(null);
    try {
      await new Promise(r => setTimeout(r, 50)); 
      if (!window.crypto?.subtle) throw new Error("WebCrypto API not available (requires HTTPS or localhost secure context)");
      const key = await deriveKey(code);
      const hashedId = await hashString(code);
      initEngine();
      engineRef.current!.localCodename = localCodename;
      engineRef.current?.host(hashedId, key);
      setAppState('hosting');
    } catch (e: any) {
      console.error('Derive error:', e);
      setSysError(e.message || e.name || "Unknown derivation error");
    }
  };

  const handleJoinInit = () => setAppState('joining');

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) return;
    setAppState('deriving');
    setSysError(null);
    try {
      await new Promise(r => setTimeout(r, 50)); 
      if (!window.crypto?.subtle) throw new Error("WebCrypto API not available (requires HTTPS or localhost secure context)");
      const key = await deriveKey(code);
      const hashedId = await hashString(code);
      initEngine();
      engineRef.current!.localCodename = localCodename;
      engineRef.current?.join(hashedId, key);
    } catch (e: any) {
      console.error('Derive error:', e);
      setSysError(e.message || e.name || "Unknown derivation error");
    }
  };

  const executeNuke = () => {
      engineRef.current?.sendNuke().catch(console.error);
  };

  const handleDisconnect = () => {
    isManualDisconnectRef.current = true;
    engineRef.current?.disconnect();
    setAppState('lobby');
    setMessages([]);
    setTransfers({});
    setStatus('DISCONNECTED');
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch(e) {
      console.error('Failed to copy', e);
    }
  };

  const handleExpunge = useCallback((id: string) => {
    setMessages(prev => prev.map(m => {
       if (m.msg.type === 'text' && m.msg.id === id) {
           return { ...m, msg: { ...m.msg, data: '[DATA EXPUNGED]' } };
       }
       return m;
    }));
  }, []);

  const handleFileExpunge = useCallback((fileId: string, url: string) => {
    URL.revokeObjectURL(url);
    setMessages(prev => prev.map(m => {
       if (m.msg.type === 'file-ready' && m.msg.fileId === fileId) {
           return { ...m, msg: { ...m.msg, name: '[ASSET_EXPUNGED]', blob: new Blob([new ArrayBuffer(0)]) } };
       }
       return m;
    }));
  }, []);

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !engineRef.current) return;
    const id = await engineRef.current.sendText(textInput, expirySelection);
    const payload: Payload = { type: 'text', data: textInput, expiry: expirySelection, id, peerId: engineRef.current.isHost ? 'host' : 'peer' }; // Just for local render mapping
    setMessages((prev) => [...prev, {msg: payload, isMe: true, timestamp: getTimestamp()}]);
    setTextInput('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    engineRef.current.sendTyping(false);
    lastTypingSentRef.current = 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     setTextInput(e.target.value);
     if (!engineRef.current || appState !== 'chat') return;

     const text = e.target.value;
     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

     if (text.trim() === '') {
         engineRef.current.sendTyping(false);
         lastTypingSentRef.current = 0;
         return;
     }

     const now = Date.now();
     // Slack/WA behavior: Only broadcast 'true' if we haven't told them in 2.5s
     if (now - lastTypingSentRef.current > 2500) {
         engineRef.current.sendTyping(true);
         lastTypingSentRef.current = now;
     }

     // Drop indicator if they pause typing for 5 seconds
     typingTimeoutRef.current = setTimeout(() => {
         engineRef.current?.sendTyping(false);
         lastTypingSentRef.current = 0;
     }, 5000);
  };

  const uploadFiles = async (files: FileList | null) => {
      if (!engineRef.current || !files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
         const file = files[i];
         if (roomSize > 2 && file.size > GROUP_FILE_LIMIT) {
             addSystemMessage(`ERR_FILE_TOO_LARGE: ${file.name} exceeds 50MB group cap`);
             continue;
         }
         setMessages(prev => [...prev, { msg: { type: 'text', data: `[TX_INIT: ${file.name}]`, expiry: expirySelection }, isMe: true, timestamp: getTimestamp() }]);
         await engineRef.current.sendFile(file, expirySelection).catch(err => {
             addSystemMessage(`ERR_TX_FAILED: ${err.message}`);
         });
      }
  }

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    await uploadFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const renderProgressBar = (percent: number) => {
    const blocks = 20;
    const filled = Math.floor((percent / 100) * blocks);
    const empty = blocks - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  };

  const renderPayload = (entry: {msg: Payload, isMe: boolean, timestamp: string}, index: number) => {
    const { msg, isMe, timestamp } = entry;
    
    if (msg.type === 'text') {
      const senderName = isMe ? localCodename : (msg.peerId ? identities[msg.peerId] || 'UNKNOWN' : 'UNKNOWN');
      return <EphemeralMessage key={index} msg={msg} isMe={isMe} timestamp={timestamp} senderName={senderName} onExpunge={handleExpunge} />;
    }
    
    if (msg.type === 'file-ready') {
        const senderName = isMe ? localCodename : (msg.peerId ? identities[msg.peerId] || 'UNKNOWN' : 'UNKNOWN');
        // Do not generate a blob URL if it was already expunged
        const url = msg.name === '[ASSET_EXPUNGED]' ? '' : URL.createObjectURL(msg.blob);
        return <EphemeralAsset key={index} msg={msg} isMe={isMe} timestamp={timestamp} senderName={senderName} url={url} onExpunge={handleFileExpunge} />;
    }
    return null;
  };

  return (
    <>
      <div className="crt-overlay" />
      
      {modalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
          <div className="hud-panel" style={{ padding: '32px', width: '90%', maxWidth: '400px', border: '1px solid var(--accent-alert)', background: '#050505', boxShadow: '0 0 20px rgba(255, 51, 102, 0.2)' }}>
             <div style={{ color: 'var(--accent-alert)', marginBottom: '16px', fontWeight: 'bold', letterSpacing: '1px' }}>&gt; {modalData.title}</div>
             <div style={{ color: 'var(--text-bright)', marginBottom: '32px', fontSize: '1.2rem' }}>{modalData.message}</div>
             <button className="ghost-button" style={{ width: '100%', color: 'var(--text-bright)', borderColor: 'var(--accent-alert)', opacity: 0.9 }} onClick={() => setModalData(null)}>
               ACKNOWLEDGE
             </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '16px' }}>
        
        {/* Header HUD */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'var(--text-bright)' }}><span className="glow-text" style={{ color: 'var(--accent-cyan)' }}>GHOST</span>_PROTOCOL</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>KERNEL v3.0.0 // ZERO_KNOWLEDGE</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--text-muted)' }}>STATUS: <span style={{ color: status === 'CONNECTED' ? 'var(--accent-success)' : 'var(--text-muted)' }}>{status}</span></div>
            <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>{getTimestamp()} <span className="blink">█</span></div>
          </div>
        </div>

        {/* Central Area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {appState === 'lobby' && (
            <div className="hud-panel" style={{ padding: '32px', width: '100%', maxWidth: '440px' }}>
               <div style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '11px', lineHeight: '1.6', borderBottom: '1px dashed var(--border-subtle)', paddingBottom: '16px' }}>
                 Volatile P2P relay network. Zero-knowledge transmission. <br/>
                 No central routing. No persistent data logs. <br/>
                 Ephemeral by design.
               </div>
               <div style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>&gt; SYSTEM_READY<br/>&gt; AWAITING_COMMAND</div>
               <div style={{ display: 'flex', gap: '16px' }}>
                 <button className="ghost-button" onClick={handleHost}>HOST_NETWORK</button>
                 <button className="ghost-button" onClick={handleJoinInit}>JOIN_NETWORK</button>
               </div>
            </div>
          )}

          {appState === 'deriving' && (
            <div className="hud-panel" style={{ padding: '32px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
               <div style={{ color: 'var(--accent-cyan)' }}>&gt; EXECUTING KDF_PBKDF2_SHA256</div>
               <div style={{ color: 'var(--text-muted)' }}>ITERATIONS: 10,000</div>
               <div style={{ color: 'var(--text-muted)' }}>TARGET: 256-BIT AES-GCM</div>
               
               {sysError ? (
                  <div style={{ color: 'var(--accent-alert)', marginTop: '16px' }}>&gt; FATAL_EXCEPTION: {sysError}</div>
               ) : (
                  <div style={{ color: 'var(--accent-cyan)', marginTop: '16px' }} className="blink">
                     {status === 'CONNECTING' ? 'ESTABLISHING_P2P_TUNNEL...' : 'DERIVING_KEYS...'}
                  </div>
               )}

               {sysError && (
                 <button className="ghost-button" style={{ marginTop: '24px' }} onClick={() => { setAppState('lobby'); setSysError(null); }}>[ABORT]</button>
               )}
            </div>
          )}

          {appState === 'joining' && (
            <form onSubmit={handleJoinSubmit} className="hud-panel" style={{ padding: '32px', width: '100%', maxWidth: '440px' }}>
               <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>&gt; INPUT_HOST_SIGNATURE:</div>
               <input type="text" className="ghost-input" placeholder="ALPHA-BRAVO-CHARLIE-DELTA" value={joinCodeInput} onChange={e => setJoinCodeInput(e.target.value)} autoFocus />
               <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
                 <button type="submit" className="ghost-button" style={{ color: 'var(--accent-cyan)' }}>CONNECT</button>
                 <button type="button" className="ghost-button" onClick={() => setAppState('lobby')}>ABORT</button>
               </div>
            </form>
          )}

          {appState === 'hosting' && (
            <div className="hud-panel" style={{ padding: '32px', width: '100%', maxWidth: '500px' }}>
               <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>&gt; LOCAL_SIGNATURE_GENERATED</div>
               <div style={{ color: 'var(--accent-success)', fontSize: '18px', fontWeight: 500, letterSpacing: '2px', overflowWrap: 'break-word', padding: '16px', border: '1px solid var(--border-subtle)', background: 'rgba(0,255,65,0.05)' }}>
                 {roomCode}
               </div>
               <button className="ghost-button" style={{ marginTop: '8px', padding: '4px 12px', fontSize: '12px', color: 'var(--text-bright)' }} onClick={handleCopyCode}>
                 [ COPY SHADOW-LINK ]
               </button>
               <div style={{ color: 'var(--text-muted)', marginTop: '24px' }}>&gt; LISTENING_ON_CHANNEL... <span className="blink">█</span></div>
               <div style={{ marginTop: '32px' }}><button onClick={handleDisconnect} className="ghost-button" style={{ color: 'var(--accent-alert)' }}>ABORT</button></div>
            </div>
          )}

          {appState === 'chat' && (
            <div className="hud-panel" style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', height: '100%', maxHeight: '85vh' }} onDrop={handleFileDrop} onDragOver={handleDragOver}>
               <div style={{ padding: '12px', borderBottom: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                 <div>:: SECURE_CHANNEL_ACTIVE // PEERS: {roomSize} // CAP: {roomSize > 2 ? '50MB' : 'UNLIMITED'}{engineRef.current?.isHost && ` // ROOM_ID: ${roomCode}`}</div>
                 <div>
                    {engineRef.current?.isHost ? (
                        <button onClick={executeNuke} style={{ background: 'none', border: '1px solid var(--accent-alert)', padding: '2px 8px', color: 'var(--accent-alert)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '10px' }}>
                          [NUKE_TUNNEL]
                        </button>
                    ) : (
                        <button onClick={handleDisconnect} style={{ background: 'none', border: 'none', color: 'var(--accent-alert)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                          [TERMINATE]
                        </button>
                    )}
                 </div>
               </div>

               <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                 {messages.map((msg, idx) => renderPayload(msg, idx))}
                 {Object.entries(transfers).map(([id, transfer]) => {
                   const percentage = Math.floor((transfer.transferred / transfer.total) * 100);
                   const tag = transfer.isUpload ? '<LOCAL>' : '<REMOTE>';
                   const action = transfer.isUpload ? 'TX' : 'RX';
                   const color = transfer.isUpload ? 'var(--text-primary)' : 'var(--accent-cyan)';
                   return (
                     <div key={id} style={{ marginBottom: '8px', color }}>
                       <span style={{ color: 'var(--text-muted)' }}>[{getTimestamp()}] {tag}</span> [{action}: {id.substring(0,8)}] {renderProgressBar(percentage)} {percentage}%
                     </div>
                   );
                 })}
                 <div ref={messagesEndRef} />
               </div>

               {typingPeers.size > 0 && (
                 <div style={{ color: 'var(--accent-cyan)', fontSize: '12px', fontStyle: 'italic', padding: '0 16px 8px 16px' }}>
                   &gt; {Array.from(typingPeers).map(id => identities[id] || 'UNKNOWN').join(', ')} is typing...
                 </div>
               )}

               <div style={{ borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', borderBottom: '1px dashed var(--border-subtle)' }}>
                      <select 
                         className="ghost-input" 
                         style={{ width: '100px', borderRight: '1px solid var(--border-subtle)', borderBottom: 'none', borderTop: 'none', borderLeft: 'none', padding: '8px', color: 'var(--accent-cyan)' }}
                         value={expirySelection === undefined ? 'OFF' : expirySelection.toString()}
                         onChange={e => setExpirySelection(e.target.value === 'OFF' ? undefined : parseInt(e.target.value))}
                      >
                         <option value="OFF" style={{ background: '#050505', color: 'var(--accent-cyan)' }}>💣 OFF</option>
                         <option value="10" style={{ background: '#050505', color: 'var(--accent-cyan)' }}>💣 10s</option>
                         <option value="30" style={{ background: '#050505', color: 'var(--accent-cyan)' }}>💣 30s</option>
                         <option value="60" style={{ background: '#050505', color: 'var(--accent-cyan)' }}>💣 60s</option>
                      </select>
                      <button 
                         className="ghost-button" 
                         style={{ border: 'none', borderRight: '1px solid var(--border-subtle)', padding: '8px 16px', color: 'var(--text-bright)' }}
                         onClick={() => fileInputRef.current?.click()}
                      >
                         [ATTACH_ASSET]
                      </button>
                      <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => uploadFiles(e.target.files)} />
                  </div>
                  <form onSubmit={handleSendText} style={{ display: 'flex' }}>
                    <div style={{ padding: '16px', color: 'var(--text-muted)' }}>&gt;</div>
                    <input type="text" value={textInput} onChange={handleInputChange} className="ghost-input" style={{ border: 'none', boxShadow: 'none', background: 'transparent', width: '100%' }} placeholder={`[${localCodename}] Type a message...`} autoFocus />
                  </form>
               </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
