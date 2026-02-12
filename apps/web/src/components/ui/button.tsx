'use client';

import { cn } from '@/lib/utils';
import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'accent' | 'glow';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 touch-target',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-40',
          'active:scale-[0.97] transition-transform',
          {
            'bg-gradient-to-l from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-900/20': variant === 'default',
            'glass text-foreground hover:bg-white/10': variant === 'secondary',
            'bg-gradient-to-l from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500': variant === 'destructive',
            'border border-white/10 bg-transparent hover:bg-white/5 text-foreground': variant === 'outline',
            'bg-transparent hover:bg-white/5 text-foreground': variant === 'ghost',
            'bg-gradient-to-l from-amber-500 to-yellow-500 text-gray-900 font-bold hover:from-amber-400 hover:to-yellow-400 shadow-lg shadow-amber-900/20': variant === 'accent',
            'bg-gradient-to-l from-purple-600 to-blue-600 text-white glow-primary hover:from-purple-500 hover:to-blue-500': variant === 'glow',
          },
          {
            'h-11 px-6 py-2 text-base': size === 'default',
            'h-9 px-4 text-sm rounded-lg': size === 'sm',
            'h-14 px-8 text-lg rounded-2xl': size === 'lg',
            'h-10 w-10 rounded-xl': size === 'icon',
          },
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
export { Button };
