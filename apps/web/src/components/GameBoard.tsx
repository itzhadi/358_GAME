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
import { ReshuffleScreen } from './screens/ReshuffleScreen';

export function GameBoard() {
  const { gameState, showPrivacyScreen, showTrickResult, showReceivedCards, showDealerKupa, showDealerReturns, aiSeats, runAiTurn, reshuffleNotification } = useGameStore();
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasAI = aiSeats.size > 0;
  const currentSeat = gameState?.currentPlayerIndex ?? -1;
  const isNormalAiTurn = hasAI && currentSeat >= 0 && aiSeats.has(currentSeat);
  const phase = gameState?.phase;

  const isReshuffleAiNeeded = hasAI && phase === 'RESHUFFLE_WINDOW' && gameState != null && (() => {
    const gs = gameState;
    const side8Ai = !gs.reshuffleUsedBy8 && gs.reshuffleWindowFor8 && aiSeats.has(gs.dealerIndex);
    const nonDealers = [0, 1, 2].filter(s => s !== gs.dealerIndex);
    const side35Ai = !gs.reshuffleUsedBy35 && gs.reshuffleWindowFor35 && nonDealers.every(s => aiSeats.has(s));
    return side8Ai || side35Ai;
  })();

  const isAiTurn = isNormalAiTurn || !!isReshuffleAiNeeded;

  const exchangeProgress =
    (gameState?.exchangeInfo?.givenCards.length ?? 0) +
    (gameState?.exchangeInfo?.returnedCards.length ?? 0);
  const trickNum = gameState?.trickNumber ?? 0;
  const reshuffleW8 = gameState?.reshuffleWindowFor8;
  const reshuffleW35 = gameState?.reshuffleWindowFor35;

  useEffect(() => {
    const pendingTrick = useGameStore.getState().pendingTrickState;
    const reshuffleNotif = useGameStore.getState().reshuffleNotification;
    if (!isAiTurn || showTrickResult || showReceivedCards || showDealerKupa || showDealerReturns || pendingTrick || reshuffleNotif) return;

    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);

    const delay =
      phase === 'CUTTER_PICK' ? 2200 :
      phase === 'DEALER_DISCARD' ? 1500 :
      phase === 'SETUP_DEAL' ? 600 :
      phase === 'RESHUFFLE_WINDOW' ? 1500 :
      phase === 'TRICK_PLAY' ? (2500 + Math.random() * 2000) :
      phase === 'EXCHANGE_GIVE' || phase === 'EXCHANGE_RETURN' ? 1500 : 800;

    aiTimerRef.current = setTimeout(() => {
      runAiTurn();
    }, delay);

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [isAiTurn, phase, currentSeat, showTrickResult, showReceivedCards, showDealerKupa, showDealerReturns, runAiTurn, exchangeProgress, trickNum, reshuffleW8, reshuffleW35, reshuffleNotification]);

  // Heartbeat: retry AI if stuck (e.g. after a silent dispatch error)
  useEffect(() => {
    if (!hasAI) return;
    const interval = setInterval(() => {
      const s = useGameStore.getState();
      if (!s.gameState || s.showTrickResult || s.showReceivedCards || s.showDealerKupa || s.showDealerReturns || s.pendingTrickState || s.reshuffleNotification) return;
      const seat = s.gameState.currentPlayerIndex;
      const normalAi = seat >= 0 && s.aiSeats.has(seat);
      const reshuffleAi = s.gameState.phase === 'RESHUFFLE_WINDOW';
      if (normalAi || reshuffleAi) {
        s.runAiTurn();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [hasAI]);

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
      case 'RESHUFFLE_WINDOW':
        screen = <ReshuffleScreen />;
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

      {reshuffleNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-300">
          <div className="glass-strong rounded-2xl px-8 py-5 text-center max-w-sm mx-4 animate-scale-in shadow-2xl border border-amber-500/30">
            <div className="text-3xl mb-2">🔄</div>
            <p className="text-lg font-bold text-amber-400 leading-relaxed">{reshuffleNotification}</p>
          </div>
        </div>
      )}
    </div>
  );
}
