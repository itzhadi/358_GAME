'use client';

import { useGameStore } from '@/store/gameStore';
import { PlayerHand } from '@/components/PlayerHand';
import { PlayingCard, SuitIcon } from '@/components/PlayingCard';
import { AIPlayerPanel } from '@/components/AIPlayerPanel';
import { cn } from '@/lib/utils';

function getThrowAnimation(seatIndex: number, humanSeat: number, leftSeat: number): string {
  if (seatIndex === humanSeat) return 'animate-throw-bottom';
  if (seatIndex === leftSeat) return 'animate-throw-left';
  return 'animate-throw-right';
}

export function TrickPlayScreen() {
  const { gameState, activePlayerSeat, dispatch, aiSeats, mode, playerSeat } = useGameStore();
  if (!gameState) return null;

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const humanSeat = isOnline ? (playerSeat ?? 0) : (hasAI ? 0 : activePlayerSeat);
  const hand = gameState.playerHands[humanSeat];
  const isMyTurn = gameState.currentPlayerIndex === humanSeat;

  const handleCardClick = (cardId: string) => {
    if (!isMyTurn) return;
    dispatch({
      type: 'PLAY_CARD',
      payload: { seatIndex: humanSeat, cardId },
    });
  };

  const currentTurnPlayer = gameState.currentPlayerIndex >= 0 ? gameState.players[gameState.currentPlayerIndex] : null;
  const isAiThinking = hasAI && gameState.currentPlayerIndex >= 0 && aiSeats.has(gameState.currentPlayerIndex);
  const isTrickComplete = currentTrick?.cardsPlayed.length === 3;

  const { currentTrick, cutterSuit, trickNumber, tricksTakenCount, targets, players } = gameState;

  // Determine the two opponent seats (everyone except humanSeat)
  const allSeats = [0, 1, 2];
  const opponentSeats = allSeats.filter(s => s !== humanSeat);
  // RTL layout: left panel = higher index, right panel = lower index
  const leftSeat = opponentSeats[1] ?? opponentSeats[0];
  const rightSeat = opponentSeats[0];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Turn indicator */}
      <div className={cn('text-center py-1.5 transition-colors', isTrickComplete ? 'glass-strong' : isMyTurn ? 'glass-strong' : 'glass')}>
        {isTrickComplete ? (
          <span className="text-xs font-bold text-amber-400 animate-pulse-soft">🏆 לקיחה הושלמה!</span>
        ) : isMyTurn ? (
          <span className="text-xs font-bold text-purple-400 animate-pulse-soft">תורך לשחק! 🎯</span>
        ) : isAiThinking ? (
          <span className="text-xs text-muted-foreground">
            🤖 {currentTurnPlayer?.name} חושב...
          </span>
        ) : currentTurnPlayer ? (
          <span className="text-xs text-muted-foreground">
            ממתין ל{currentTurnPlayer.name}...
          </span>
        ) : null}
      </div>

      {/* Opponent bar - horizontal on mobile, hidden on sm+ (side panels used instead) */}
      <div className="flex sm:hidden justify-center gap-4 py-1.5 glass border-b border-white/5">
        <AIPlayerPanel
          name={players[leftSeat].name}
          seatIndex={leftSeat}
          cardCount={gameState.playerHands[leftSeat]?.length ?? 0}
          tricksTaken={tricksTakenCount[leftSeat]}
          target={targets[leftSeat]}
          isActive={gameState.currentPlayerIndex === leftSeat}
          isThinking={isAiThinking && gameState.currentPlayerIndex === leftSeat}
          side="left"
          cutterSuit={cutterSuit}
          isAI={aiSeats.has(leftSeat)}
          compact
        />
        <AIPlayerPanel
          name={players[rightSeat].name}
          seatIndex={rightSeat}
          cardCount={gameState.playerHands[rightSeat]?.length ?? 0}
          tricksTaken={tricksTakenCount[rightSeat]}
          target={targets[rightSeat]}
          isActive={gameState.currentPlayerIndex === rightSeat}
          isThinking={isAiThinking && gameState.currentPlayerIndex === rightSeat}
          side="right"
          cutterSuit={cutterSuit}
          isAI={aiSeats.has(rightSeat)}
          compact
        />
      </div>

      {/* Game table area with side panels */}
      <div className="flex-1 flex items-stretch justify-center min-h-0 overflow-hidden gap-1 sm:gap-4">
        {/* Left opponent - hidden on mobile (shown in top bar) */}
        <div className="hidden sm:flex items-center shrink-0">
          <AIPlayerPanel
            name={players[leftSeat].name}
            seatIndex={leftSeat}
            cardCount={gameState.playerHands[leftSeat]?.length ?? 0}
            tricksTaken={tricksTakenCount[leftSeat]}
            target={targets[leftSeat]}
            isActive={gameState.currentPlayerIndex === leftSeat}
            isThinking={isAiThinking && gameState.currentPlayerIndex === leftSeat}
            side="left"
            cutterSuit={cutterSuit}
            isAI={aiSeats.has(leftSeat)}
          />
        </div>

        {/* Center table */}
        <div className="flex flex-col items-center justify-center py-1 sm:py-2 shrink">
          <div className="relative w-[92vw] sm:w-[55vw] max-w-[700px] h-[40vh] sm:h-[50vh] max-h-[380px] rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 overflow-hidden"
            style={{
              background: 'radial-gradient(ellipse at 50% 45%, hsla(140, 30%, 18%, 0.6), hsla(140, 20%, 10%, 0.8) 60%, hsla(230, 25%, 8%, 0.9))',
              boxShadow: 'inset 0 2px 30px rgba(0,0,0,0.3), 0 0 40px rgba(0,0,0,0.3)',
            }}
          >
            <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_50%_50%,white_1px,transparent_1px)] bg-[length:4px_4px]" />

            {/* Info badges */}
            <div className="absolute top-2 sm:top-3 inset-x-2 sm:inset-x-4 flex justify-between items-center text-[10px] sm:text-xs z-10">
              <div className="flex items-center gap-1 sm:gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2 sm:px-3 py-0.5 sm:py-1 border border-white/10">
                <span className="text-white/60">לקיחה</span>
                <span className="font-bold text-purple-300">{trickNumber}</span>
                <span className="text-white/60">/16</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {cutterSuit && (
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2 sm:px-3 py-0.5 sm:py-1 border border-white/10">
                    <span className="text-white/60">חותך</span>
                    <SuitIcon suit={cutterSuit} className="text-base sm:text-lg" />
                  </div>
                )}
                {currentTrick?.leadSuit && (
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2 sm:px-3 py-0.5 sm:py-1 border border-white/10">
                    <span className="text-white/60">מוביל</span>
                    <SuitIcon suit={currentTrick.leadSuit} className="text-base sm:text-lg" />
                  </div>
                )}
              </div>
            </div>

            {/* Played cards */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex gap-2 sm:gap-4 md:gap-6">
                {currentTrick?.cardsPlayed.map((cp) => (
                  <div
                    key={cp.card.id}
                    className={cn('text-center', getThrowAnimation(cp.seatIndex, humanSeat, leftSeat))}
                  >
                    <p className={cn(
                      'text-[10px] sm:text-xs mb-0.5 sm:mb-1 font-bold truncate max-w-[60px] sm:max-w-[80px] drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]',
                      cp.seatIndex === humanSeat ? 'text-purple-300' : 'text-white/80',
                    )}>
                      {players[cp.seatIndex].name}
                    </p>
                    <PlayingCard card={cp.card} />
                  </div>
                ))}

                {(!currentTrick || currentTrick.cardsPlayed.length === 0) && (
                  <div className="text-white/50 text-xs sm:text-sm font-medium animate-pulse-soft drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                    ממתין לקלף ראשון...
                  </div>
                )}
              </div>
            </div>

            {/* Human info at bottom of table */}
            <div className="absolute bottom-2 sm:bottom-3 inset-x-2 sm:inset-x-4 flex justify-center">
              <div className={cn(
                'px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium border border-white/10',
                isMyTurn ? 'bg-black/50 backdrop-blur-sm glow-primary text-purple-300' : 'bg-black/40 backdrop-blur-sm text-white/60',
              )}>
                <span className="font-bold">{players[humanSeat].name}</span>
                <span className="mx-1 sm:mx-1.5">·</span>
                <span className={cn(
                  'font-mono font-bold',
                  tricksTakenCount[humanSeat] > targets[humanSeat] ? 'text-green-400' :
                    tricksTakenCount[humanSeat] === targets[humanSeat] ? 'text-amber-400' : '',
                )}>
                  {tricksTakenCount[humanSeat]}/{targets[humanSeat]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right opponent - hidden on mobile (shown in top bar) */}
        <div className="hidden sm:flex items-center shrink-0">
          <AIPlayerPanel
            name={players[rightSeat].name}
            seatIndex={rightSeat}
            cardCount={gameState.playerHands[rightSeat]?.length ?? 0}
            tricksTaken={tricksTakenCount[rightSeat]}
            target={targets[rightSeat]}
            isActive={gameState.currentPlayerIndex === rightSeat}
            isThinking={isAiThinking && gameState.currentPlayerIndex === rightSeat}
            side="right"
            cutterSuit={cutterSuit}
            isAI={aiSeats.has(rightSeat)}
          />
        </div>
      </div>

      {/* Human player trick piles + hand */}
      <div className={cn(
        'pb-2 pt-2 transition-all shrink-0',
        isMyTurn
          ? 'glass-strong border-t border-purple-500/20'
          : 'glass border-t border-white/5',
      )}>
        {/* Trick count display */}
        {tricksTakenCount[humanSeat] > 0 && (
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="flex gap-1">
              {Array.from({ length: tricksTakenCount[humanSeat] }).map((_, i) => {
                const isExtra = i >= targets[humanSeat];
                return (
                  <div key={i} className={cn('relative w-4 h-5', isExtra && 'scale-105')}>
                    {[0, 1, 2].map((c) => (
                      <div
                        key={c}
                        className={cn(
                          'absolute rounded-[1px] border',
                          isExtra ? 'border-amber-400/40' : 'border-white/10',
                        )}
                        style={{
                          width: '100%',
                          height: '100%',
                          top: `${-c * 1}px`,
                          left: `${c * 0.5}px`,
                          background: isExtra
                            ? 'linear-gradient(135deg, hsl(45, 80%, 30%), hsl(35, 70%, 22%))'
                            : 'linear-gradient(135deg, hsl(230, 25%, 22%), hsl(230, 20%, 16%))',
                          zIndex: c,
                          boxShadow: isExtra ? '0 0 6px rgba(251, 191, 36, 0.3)' : 'none',
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
            <span className={cn(
              'text-[10px] font-mono font-bold',
              tricksTakenCount[humanSeat] > targets[humanSeat] ? 'text-green-400' :
                tricksTakenCount[humanSeat] === targets[humanSeat] ? 'text-amber-400' : 'text-muted-foreground',
            )}>
              {tricksTakenCount[humanSeat]}/{targets[humanSeat]}
            </span>
          </div>
        )}

        {isMyTurn && (
          <div className="animate-shimmer h-0.5 mb-1.5 mx-6 rounded-full" />
        )}
        <PlayerHand
          cards={hand}
          cutterSuit={cutterSuit}
          leadSuit={isMyTurn ? (currentTrick?.leadSuit ?? null) : undefined}
          onCardClick={isMyTurn ? handleCardClick : undefined}
        />
      </div>
    </div>
  );
}
