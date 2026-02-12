'use client';

import { cn } from '@/lib/utils';
import { Card as CardType, Suit } from '@358/shared';

interface PlayingCardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  small?: boolean;
  mini?: boolean;
  highlight?: boolean;
  className?: string;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

const isRed = (suit: Suit) => suit === 'H' || suit === 'D';

export function PlayingCard({
  card,
  onClick,
  disabled = false,
  selected = false,
  faceDown = false,
  small = false,
  mini = false,
  highlight = false,
  className,
}: PlayingCardProps) {
  if (faceDown || card.id === 'hidden') {
    return (
      <div
        className={cn(
          'rounded-xl flex items-center justify-center relative overflow-hidden',
          'bg-gradient-to-br from-purple-900/60 to-blue-900/40',
          'border border-white/10',
          mini ? 'w-7 h-10 rounded-md' : small ? 'w-10 h-14 sm:w-14 sm:h-[78px]' : 'w-[52px] h-[74px] sm:w-[76px] sm:h-[110px] md:w-[86px] md:h-[124px]',
          className,
        )}
      >
        <div className="absolute inset-0 bg-[repeating-conic-gradient(hsla(265,50%,50%,0.08)_0%_25%,transparent_0%_50%)] bg-[length:8px_8px]" />
        {!mini && <span className="text-purple-400/50 text-xl relative z-10">✦</span>}
      </div>
    );
  }

  const red = isRed(card.suit);
  const suitColor = red ? 'text-rose-500' : 'text-slate-200';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-xl flex flex-col items-center justify-between relative overflow-hidden transition-all duration-200',
        small ? 'w-10 h-14 sm:w-14 sm:h-[78px] p-0.5' : 'w-[52px] h-[74px] sm:w-[76px] sm:h-[110px] md:w-[86px] md:h-[124px] p-1 sm:p-1.5',
        'bg-gradient-to-br from-white to-gray-100 shadow-xl',
        {
          'ring-2 ring-purple-400 -translate-y-3 shadow-purple-500/30 shadow-2xl scale-105 z-10': selected,
          'border-2 border-purple-400/40 hover:-translate-y-2 hover:shadow-purple-500/20 hover:shadow-xl cursor-pointer': highlight && !disabled && !selected,
          'border border-gray-300/50': !selected && !highlight,
          'opacity-30 cursor-not-allowed grayscale-[30%]': disabled,
          'active:scale-95': onClick && !disabled,
        },
        className,
      )}
    >
      <div className={cn('flex items-center gap-0.5 w-full', small ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-base')}>
        <span className={cn('font-black leading-none', red ? 'text-rose-600' : 'text-gray-800')}>{card.rank}</span>
        <span className={cn('leading-none', suitColor)}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      <div className={cn(
        'font-bold leading-none',
        small ? 'text-lg sm:text-2xl' : 'text-2xl sm:text-4xl md:text-5xl',
        red ? 'text-rose-500' : 'text-gray-700',
      )}>
        {SUIT_SYMBOLS[card.suit]}
      </div>

      <div className={cn('flex items-center gap-0.5 w-full justify-end', small ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-base')}>
        <span className={cn('font-black leading-none', red ? 'text-rose-600' : 'text-gray-800')}>{card.rank}</span>
        <span className={cn('leading-none', suitColor)}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {!small && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,black_10px,black_11px)]" />
      )}
    </button>
  );
}

const SUIT_NAMES: Record<Suit, string> = {
  S: 'עלה',
  H: 'לב',
  D: 'יהלום',
  C: 'תלתן',
};

export function SuitIcon({ suit, className }: { suit: Suit; className?: string }) {
  const red = isRed(suit);
  return (
    <span className={cn('font-bold drop-shadow-sm', red ? 'text-rose-400' : 'text-slate-300', className)}>
      {SUIT_SYMBOLS[suit]}
    </span>
  );
}

export { SUIT_NAMES };
