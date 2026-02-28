'use client';

import Image from 'next/image';

interface VsComputerButtonProps {
  label?: string;
  iconSrc?: string;
  onClick?: () => void;
  className?: string;
}

export function VsComputerButton({
  label = 'נגד המחשב',
  iconSrc = '/icons/bot.png',
  onClick,
  className = '',
}: VsComputerButtonProps) {
  return (
    <button
      onClick={onClick}
      dir="rtl"
      className={`relative w-full h-[68px] sm:h-[72px] rounded-[18px] transition-all active:scale-[0.97] overflow-hidden cursor-pointer ${className}`}
      style={{
        background: 'linear-gradient(to left, #166876, #30A695)',
        boxShadow: '0 18px 45px rgba(0,0,0,0.55), 0 0 0 2px rgba(78, 198, 175, 0.35)',
      }}
    >
      {/* Inner inset ring */}
      <div
        className="absolute inset-[3px] rounded-[15px] pointer-events-none"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}
      />

      {/* Top glossy highlight */}
      <div
        className="absolute top-[10px] left-[10px] right-[10px] h-[32px] rounded-[14px] pointer-events-none"
        style={{
          background: 'rgba(255,255,255,0.14)',
          filter: 'blur(6px)',
        }}
      />

      {/* Bottom shading */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.15))' }}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center h-full px-4 gap-4" dir="ltr">
        <Image
          src={iconSrc}
          alt=""
          width={44}
          height={34}
          className="h-[42px] w-[52px] object-contain"
          style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))' }}
        />
        <span
          className="text-[38px] font-[800] text-white leading-none"
          style={{ textShadow: '0 2px 0 rgba(0,0,0,0.35)' }}
        >
          {label}
        </span>
      </div>
    </button>
  );
}
