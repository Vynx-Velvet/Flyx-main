'use client';

import * as React from 'react';


interface SliderProps {
    min: number;
    max: number;
    step?: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
    className?: string;
}

export function Slider({ min, max, step = 1, value, onChange, className = '' }: SliderProps) {
    const [isDragging, setIsDragging] = React.useState<'min' | 'max' | null>(null);
    const trackRef = React.useRef<HTMLDivElement>(null);

    const getPercentage = (val: number) => ((val - min) / (max - min)) * 100;

    const handleMouseDown = (thumb: 'min' | 'max') => (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDragging(thumb);
    };

    React.useEffect(() => {
        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging || !trackRef.current) return;

            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const rect = trackRef.current.getBoundingClientRect();
            const percentage = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
            const rawValue = percentage * (max - min) + min;
            const newValue = Math.round(rawValue / step) * step;

            if (isDragging === 'min') {
                const clampedValue = Math.min(newValue, value[1] - step);
                if (clampedValue >= min) onChange([clampedValue, value[1]]);
            } else {
                const clampedValue = Math.max(newValue, value[0] + step);
                if (clampedValue <= max) onChange([value[0], clampedValue]);
            }
        };

        const handleUp = () => setIsDragging(null);

        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('touchmove', handleMove);
            window.addEventListener('mouseup', handleUp);
            window.addEventListener('touchend', handleUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchend', handleUp);
        };
    }, [isDragging, min, max, step, value, onChange]);

    return (
        <div className={`relative h-6 flex items-center select-none ${className}`}>
            <div ref={trackRef} className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                {/* Active Track */}
                <div
                    className="absolute h-full bg-gradient-to-r from-[#2ee6c5] to-[#9b8cff]"
                    style={{
                        left: `${getPercentage(value[0])}%`,
                        right: `${100 - getPercentage(value[1])}%`,
                    }}
                />
            </div>

            {/* Min Thumb */}
            <div
                className="absolute w-4 h-4 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                style={{ left: `calc(${getPercentage(value[0])}% - 8px)` }}
                onMouseDown={handleMouseDown('min')}
                onTouchStart={handleMouseDown('min')}
            >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 hover:opacity-100 transition-opacity">
                    {value[0]}
                </div>
            </div>

            {/* Max Thumb */}
            <div
                className="absolute w-4 h-4 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                style={{ left: `calc(${getPercentage(value[1])}% - 8px)` }}
                onMouseDown={handleMouseDown('max')}
                onTouchStart={handleMouseDown('max')}
            >
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 hover:opacity-100 transition-opacity">
                    {value[1]}
                </div>
            </div>
        </div>
    );
}

export default Slider;
