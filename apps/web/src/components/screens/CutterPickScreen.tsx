'use client';

import { useState, useEffect, useRef } from 'react';
import { Suit, SUITS, aiPickCutter } from '@358/shared';
import { Button } from '@/components/ui/button';
import { PlayerHand } from '@/components/PlayerHand';
import { useGameStore } from '@/store/gameStore';
import { cn } from '@/lib/utils';

const SUIT_DISPLAY: Record<Suit, { symbol: string; name: string; color: string }> = {
  S: { symbol: '♠', name: 'עלה', color: 'text-slate-300' },
  H: { symbol: '♥', name: 'לב', color: 'text-rose-500' },
  D: { symbol: '♦', name: 'יהלום', color: 'text-rose-400' },
  C: { symbol: '♣', name: 'תלתן', color: 'text-slate-300' },
};

export function CutterPickScreen() {
  const { gameState, dispatch, activePlayerSeat, aiSeats, mode } = useGameStore();
  const [revealStage, setRevealStage] = useState<'thinking' | 'reveal'>('thinking');
  const [chosenSuit, setChosenSuit] = useState<Suit | null>(null);

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const dealerSeat = gameState?.dealerIndex ?? 0;
  const isAiDealer = hasAI && aiSeats.has(dealerSeat);

  const didReveal = useRef(false);
  useEffect(() => {
    if (!isAiDealer || !gameState || didReveal.current) return;
    didReveal.current = true;
    const dealerHand = gameState.playerHands[dealerSeat];
    const suit = aiPickCutter(dealerHand);
    setChosenSuit(suit);

    const revealTimer = setTimeout(() => setRevealStage('reveal'), 1200);
    const dispatchTimer = setTimeout(() => {
      dispatch({ type: 'PICK_CUTTER', payload: { suit } });
    }, 2500);
    return () => {
      clearTimeout(revealTimer);
      clearTimeout(dispatchTimer);
      didReveal.current = false;
    };
  }, [isAiDealer, dealerSeat, gameState, dispatch]);

  if (!gameState) return null;

  const dealer = gameState.players[dealerSeat];
  const humanSeat = hasAI ? 0 : activePlayerSeat;
  const hand = gameState.playerHands[humanSeat];
  const isMyTurn = dealerSeat === humanSeat;

  if (isAiDealer) {
    const sd = chosenSuit ? SUIT_DISPLAY[chosenSuit] : null;
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4 text-center relative overflow-hidden">
        <div className="absolute top-[15%] left-[20%] w-[250px] h-[250px] rounded-full bg-amber-500/8 blur-[100px] pointer-events-none" />

        <div className="text-5xl mb-4 animate-float">🤖</div>
        <h2 className="text-2xl font-black text-gradient-primary mb-2">{dealer.name}</h2>

        {revealStage === 'thinking' ? (
          <div className="animate-fade-in">
            <p className="text-muted-foreground text-sm mb-6">בוחר חותך...</p>
            <div className="flex gap-3 justify-center">
              {SUITS.map((s, i) => (
                <div
                  key={s}
                  className="text-3xl animate-pulse opacity-40"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  {SUIT_DISPLAY[s].symbol}
                </div>
              ))}
            </div>
          </div>
        ) : sd ? (
          <div className="animate-scale-in">
            <p className="text-amber-400 text-sm font-bold mb-4">הכריז על החותך!</p>
            <div className="glass rounded-3xl p-8 glow-primary">
              <div className={`text-7xl mb-2 ${sd.color}`}>{sd.symbol}</div>
              <div className="text-xl font-black">{sd.name}</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (isOnline && !isMyTurn) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="text-5xl mb-4 animate-float">🎯</div>
          <h2 className="text-xl font-bold mb-2">{dealer.name} בוחר חותך...</h2>
          <p className="text-muted-foreground text-sm animate-pulse">ממתין...</p>
        </div>
        <div className="glass-strong pb-4 pt-2">
          <div className="text-center text-xs text-muted-foreground mb-1">הקלפים שלך</div>
          <PlayerHand cards={hand} />
        </div>
      </div>
    );
  }

  const handlePickCutter = (suit: Suit) => {
    if (!isMyTurn) return;
    dispatch({ type: 'PICK_CUTTER', payload: { suit } });
  };

  const suitConfig: Record<Suit, { name: string; symbol: string; bg: string; glow: string }> = {
    S: { name: 'עלה', symbol: '♠', bg: 'from-slate-600 to-slate-700', glow: 'hover:shadow-slate-500/25' },
    H: { name: 'לב', symbol: '♥', bg: 'from-rose-600 to-red-700', glow: 'hover:shadow-rose-500/25' },
    D: { name: 'יהלום', symbol: '♦', bg: 'from-rose-500 to-red-600', glow: 'hover:shadow-rose-500/25' },
    C: { name: 'תלתן', symbol: '♣', bg: 'from-slate-700 to-slate-800', glow: 'hover:shadow-slate-500/25' },
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="text-center py-4 glass-strong">
        <h2 className="text-lg font-bold">{dealer.name}</h2>
        <p className="text-sm text-emerald-400 font-medium">בחר חותך</p>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="grid grid-cols-2 gap-4 max-w-xs w-full">
          {SUITS.map((suit) => {
            const cfg = suitConfig[suit];
            return (
              <button
                key={suit}
                onClick={() => handlePickCutter(suit)}
                className={cn(
                  `bg-gradient-to-br ${cfg.bg} text-white rounded-2xl py-6 transition-all duration-200`,
                  'active:scale-95 hover:-translate-y-1 shadow-xl disabled:opacity-50 disabled:pointer-events-none',
                  cfg.glow, 'hover:shadow-xl',
                )}
              >
                <div className="text-4xl mb-1">{cfg.symbol}</div>
                <div className="text-sm font-semibold">{cfg.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass-strong pb-4 pt-2">
        <div className="text-center text-xs text-muted-foreground mb-1">הקלפים שלך</div>
        <PlayerHand cards={hand} />
      </div>
    </div>
  );
}
