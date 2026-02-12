'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { DealScreen } from './screens/DealScreen';
import { ExchangeScreen } from './screens/ExchangeScreen';
import { CutterPickScreen } from './screens/CutterPickScreen';
import { DealerDiscardScreen } from './screens/DealerDiscardScreen';
import { TrickPlayScreen } from './screens/TrickPlayScreen';
import { TrickResultScreen } from './screens/TrickResultScreen';
import { HandScoringScreen } from './screens/HandScoringScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { GameStatusBar } from './GameStatusBar';
import { TrickHistory } from './TrickHistory';
import { ReceivedCardsScreen } from './screens/ReceivedCardsScreen';
import { DealerKupaScreen } from './screens/DealerKupaScreen';
import { DealerReturnsScreen } from './screens/DealerReturnsScreen';

export function GameBoard() {
  const { gameState, showPrivacyScreen, showTrickResult, showReceivedCards, showDealerKupa, showDealerReturns, aiSeats, runAiTurn } = useGameStore();
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAI = aiSeats.size > 0;
  const currentSeat = gameState?.currentPlayerIndex ?? -1;
  const isAiTurn = hasAI && currentSeat >= 0 && aiSeats.has(currentSeat);
  const phase = gameState?.phase;

  const exchangeProgress =
    (gameState?.exchangeInfo?.givenCards.length ?? 0) +
    (gameState?.exchangeInfo?.returnedCards.length ?? 0);
  const trickNum = gameState?.trickNumber ?? 0;

  useEffect(() => {
    if (!isAiTurn || showTrickResult || showReceivedCards || showDealerKupa || showDealerReturns) return;

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    const delay =
      phase === 'CUTTER_PICK' ? 2200 :
      phase === 'DEALER_DISCARD' ? 1500 :
      phase === 'SETUP_DEAL' ? 600 :
      phase === 'TRICK_PLAY' ? (2500 + Math.random() * 1500) :
      phase === 'EXCHANGE_GIVE' || phase === 'EXCHANGE_RETURN' ? 1500 : 800;

    aiTimerRef.current = setTimeout(() => {
      runAiTurn();
    }, delay);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [isAiTurn, phase, currentSeat, showTrickResult, showReceivedCards, showDealerKupa, showDealerReturns, runAiTurn, exchangeProgress, trickNum]);

  useEffect(() => {
    if (!showTrickResult || !hasAI) return;

    const timer = setTimeout(() => {
      useGameStore.getState().dismissTrickResult();
    }, 2500);

    return () => clearTimeout(timer);
  }, [showTrickResult, hasAI]);

  if (!gameState) return null;

  if (showPrivacyScreen && gameState.mode === 'local' && !hasAI) {
    return <PrivacyScreen />;
  }

  if (showReceivedCards) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} />
        <ReceivedCardsScreen />
      </div>
    );
  }

  if (showDealerKupa && gameState.dealerReceivedKupa.length > 0) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} />
        <DealerKupaScreen />
      </div>
    );
  }

  if (showDealerReturns && (gameState.dealerHiddenReturns.length > 0 || gameState.dealerPendingReceived.length > 0)) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} />
        <DealerReturnsScreen />
      </div>
    );
  }

  const hideStatusBar = phase === 'GAME_OVER';

  let screen: React.ReactNode;

  if (showTrickResult) {
    screen = <TrickResultScreen />;
  } else {
    switch (gameState.phase) {
      case 'SETUP_DEAL':
        screen = <DealScreen />;
        break;
      case 'EXCHANGE_GIVE':
      case 'EXCHANGE_RETURN':
        screen = <ExchangeScreen />;
        break;
      case 'CUTTER_PICK':
        screen = <CutterPickScreen />;
        break;
      case 'DEALER_DISCARD':
        screen = <DealerDiscardScreen />;
        break;
      case 'TRICK_PLAY':
        screen = <TrickPlayScreen />;
        break;
      case 'HAND_SCORING':
        screen = <HandScoringScreen />;
        break;
      case 'GAME_OVER':
        screen = <GameOverScreen />;
        break;
      default:
        screen = (
          <div className="flex items-center justify-center min-h-[50dvh]">
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-muted-foreground">שלב לא ידוע: {gameState.phase}</p>
            </div>
          </div>
        );
    }
  }

  const showHistory = gameState.tricksHistory.length > 0 &&
    ['TRICK_PLAY', 'TRICK_RESULT', 'HAND_SCORING', 'GAME_OVER'].includes(gameState.phase);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {!hideStatusBar && (
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} />
      )}
      <div className="flex-1 flex flex-col min-h-0">{screen}</div>
      {showHistory && <TrickHistory gameState={gameState} aiSeats={aiSeats} />}
    </div>
  );
}
