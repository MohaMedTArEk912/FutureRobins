import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useSecretGame } from '../context/SecretGameContext';
import { NoirGeometricSnakeCanvas } from './NoirGeometricSnakeCanvas';

const NOIR_STAGE_GRAIN =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23s)' opacity='0.06'/%3E%3C/svg%3E\")";

export const AmbientBackground: React.FC = React.memo(() => {
    const { isBento } = useTheme();
    const { activeGame } = useSecretGame();

    return (
        <div
            className="ambient-background fixed inset-0 overflow-hidden pointer-events-none z-0 select-none"
            style={{
                contain: 'strict',
                willChange: 'transform',
                transform: 'translateZ(0)'
            }}
            aria-hidden="true"
        >
            {isBento ? (
                /* Bento Mode: Solid floating geometric shapes (zero gradients), hidden during secret Bento Arcade */
                activeGame === 'bento-arcade' ? null : (
                <>
                    {/* Top-left cluster */}
                    <div className="absolute top-[6%] left-[4%] w-10 h-10 bg-[#fde047] border-[2.5px] border-black rounded-xl shadow-[3px_3px_0px_#000] rotate-12 animate-[float_6s_ease-in-out_infinite]" />
                    <div className="absolute top-[14%] left-[8%] w-4 h-4 bg-black rounded-full" />

                    {/* Top-right cluster */}
                    <div className="absolute top-[8%] right-[6%] w-7 h-7 bg-[#bae6fd] border-[2.5px] border-black rounded-full shadow-[2px_2px_0px_#000] animate-[float_8s_ease-in-out_infinite_1s]" />
                    <div className="absolute top-[18%] right-[3%] w-3 h-3 bg-black rotate-45" />

                    {/* Mid-left */}
                    <div className="absolute top-[40%] left-[2%] w-5 h-5 bg-[#bef264] border-[2px] border-black rounded-lg shadow-[2px_2px_0px_#000] -rotate-12 animate-[float_7s_ease-in-out_infinite_0.5s]" />

                    {/* Mid-right */}
                    <div className="absolute top-[55%] right-[2%] w-8 h-8 bg-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] rotate-45 animate-[float_9s_ease-in-out_infinite_2s]" />
                    <div className="absolute top-[48%] right-[5%] w-3 h-3 bg-black rounded-full" />

                    {/* Bottom-left */}
                    <div className="absolute bottom-[12%] left-[3%] w-8 h-8 bg-white border-[2.5px] border-black shadow-[3px_3px_0px_#000] rotate-45 animate-[float_7s_ease-in-out_infinite_1.5s]" />
                    <div className="absolute bottom-[6%] left-[7%] w-5 h-5 bg-[#fed7aa] border-[2px] border-black rounded-lg shadow-[2px_2px_0px_#000] rotate-6 animate-[float_8s_ease-in-out_infinite_3s]" />

                    {/* Bottom-right */}
                    <div className="absolute bottom-[10%] right-[5%] w-6 h-6 bg-[#bae6fd] border-[2px] border-black rounded-full shadow-[2px_2px_0px_#000] animate-[float_6s_ease-in-out_infinite_2.5s]" />
                    <div className="absolute bottom-[20%] right-[8%] w-3 h-3 bg-black rotate-45" />

                    {/* Center-scattered accents */}
                    <div className="absolute top-[28%] left-[15%] w-3 h-3 bg-black rounded-full opacity-40" />
                    <div className="absolute top-[70%] right-[15%] w-3 h-3 bg-black rounded-full opacity-40" />
                    <div className="absolute top-[85%] left-[45%] w-4 h-4 bg-[#fde047] border-[2px] border-black rounded-full shadow-[2px_2px_0px_#000] animate-[float_10s_ease-in-out_infinite_4s]" />
                </>
                )
            ) : (
                /* Noir Studio Dark Mode: Tactile matte grain stage + interactive geometric orthogonal snake (zero gradients) */
                <div className="absolute inset-0">
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: NOIR_STAGE_GRAIN,
                            backgroundRepeat: 'repeat',
                            backgroundSize: '160px 160px'
                        }}
                    />
                    {activeGame !== 'noir-snake' && <NoirGeometricSnakeCanvas />}
                </div>
            )}
        </div>
    );
});

AmbientBackground.displayName = 'AmbientBackground';
