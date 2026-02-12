'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { socket } from '@/lib/socket';

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
    isConnected
  } = useGameStore();

  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [hostName, setHostName] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [victoryTarget, setVictoryTarget] = useState(10);
  const [isJoining, setIsJoining] = useState(false);
  const [copied, setCopied] = useState(false);

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
    await createRoom(hostName, victoryTarget);
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
        <div className="absolute top-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

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
          {lobbyState.players.length < 3 ? 'ממתין לשחקנים...' : 'כולם מוכנים! 🎉'}
        </p>
        <div className="flex items-center gap-2 mb-6">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-xs text-muted-foreground">{isConnected ? 'מחובר' : 'מתחבר...'}</span>
        </div>

        <div className="w-full max-w-sm glass rounded-3xl p-6 mb-8">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => {
              const player = lobbyState.players.find(p => p.seatIndex === i);
              const isMe = i === playerSeat;
              return (
                <div key={i} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isMe ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/5 border-white/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      player ? 'bg-gradient-to-br from-purple-500 to-blue-500' : 'bg-white/10'
                    }`}>
                      {player ? (i === 0 ? '👑' : i + 1) : '?'}
                    </div>
                    <div className="flex flex-col">
                      <span className={player ? 'font-bold' : 'text-muted-foreground italic'}>
                        {player ? player.name : 'ממתין...'}
                        {isMe && <span className="text-xs text-purple-400 mr-1"> (אתה)</span>}
                      </span>
                      {player && i === 0 && <span className="text-[10px] text-amber-400">מארח</span>}
                    </div>
                  </div>
                  {player ? (
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
          {amIHost && (
            <Button
              size="lg"
              variant="glow"
              className="w-full text-lg rounded-2xl"
              disabled={lobbyState.players.length < 3}
              onClick={startOnlineGame}
            >
              {lobbyState.players.length < 3 ? `ממתין... (${lobbyState.players.length}/3)` : 'התחל משחק! 🚀'}
            </Button>
          )}

          {!amIHost && (
            <div className="text-center py-3">
              {lobbyState.players.length < 3 ? (
                <p className="text-sm text-muted-foreground animate-pulse">ממתין לשחקנים נוספים... ({lobbyState.players.length}/3)</p>
              ) : (
                <p className="text-sm text-purple-400 animate-pulse">ממתין שהמארח יתחיל את המשחק...</p>
              )}
            </div>
          )}

          <Button variant="ghost" onClick={() => { leaveRoom(); setMode('menu'); }} className="text-muted-foreground hover:text-rose-400">
            יציאה מהחדר
          </Button>
        </div>
      </div>
    );
  }

  // Loading state while joining
  if (isJoining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6">
        <div className="text-5xl mb-4 animate-pulse">🔌</div>
        <p className="text-lg font-bold text-gradient-primary mb-2">מתחבר לחדר...</p>
        <p className="text-sm text-muted-foreground">אנא המתן</p>
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[10%] w-[300px] h-[300px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

        <h1 className="text-3xl font-black text-gradient-primary mb-2">🌐 משחק אונליין</h1>
        <p className="text-muted-foreground mb-10">שחקו עם חברים מכל מקום</p>

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
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

        <h1 className="text-2xl font-bold mb-6 text-gradient-primary">צור חדר חדש</h1>
        <div className="w-full max-w-sm space-y-4 mb-6">
          <div className="glass rounded-2xl p-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">השם שלך</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="הזן שם"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-purple-500/50 text-lg transition-colors"
              maxLength={20}
            />
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
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <Button size="lg" variant="glow" className="w-full text-lg rounded-2xl" disabled={!hostName.trim()} onClick={handleCreate}>
            צור חדר 🎮
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
            className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-purple-500/50 text-3xl text-center tracking-[0.3em] font-mono transition-colors"
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
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-purple-500/50 text-lg transition-colors"
            maxLength={20}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button size="lg" variant="glow" className="w-full text-lg rounded-2xl" disabled={inputRoomCode.length !== 6 || !playerName.trim()} onClick={handleJoin}>
          הצטרף 🚀
        </Button>
        <Button variant="ghost" onClick={() => setMode('menu')} className="text-muted-foreground">← חזרה</Button>
      </div>
    </div>
  );
}
