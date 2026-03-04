'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/components/ui/button';
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

interface GameBoardProps {
  onExit?: () => void;
}

export function GameBoard({ onExit }: GameBoardProps) {
  const { gameState, showPrivacyScreen, showTrickResult, showReceivedCards, showDealerKupa, showDealerReturns, aiSeats, runAiTurn, reshuffleNotification, isConnected, mode, toastMessage, dismissToast, playerSeat, activePlayerSeat } = useGameStore();
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const handleExitClick = onExit ? () => setShowExitConfirm(true) : undefined;

  const hasAI = aiSeats.size > 0;
  const isOnline = mode === 'online';
  const mySeat = isOnline ? (playerSeat ?? 0) : (hasAI ? 0 : activePlayerSeat);
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

  // AI timer: only for local games — online AI is handled server-side
  useEffect(() => {
    if (mode === 'online') return;
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
  }, [mode, isAiTurn, phase, currentSeat, showTrickResult, showReceivedCards, showDealerKupa, showDealerReturns, runAiTurn, exchangeProgress, trickNum, reshuffleW8, reshuffleW35, reshuffleNotification]);

  // Heartbeat: retry AI if stuck — only for local games
  useEffect(() => {
    if (!hasAI || mode === 'online') return;
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
  }, [hasAI, mode]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => dismissToast(), 5000);
    return () => clearTimeout(timer);
  }, [toastMessage, dismissToast]);

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
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} onExit={handleExitClick} mySeat={mySeat} />
        <ReceivedCardsScreen />
      </div>
    );
  }

  if (showDealerKupa && gameState.dealerReceivedKupa.length > 0) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} onExit={handleExitClick} mySeat={mySeat} />
        <DealerKupaScreen />
      </div>
    );
  }

  if (showDealerReturns && (gameState.dealerHiddenReturns.length > 0 || gameState.dealerPendingReceived.length > 0)) {
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} onExit={handleExitClick} mySeat={mySeat} />
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
        <GameStatusBar gameState={gameState} aiSeats={aiSeats} onExit={handleExitClick} mySeat={mySeat} />
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

      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-[90%] max-w-sm animate-slide-up">
          <div className="glass-strong rounded-2xl px-5 py-4 text-center shadow-2xl border border-red-500/30">
            <p className="text-sm font-medium text-red-300">{toastMessage}</p>
            <button onClick={dismissToast} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">סגור</button>
          </div>
        </div>
      )}

      {mode === 'online' && !isConnected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-strong rounded-2xl px-8 py-6 text-center max-w-xs mx-4 shadow-2xl border border-red-500/30">
            <div className="text-3xl mb-3 animate-pulse">🔌</div>
            <p className="text-lg font-bold text-red-400 mb-1">החיבור נותק</p>
            <p className="text-sm text-muted-foreground animate-pulse">מתחבר מחדש...</p>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-strong rounded-2xl px-8 py-6 text-center max-w-xs mx-4 shadow-2xl border border-white/10 animate-scale-in">
            <p className="text-lg font-bold text-foreground mb-1">יציאה מהמשחק</p>
            <p className="text-sm text-muted-foreground mb-5">בטוח שאתה רוצה לצאת?</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setShowExitConfirm(false)}
              >
                ביטול
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowExitConfirm(false);
                  onExit?.();
                }}
              >
                יציאה
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
