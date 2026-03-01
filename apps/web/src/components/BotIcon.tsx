import Image from 'next/image';

interface BotIconProps {
  size?: number;
  className?: string;
}

export default function BotIcon({ size = 24, className = '' }: BotIconProps) {
  return (
    <Image
      src="/bot-icon.png"
      alt="🤖"
      width={size}
      height={size}
      className={`inline-block ${className}`}
    />
  );
}
