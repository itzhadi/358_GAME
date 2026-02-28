'use client';

import { Button } from '@/components/ui/button';
import { useGameStore } from '@/store/gameStore';

export function PrivacyScreen() {
  const { gameState, activePlayerSeat, hidePrivacy } = useGameStore();

  if (!gameState) return null;
  const player = gameState.players[activePlayerSeat];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, hsla(160, 30%, 10%, 1) 0%, hsl(228, 20%, 6%) 70%)' }}>

      <div className="absolute top-[20%] left-[20%] w-[200px] h-[200px] rounded-full bg-emerald-600/10 blur-[80px] animate-pulse-soft pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-[200px] h-[200px] rounded-full bg-cyan-600/10 blur-[80px] animate-pulse-soft pointer-events-none" style={{ animationDelay: '1s' }} />

      <div className="text-7xl mb-8 animate-float">🃏</div>

      <div className="glass rounded-3xl p-8 max-w-xs w-full animate-scale-in">
        <h2 className="text-lg text-muted-foreground mb-1">תורו של</h2>
        <p className="text-4xl font-black text-gradient-primary mb-6">{player.name}</p>
        <p className="text-sm text-muted-foreground mb-8">
          העבירו את המכשיר ל{player.name}
        </p>
        <Button size="lg" variant="glow" onClick={hidePrivacy} className="w-full text-lg rounded-2xl">
          הצג קלפים 👁️
        </Button>
      </div>
    </div>
  );
}
