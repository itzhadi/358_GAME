'use client';

import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

export function GameOverScreen() {
  const { gameState, resetGame, aiSeats } = useGameStore();
  if (!gameState || gameState.phase !== 'GAME_OVER') return null;

  const hasAI = aiSeats.size > 0;
  const winner = gameState.winnerIndex !== null ? gameState.players[gameState.winnerIndex] : null;
  const winnerIsHuman = gameState.winnerIndex !== null && !aiSeats.has(gameState.winnerIndex);

  const medals = ['🥇', '🥈', '🥉'];
  const sorted = gameState.players
    .map((p, i) => ({ player: p, score: gameState.scoreTotal[i], seat: i }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col items-center flex-1 p-4 pb-24 text-center animate-scale-in relative overflow-y-auto">
      <div className="absolute top-[15%] left-[30%] w-[300px] h-[300px] rounded-full bg-amber-500/8 blur-[120px] pointer-events-none animate-pulse-soft" />
      <div className="absolute bottom-[20%] right-[20%] w-[200px] h-[200px] rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />

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

      <div className="flex flex-col gap-3 w-full max-w-sm mt-4 mb-8">
        <Button size="lg" variant="accent" onClick={resetGame} className="text-lg px-12 rounded-2xl w-full">
          משחק חדש 🎮
        </Button>
      </div>
    </div>
  );
}
