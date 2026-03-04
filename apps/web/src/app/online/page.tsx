'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { socket } from '@/lib/socket';
import BotIcon from '@/components/BotIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ServerStatus = 'checking' | 'waking' | 'ready' | 'error';

export default function OnlineLobbyPage() {
  const router = useRouter();
  const {
    createRoom,
    joinRoom,
    startOnlineGame,
    leaveRoom,
    roomCode,
    lobbyState,
    gameState,
    playerSeat,
    isConnected,
    toastMessage,
    dismissToast,
  } = useGameStore();

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [hostName, setHostName] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [victoryTarget, setVictoryTarget] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState<2 | 3>(3);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pingServer = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(10000) });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  // Pre-warm server on page load + periodic keep-alive
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    const warmUp = async () => {
      setServerStatus('checking');
      const ok = await pingServer();
      if (cancelled) return;

      if (ok) {
        setServerStatus('ready');
      } else {
        setServerStatus('waking');
        // Retry with backoff until server responds
        const retry = async () => {
          attempt++;
          const ok = await pingServer();
          if (cancelled) return;
          if (ok) {
            setServerStatus('ready');
          } else if (attempt < 12) {
            setTimeout(retry, 3000);
          } else {
            setServerStatus('error');
          }
        };
        setTimeout(retry, 2000);
      }
    };

    warmUp();

    // Keep-alive every 4 minutes while on the page
    keepAliveRef.current = setInterval(() => { pingServer(); }, 4 * 60_000);

    return () => {
      cancelled = true;
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, [pingServer]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => dismissToast(), 5000);
    return () => clearTimeout(timer);
  }, [toastMessage, dismissToast]);

  useEffect(() => {
    if (toastMessage) setIsJoining(false);
  }, [toastMessage]);

  useEffect(() => {
    if (gameState && gameState.mode === 'online') {
      router.push('/online/play');
    }
  }, [gameState, router]);

  // Reset joining state when lobby appears
  useEffect(() => {
    if (roomCode && lobbyState) {
      setIsJoining(false);
    }
  }, [roomCode, lobbyState]);

  const handleCreate = async () => {
    setIsJoining(true);
    await createRoom(hostName, victoryTarget, maxPlayers);
  };

  const handleJoin = async () => {
    setIsJoining(true);
    await joinRoom(inputRoomCode, playerName);
    // If after 6 seconds we're still not in the lobby, reset
    setTimeout(() => {
      const state = useGameStore.getState();
      if (!state.roomCode || !state.lobbyState) {
        setIsJoining(false);
      }
    }, 6000);
  };

  // Reset joining state on socket error
  useEffect(() => {
    const handleError = () => setIsJoining(false);
    socket.on('error', handleError);
    return () => { socket.off('error', handleError); };
  }, []);

  const amIHost = playerSeat === 0;

  // Lobby View
  if (roomCode && lobbyState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />

        <h1 className="text-3xl font-black text-gradient-primary mb-2">חדר</h1>
        <button
          onClick={() => {
            navigator.clipboard.writeText(roomCode!);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="glass rounded-2xl px-6 py-3 mb-3 flex items-center gap-3 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
        >
          <span className="text-3xl font-black tracking-[0.3em] font-mono text-gradient-primary">{roomCode}</span>
          <span className="text-lg">{copied ? '✅' : '📋'}</span>
        </button>
        <p className="text-xs text-muted-foreground mb-1">
          {copied ? 'הועתק!' : 'לחץ להעתקת קוד החדר'}
        </p>
        <p className="text-muted-foreground text-sm mb-2">
          {(() => {
            const needed = lobbyState.maxPlayers ?? 3;
            const humanCount = lobbyState.players.filter((p: any) => p.seatIndex !== lobbyState.aiSeat).length;
            return humanCount < needed ? (needed === 2 ? 'ממתין לשחקן...' : 'ממתין לשחקנים...') : 'כולם מוכנים! 🎉';
          })()}
        </p>
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-xs text-muted-foreground">{isConnected ? 'מחובר' : 'מתחבר...'}</span>
        </div>

        <div className="w-full max-w-sm glass rounded-3xl p-6 mb-8">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => {
              const isAiSlot = (lobbyState.maxPlayers === 2 || lobbyState.aiSeat !== null) && i === 2;
              const player = lobbyState.players.find((p: any) => p.seatIndex === i);
              const isMe = i === playerSeat;
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isMe ? 'bg-emerald-500/8 border-emerald-500/20'
                    : isAiSlot ? 'bg-blue-500/5 border-blue-500/15'
                    : 'bg-white/[0.03] border-white/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      isAiSlot ? 'bg-gradient-to-br from-blue-500 to-cyan-500'
                        : player ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-white/8'
                    }`}>
                      {isAiSlot ? <BotIcon size={20} /> : player ? (i === 0 ? '👑' : i + 1) : '?'}
                    </div>
                    <div className="flex flex-col">
                      <span className={isAiSlot ? 'font-bold text-blue-300' : player ? 'font-bold' : 'text-muted-foreground italic'}>
                        {isAiSlot ? 'בוט' : player ? player.name : 'ממתין...'}
                        {isMe && <span className="text-xs text-emerald-400 mr-1"> (אתה)</span>}
                      </span>
                      {!isAiSlot && player && i === 0 && <span className="text-[10px] text-amber-400">מארח</span>}
                    </div>
                  </div>
                  {isAiSlot ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                      AI
                    </span>
                  ) : player ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      מחובר ✓
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground animate-pulse">
                      פנוי
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {amIHost && (() => {
            const needed = lobbyState.maxPlayers ?? 3;
            const humanCount = lobbyState.players.filter((p: any) => p.seatIndex !== lobbyState.aiSeat).length;
            const ready = humanCount >= needed;
            return (
              <Button
                size="lg"
                variant="glow"
                className="w-full text-lg rounded-2xl"
                disabled={!ready}
                onClick={startOnlineGame}
              >
                {ready ? 'התחל משחק! 🚀' : `ממתין... (${humanCount}/${needed})`}
              </Button>
            );
          })()}

          {!amIHost && (() => {
            const needed = lobbyState.maxPlayers ?? 3;
            const humanCount = lobbyState.players.filter((p: any) => p.seatIndex !== lobbyState.aiSeat).length;
            const ready = humanCount >= needed;
            return (
              <div className="text-center py-3">
                {!ready ? (
                  <p className="text-sm text-muted-foreground animate-pulse">ממתין לשחקנים נוספים... ({humanCount}/{needed})</p>
                ) : (
                  <p className="text-sm text-emerald-400 animate-pulse">ממתין שהמארח יתחיל את המשחק...</p>
                )}
              </div>
            );
          })()}

          <Button variant="ghost" onClick={() => { leaveRoom(); setMode('menu'); }} className="text-muted-foreground hover:text-rose-400">
            יציאה מהחדר
          </Button>
        </div>
      </div>
    );
  }

  // Loading state while joining
  const toastEl = toastMessage ? (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[90%] max-w-sm animate-slide-up">
      <div className="glass-strong rounded-2xl px-5 py-4 text-center shadow-2xl border border-red-500/30">
        <p className="text-sm font-medium text-red-300">{toastMessage}</p>
        <button onClick={dismissToast} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">סגור</button>
      </div>
    </div>
  ) : null;

  if (isJoining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6">
        {toastEl}
        <div className="text-5xl mb-4 animate-pulse">🔌</div>
        <p className="text-lg font-bold text-gradient-primary mb-2">מתחבר לחדר...</p>
        <p className="text-sm text-muted-foreground mb-1">אנא המתן</p>
        <p className="text-xs text-muted-foreground/60">ההתחברות הראשונה עשויה לקחת עד 30 שניות</p>
      </div>
    );
  }

  const serverStatusEl = (
    <div className="flex items-center gap-2 mb-4">
      <span className={`w-2 h-2 rounded-full ${
        serverStatus === 'ready' ? 'bg-green-500'
          : serverStatus === 'error' ? 'bg-red-500'
          : 'bg-amber-400 animate-pulse'
      }`} />
      <span className="text-xs text-muted-foreground">
        {serverStatus === 'ready' && 'שרת מוכן'}
        {serverStatus === 'checking' && 'בודק שרת...'}
        {serverStatus === 'waking' && 'מעיר שרת (עד 30 שניות)...'}
        {serverStatus === 'error' && (
          <>
            השרת לא מגיב{' '}
            <button
              className="underline text-amber-400 hover:text-amber-300"
              onClick={() => {
                setServerStatus('checking');
                pingServer().then(ok => setServerStatus(ok ? 'ready' : 'error'));
              }}
            >
              נסה שוב
            </button>
          </>
        )}
      </span>
    </div>
  );

  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[10%] w-[300px] h-[300px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

        <h1 className="text-3xl font-black text-gradient-primary mb-2">👥 משחק עם חברים</h1>
        <p className="text-muted-foreground mb-6">שחקו עם חברים מכל מקום</p>

        {serverStatusEl}

        <div className="w-full max-w-xs flex flex-col gap-4">
          <Button size="lg" variant="glow" className="w-full text-lg h-16 rounded-2xl" onClick={() => setMode('create')}>
            <span className="ml-2">➕</span> צור חדר חדש
          </Button>
          <Button size="lg" variant="secondary" className="w-full text-lg h-16 rounded-2xl" onClick={() => setMode('join')}>
            <span className="ml-2">🔗</span> הצטרף לחדר
          </Button>
          <Button variant="ghost" onClick={() => router.push('/')} className="text-muted-foreground">
            ← חזרה
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden">
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />

        <h1 className="text-2xl font-bold mb-6 text-gradient-primary">צור חדר חדש</h1>
        <div className="w-full max-w-sm space-y-4 mb-6">
          <div className="glass rounded-2xl p-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">השם שלך</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="הזן שם"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/40 text-lg transition-colors"
              maxLength={20}
            />
          </div>
          <div className="glass rounded-2xl p-4">
            <label className="block text-xs font-medium text-muted-foreground mb-2">מספר שחקנים</label>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setMaxPlayers(3)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  maxPlayers === 3
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                    : 'glass text-muted-foreground hover:bg-white/10'
                }`}
              >
                3 שחקנים
              </button>
              <button
                onClick={() => setMaxPlayers(2)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  maxPlayers === 2
                    ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                    : 'glass text-muted-foreground hover:bg-white/10'
                }`}
              >
                2 + בוט
              </button>
            </div>
          </div>
          <div className="glass rounded-2xl p-4">
            <label className="block text-xs font-medium text-muted-foreground mb-2">יעד ניצחון</label>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setVictoryTarget((v) => Math.max(1, v - 5))} className="w-10 h-10 rounded-xl glass text-lg font-bold active:scale-95 hover:bg-white/10">−</button>
              <span className="text-3xl font-black text-gradient-primary min-w-[3ch] text-center">{victoryTarget}</span>
              <button onClick={() => setVictoryTarget((v) => Math.min(100, v + 5))} className="w-10 h-10 rounded-xl glass text-lg font-bold active:scale-95 hover:bg-white/10">+</button>
            </div>
          </div>
        </div>
        {serverStatus !== 'ready' && serverStatusEl}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Button size="lg" variant="glow" className="w-full text-lg rounded-2xl" disabled={!hostName.trim() || serverStatus !== 'ready'} onClick={handleCreate}>
            {serverStatus === 'ready' ? 'צור חדר' : 'ממתין לשרת...'}
          </Button>
          <Button variant="ghost" onClick={() => setMode('menu')} className="text-muted-foreground">← חזרה</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      <h1 className="text-2xl font-bold mb-6 text-gradient-primary">הצטרף לחדר</h1>
      <div className="w-full max-w-sm space-y-4 mb-6">
        <div className="glass rounded-2xl p-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">קוד חדר</label>
          <input
            type="text"
            value={inputRoomCode}
            onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
            placeholder="ABCDEF"
            className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-emerald-500/40 text-3xl text-center tracking-[0.3em] font-mono transition-colors"
            maxLength={6}
          />
        </div>
        <div className="glass rounded-2xl p-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">השם שלך</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="הזן שם"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-emerald-500/40 text-lg transition-colors"
            maxLength={20}
          />
        </div>
      </div>
      {serverStatus !== 'ready' && serverStatusEl}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button size="lg" variant="glow" className="w-full text-lg rounded-2xl" disabled={inputRoomCode.length !== 6 || !playerName.trim() || serverStatus !== 'ready'} onClick={handleJoin}>
          {serverStatus === 'ready' ? 'הצטרף 🚀' : 'ממתין לשרת...'}
        </Button>
        <Button variant="ghost" onClick={() => setMode('menu')} className="text-muted-foreground">← חזרה</Button>
      </div>
    </div>
  );
}
