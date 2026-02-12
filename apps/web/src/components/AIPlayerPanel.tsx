'use client';

import { Suit } from '@358/shared';
import { PlayingCard } from './PlayingCard';
import { cn } from '@/lib/utils';

const AVATAR_COLORS = [
  ['from-violet-500', 'to-fuchsia-500'],
  ['from-blue-500', 'to-cyan-500'],
  ['from-emerald-500', 'to-teal-500'],
  ['from-amber-500', 'to-orange-500'],
  ['from-rose-500', 'to-pink-500'],
  ['from-indigo-500', 'to-purple-500'],
];

const AVATAR_ICONS = ['♔', '♕', '♖', '♗', '♘', '♙', '⚜', '✦', '◆', '★', '⬟', '⎔'];

function hashName(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getAvatarStyle(name: string, seatIndex: number) {
  const h = hashName(name + seatIndex);
  const colors = AVATAR_COLORS[h % AVATAR_COLORS.length];
  const icon = AVATAR_ICONS[(h >> 4) % AVATAR_ICONS.length];
  return { colors, icon };
}

interface AIPlayerPanelProps {
  name: string;
  seatIndex: number;
  cardCount: number;
  tricksTaken: number;
  target: number;
  isActive: boolean;
  isThinking: boolean;
  side: 'left' | 'right';
  cutterSuit?: Suit | null;
  isAI?: boolean;
}

export function AIPlayerPanel({
  name,
  seatIndex,
  cardCount,
  tricksTaken,
  target,
  isActive,
  isThinking,
  side,
  isAI = true,
}: AIPlayerPanelProps) {
  const avatar = getAvatarStyle(name, seatIndex);
  const isOver = tricksTaken > target;
  const isMet = tricksTaken === target;

  return (
    <div className={cn(
      'flex flex-col items-center gap-1.5 w-[90px] sm:w-[100px] transition-all',
      isActive && 'scale-105',
    )}>
      {/* Avatar */}
      <div className={cn(
        'relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 transition-all',
        `bg-gradient-to-br ${avatar.colors[0]} ${avatar.colors[1]}`,
        isActive
          ? 'border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
          : 'border-white/20',
        isThinking && 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]',
      )}>
        <div className="w-full h-full flex items-center justify-center text-2xl sm:text-3xl text-white/90 drop-shadow-md">
          {avatar.icon}
        </div>
        {isThinking && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="animate-thinking flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* Name + score */}
      <div className="text-center">
        <p className={cn(
          'text-xs font-bold truncate max-w-[80px]',
          isActive ? 'text-purple-300' : 'text-slate-300',
        )}>
          {isAI && '🤖 '}{name}
        </p>
        <p className={cn(
          'text-[10px] font-mono font-bold',
          isOver ? 'text-green-400' : isMet ? 'text-amber-400' : 'text-muted-foreground',
        )}>
          {tricksTaken}/{target}
        </p>
      </div>

      {/* Face-down cards */}
      <div className="relative h-10 w-16 sm:w-20">
        {Array.from({ length: Math.min(cardCount, 8) }).map((_, i) => {
          const totalCards = Math.min(cardCount, 8);
          const spreadAngle = 4;
          const rotation = (i - (totalCards - 1) / 2) * spreadAngle;
          const xOffset = (i - (totalCards - 1) / 2) * 3;
          return (
            <div
              key={i}
              className="absolute top-0 left-1/2"
              style={{
                transform: `translateX(calc(-50% + ${xOffset}px)) rotate(${rotation}deg)`,
                transformOrigin: 'bottom center',
                zIndex: i,
              }}
            >
              <PlayingCard
                card={{ id: `hidden-${i}`, rank: '2', suit: 'S' }}
                faceDown
                mini
              />
            </div>
          );
        })}
        {cardCount === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
            אין קלפים
          </div>
        )}
      </div>

      {/* Trick piles */}
      {tricksTaken > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-0.5">
          {Array.from({ length: tricksTaken }).map((_, i) => {
            const isExtra = i >= target;
            return (
              <div key={i} className={cn('relative w-5 h-7', isExtra && 'scale-105')}>
                {[0, 1, 2].map((c) => (
                  <div
                    key={c}
                    className={cn(
                      'absolute rounded-[2px] border',
                      isExtra ? 'border-amber-400/40' : 'border-white/10',
                    )}
                    style={{
                      width: '100%',
                      height: '100%',
                      top: `${-c * 1.5}px`,
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
      )}
    </div>
  );
}

export { getAvatarStyle, AVATAR_COLORS, AVATAR_ICONS };
