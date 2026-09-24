import React, { useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  currentCharIndex?: number;
  readOnly?: boolean;
}

const TAB_SIZE = 4;

// Converts a character offset into a zero-based line and on-screen column
function getPosition(text: string, index: number) {
  const before = text.slice(0, index).split('\n');
  let column = 0;
  for (const char of before[before.length - 1]) {
    column = char === '\t' ? column + TAB_SIZE - (column % TAB_SIZE) : column + 1;
  }
  return { line: before.length - 1, column };
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ value, onChange, currentCharIndex, readOnly }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [cursorLine, setCursorLine] = useState<number>(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });

  const lineCount = value.split('\n').length;
  const charPos = currentCharIndex !== undefined && currentCharIndex < value.length
    ? getPosition(value, currentCharIndex)
    : null;

  // Track cursor position for editor line highlighting
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    setCursorLine(getPosition(textarea.value, textarea.selectionStart).line);
  };

  // Keep line numbers and overlays aligned with the textarea's scroll position
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    setScroll({ top: scrollTop, left: scrollLeft });
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
    <div className="flex h-full bg-card border rounded-md overflow-hidden">
      <div
        ref={lineNumbersRef}
        className="flex-shrink-0 select-none bg-muted text-muted-foreground text-sm font-mono p-4 pr-2 overflow-y-hidden"
        style={{ minHeight: 0 }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-[1.5rem] pr-2 text-right transition-colors",
              cursorLine === i && "text-foreground font-semibold",
              charPos?.line === i && "text-yellow-500"
            )}
          >
            {i + 1}
          </div>
        ))}
      </div>
      <div className="relative flex-1 overflow-hidden font-mono text-sm">
        <div
          className="absolute left-0 right-0 h-[1.5rem] bg-accent/10 border-l-2 border-accent pointer-events-none"
          style={{
            top: `calc(${cursorLine * 1.5}rem + 1rem)`,
            transform: `translateY(${-scroll.top}px)`,
          }}
        />
        {charPos && (
          <div
            className="absolute pointer-events-none"
            style={{
              top: `calc(${charPos.line * 1.5}rem + 1rem)`,
              left: `calc(${charPos.column}ch + 1rem)`,
              transform: `translate(${-scroll.left}px, ${-scroll.top}px)`,
            }}
          >
            <span className="block w-[1ch] h-[1.5rem] bg-red-500 opacity-40 animate-pulse" />
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onScroll={handleScroll}
          readOnly={readOnly}
          wrap="off"
          className="relative z-10 w-full h-full p-4 bg-transparent resize-none outline-none overflow-auto whitespace-pre"
          style={{ lineHeight: '1.5rem', minHeight: 0, tabSize: TAB_SIZE }}
          placeholder="Enter your Brainfuck code here..."
          spellCheck={false}
        />
      </div>
    </div>
  );
};
