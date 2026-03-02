'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GameBoard } from '@/components/GameBoard';
import { useGameStore } from '@/store/gameStore';

export default function OnlinePlayPage() {
    const router = useRouter();
    const { gameState, leaveRoom } = useGameStore();

    useEffect(() => {
        // If no game state, redirect to lobby
        if (!gameState) {
            router.push('/online');
        }
    }, [gameState, router]);

    if (!gameState) {
        return (
            <div className="flex items-center justify-center min-h-[100dvh]">
                <p className="text-muted-foreground animate-pulse">טוען משחק...</p>
            </div>
        );
    }

    const handleExit = () => {
        if (confirm('האם אתה בטוח שברצונך לצאת?')) {
            leaveRoom();
            router.push('/online');
        }
    };

    return <GameBoard onExit={handleExit} />;
}
