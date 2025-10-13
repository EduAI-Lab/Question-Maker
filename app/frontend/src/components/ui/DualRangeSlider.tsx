import React, { useState, useRef, useEffect } from 'react';

interface DualRangeSliderProps {
  min: number;
  max: number;
  easyBoundary: number; // Left handle - boundary between Easy and Medium
  hardBoundary: number; // Right handle - boundary between Medium and Hard
  onChange: (easyBoundary: number, hardBoundary: number) => void;
  step?: number;
  className?: string;
}

export const DualRangeSlider: React.FC<DualRangeSliderProps> = ({
  min,
  max,
  easyBoundary,
  hardBoundary,
  onChange,
  step = 1,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState<'easy' | 'hard' | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const getPercentage = (value: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  const getValueFromPercentage = (percentage: number) => {
    return Math.round((percentage / 100) * (max - min) + min);
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'easy' | 'hard') => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const newValue = getValueFromPercentage(percentage);

    if (isDragging === 'easy') {
      const clampedValue = Math.min(newValue, hardBoundary - step);
      onChange(Math.max(min, clampedValue), hardBoundary);
    } else {
      const clampedValue = Math.max(newValue, easyBoundary + step);
      onChange(easyBoundary, Math.min(max, clampedValue));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, easyBoundary, hardBoundary]);

  const easyPercentage = getPercentage(easyBoundary);
  const hardPercentage = getPercentage(hardBoundary);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={sliderRef}
        className="relative h-4 bg-gray-200 rounded cursor-pointer"
        onMouseDown={(e) => {
          const rect = sliderRef.current?.getBoundingClientRect();
          if (!rect) return;
          
          const percentage = ((e.clientX - rect.left) / rect.width) * 100;
          const newValue = getValueFromPercentage(percentage);
          
          // Determine which handle to move based on which is closer
          const easyDistance = Math.abs(newValue - easyBoundary);
          const hardDistance = Math.abs(newValue - hardBoundary);
          
          if (easyDistance < hardDistance) {
            const clampedValue = Math.min(newValue, hardBoundary - step);
            onChange(Math.max(min, clampedValue), hardBoundary);
          } else {
            const clampedValue = Math.max(newValue, easyBoundary + step);
            onChange(easyBoundary, Math.min(max, clampedValue));
          }
        }}
      >
        {/* Track */}
        <div className="absolute top-0 left-0 right-0 h-4 bg-gray-200 rounded"></div>
        
        {/* Easy segment (light green) */}
        <div
          className="absolute top-0 h-4 bg-green-300 rounded-l"
          style={{
            left: '0%',
            width: `${easyPercentage}%`
          }}
        ></div>
        
        {/* Medium segment (yellow) */}
        <div
          className="absolute top-0 h-4 bg-yellow-400"
          style={{
            left: `${easyPercentage}%`,
            width: `${hardPercentage - easyPercentage}%`
          }}
        ></div>
        
        {/* Hard segment (red) */}
        <div
          className="absolute top-0 h-4 bg-red-400 rounded-r"
          style={{
            left: `${hardPercentage}%`,
            width: `${100 - hardPercentage}%`
          }}
        ></div>
        
        {/* Easy handle */}
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-green-600 rounded-full cursor-pointer shadow-sm hover:bg-green-700 transition-colors border border-white"
          style={{ left: `${easyPercentage}%`, marginLeft: '-6px' }}
          onMouseDown={(e) => handleMouseDown(e, 'easy')}
        ></div>
        
        {/* Hard handle */}
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full cursor-pointer shadow-sm hover:bg-red-700 transition-colors border border-white"
          style={{ left: `${hardPercentage}%`, marginLeft: '-6px' }}
          onMouseDown={(e) => handleMouseDown(e, 'hard')}
        ></div>
      </div>
      
      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Easy</span>
        <span>Medium</span>
        <span>Hard</span>
      </div>
    </div>
  );
};
