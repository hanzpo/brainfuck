import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '../lib/utils';

interface MemoryVisualizerProps {
  memory: Uint8Array;
  pointer: number;
}

export const MemoryVisualizer: React.FC<MemoryVisualizerProps> = ({ 
  memory, 
  pointer
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCells, setVisibleCells] = useState(20);

  // Calculate how many cells can fit in the container width
  const calculateVisibleCells = useCallback(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth - 32; // Subtract padding
      const cellWidth = 52; // 48px cell + 4px gap
      const maxCells = Math.floor(containerWidth / cellWidth);
      setVisibleCells(Math.max(10, Math.min(maxCells, 50))); // Min 10, max 50 cells
    }
  }, []);

  // Set up ResizeObserver to watch container size changes
  useEffect(() => {
    calculateVisibleCells();

    const resizeObserver = new ResizeObserver(() => {
      calculateVisibleCells();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateVisibleCells]);

  // Calculate visible range with pointer centered
  const startIndex = Math.max(0, pointer - Math.floor(visibleCells / 2));
  const endIndex = Math.min(memory.length, startIndex + visibleCells);
  const adjustedStartIndex = Math.max(0, endIndex - visibleCells);
  const visibleMemory = Array.from(memory.slice(adjustedStartIndex, endIndex));

  return (
    <div ref={containerRef} className="bg-muted border rounded-md p-4">
      <div className="mb-2 text-sm font-medium text-foreground">
        Memory Visualization (Pointer at: {pointer})
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max justify-center pt-3">
          {visibleMemory.map((value, index) => {
            const actualIndex = adjustedStartIndex + index;
            const isPointer = actualIndex === pointer;
            
            return (
              <div
                key={actualIndex}
                data-index={actualIndex}
                className={cn(
                  "flex flex-col items-center",
                  isPointer && "relative"
                )}
              >
                {/* Pointer indicator */}
                {isPointer && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-foreground" />
                  </div>
                )}
                
                {/* Memory cell */}
                <div
                  className={cn(
                    "w-12 h-12 flex items-center justify-center font-mono text-sm border-2 rounded",
                    isPointer ? "border-foreground bg-accent" : "border-border bg-card",
                    value > 0 && "font-bold"
                  )}
                >
                  {value}
                </div>
                
                {/* Address */}
                <div className="text-xs text-muted-foreground mt-1">
                  {actualIndex}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* ASCII representation */}
      <div className="mt-4 pt-4 border-t">
        <div className="text-sm font-medium text-foreground mb-2">ASCII Characters:</div>
        <div className="flex gap-1 font-mono text-xs overflow-x-auto justify-center">
          {visibleMemory.map((value, index) => {
            const actualIndex = adjustedStartIndex + index;
            const isPointer = actualIndex === pointer;
            const char = value >= 32 && value <= 126 ? String.fromCharCode(value) : '·';
            
            return (
              <div
                key={actualIndex}
                className={cn(
                  "w-12 text-center",
                  isPointer && "font-bold"
                )}
              >
                {char}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 