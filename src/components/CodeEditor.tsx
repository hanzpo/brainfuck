import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentCharIndex?: number;
  readOnly?: boolean;
}

const TAB_SIZE = 4;

// Text styles shared by the textarea and the mirror behind it, so both wrap identically
const TEXT_STYLE = 'px-4 whitespace-pre-wrap break-all leading-[1.5rem]';

// Converts a character offset into a zero-based line and column
function getPosition(text: string, index: number) {
  const before = text.slice(0, index).split('\n');
  return { line: before.length - 1, column: before[before.length - 1].length };
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, currentCharIndex, readOnly }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const [cursorLine, setCursorLine] = useState<number>(0);

  const lines = value.split('\n');
  const charPos = currentCharIndex !== undefined && currentCharIndex < value.length
    ? getPosition(value, currentCharIndex)
    : null;

  // Scroll to keep the executing instruction visible
  useEffect(() => {
    const container = scrollRef.current;
    const marker = markerRef.current;
    if (!container || !marker) return;

    const margin = 24;
    const containerRect = container.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    if (markerRect.top < containerRect.top + margin) {
      container.scrollTop -= containerRect.top + margin - markerRect.top;
    } else if (markerRect.bottom > containerRect.bottom - margin) {
      container.scrollTop += markerRect.bottom - (containerRect.bottom - margin);
    }
  }, [currentCharIndex]);

  // Track cursor position for editor line highlighting
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    setCursorLine(getPosition(textarea.value, textarea.selectionStart).line);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !readOnly) {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      // Reset cursor position after the tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  return (
    <div
      ref={scrollRef}
      className="h-full bg-card border rounded-md overflow-y-auto font-mono text-sm"
      style={{ tabSize: TAB_SIZE }}
    >
      <div className="relative min-h-full py-4">
        {/* Gutter background */}
        <div className="absolute inset-y-0 left-0 w-12 bg-muted" />

        {/* Mirror of the text: sizes each row (so line numbers follow wrapping) and draws highlights */}
        {lines.map((line, i) => (
          <div key={i} className="relative flex" aria-hidden>
            <div
              className={cn(
                "w-12 flex-shrink-0 pr-3 text-right leading-[1.5rem] select-none text-muted-foreground transition-colors",
                cursorLine === i && "text-foreground font-semibold",
                charPos?.line === i && "text-yellow-500"
              )}
            >
              {i + 1}
            </div>
            <div
              className={cn(
                TEXT_STYLE,
                "flex-1 min-w-0 min-h-[1.5rem] text-transparent",
                cursorLine === i && "bg-accent/10 shadow-[inset_2px_0_0_var(--color-accent)]"
              )}
            >
              {charPos?.line === i ? (
                <>
                  {line.slice(0, charPos.column)}
                  <span ref={markerRef} className="bg-red-500/40 animate-pulse">
                    {line[charPos.column]}
                  </span>
                  {line.slice(charPos.column + 1)}
                </>
              ) : (
                line
              )}
            </div>
          </div>
        ))}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          readOnly={readOnly}
          className={cn(
            TEXT_STYLE,
            "absolute inset-y-0 left-12 right-0 py-4 bg-transparent resize-none outline-none overflow-hidden"
          )}
          placeholder="Enter your Brainfuck code here..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};
