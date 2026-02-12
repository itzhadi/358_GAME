'use client';

import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

export function GameOverScreen() {
  const { gameState, resetGame, roomCode, aiSeats } = useGameStore();
  if (!gameState || gameState.phase !== 'GAME_OVER') return null;

  const hasAI = aiSeats.size > 0;
  const winner = gameState.winnerIndex !== null ? gameState.players[gameState.winnerIndex] : null;
  const winnerIsHuman = gameState.winnerIndex !== null && !aiSeats.has(gameState.winnerIndex);

  const medals = ['🥇', '🥈', '🥉'];
  const sorted = gameState.players
    .map((p, i) => ({ player: p, score: gameState.scoreTotal[i], seat: i }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80dvh] p-4 text-center animate-scale-in relative overflow-hidden">
      <div className="absolute top-[15%] left-[30%] w-[300px] h-[300px] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none animate-pulse-soft" />
      <div className="absolute bottom-[20%] right-[20%] w-[200px] h-[200px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />

      <div className="text-7xl mb-4 animate-float">{winnerIsHuman ? '🏆' : '🤖'}</div>
      <h2 className="text-3xl font-black text-gradient-gold mb-2">המשחק נגמר!</h2>

      {winner && (
        <p className="text-2xl font-black text-gradient-primary mb-1">
          {hasAI && aiSeats.has(gameState.winnerIndex!) ? '🤖 ' : ''}{winner.name} מנצח!
        </p>
      )}
      {winnerIsHuman && hasAI && (
        <p className="text-lg text-green-400 font-bold mb-1">כל הכבוד! ניצחת את המחשב! 🎉</p>
      )}
      {gameState.winnerReason && (
        <p className="text-sm text-muted-foreground mb-8">{gameState.winnerReason}</p>
      )}

      <div className="glass rounded-3xl p-5 mb-6 w-full max-w-sm glow-accent">
        <h3 className="font-bold mb-4 text-sm text-muted-foreground">ניקוד סופי</h3>
        {sorted.map(({ player, score, seat }, rank) => (
          <div
            key={player.id}
            className={cn(
              'flex justify-between items-center py-3 px-4 rounded-2xl mb-2 last:mb-0 transition-all',
              seat === gameState.winnerIndex
                ? 'glass glow-win'
                : 'glass-card',
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{medals[rank]}</span>
              {hasAI && aiSeats.has(seat) && <span>🤖</span>}
              <span className="font-bold text-base">{player.name}</span>
            </div>
            <span className={cn(
              'text-2xl font-black',
              rank === 0 ? 'text-gradient-gold' : 'text-muted-foreground',
            )}>{score}</span>
          </div>
        ))}
      </div>

      {gameState.handHistory.length > 0 && (
        <div className="glass rounded-3xl p-4 mb-8 w-full max-w-sm text-sm">
          <h3 className="font-bold mb-3 text-muted-foreground text-xs">היסטוריית ידיים</h3>
          <div className="max-h-36 overflow-y-auto space-y-1">
            {gameState.handHistory.map((h) => (
              <div key={h.handNumber} className="flex justify-between py-1.5 px-2 rounded-lg glass-card text-xs">
                <span className="text-muted-foreground">יד {h.handNumber}</span>
                <div className="flex gap-3">
                  {gameState.players.map((p, i) => (
                    <span
                      key={p.id}
                      className={cn(
                        'font-mono font-bold',
                        h.deltas[i] > 0 ? 'text-green-400' : h.deltas[i] < 0 ? 'text-rose-400' : 'text-muted-foreground',
                      )}
                    >
                      {h.deltas[i] > 0 ? '+' : ''}{h.deltas[i]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-sm mt-4 mb-8">
        {gameState.mode === 'online' && roomCode && (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms/${roomCode}/export.json`, '_blank')}>
              📥 JSON
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/rooms/${roomCode}/export.csv`, '_blank')}>
              📊 CSV
            </Button>
          </div>
        )}

        {gameState.mode === 'local' && (
          <Button variant="outline" onClick={() => {
            const blob = new Blob([JSON.stringify(gameState, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `358-local-${new Date().toISOString()}.json`;
            a.click();
          }}>
            📥 שמור לוג משחק
          </Button>
        )}

        <Button size="lg" variant="accent" onClick={resetGame} className="text-lg px-12 rounded-2xl w-full">
          משחק חדש 🎮
        </Button>
      </div>
    </div>
  );
}
