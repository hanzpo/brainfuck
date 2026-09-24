import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface TerminalRef {
  write: (text: string) => void;
  error: (message: string) => void;
  clear: () => void;
  reset: () => void;
  requestInput: () => Promise<string>;
}

function writeBanner(xterm: XTerm) {
  xterm.writeln('Brainfuck Terminal');
  xterm.writeln('==================');
  xterm.writeln('Ready for input/output...\r\n');
}

const Terminal = React.forwardRef<TerminalRef>((_props, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const inputBufferRef = useRef<string>('');
  // Lines entered before the program asked for input
  const pendingLinesRef = useRef<string[]>([]);
  const inputResolverRef = useRef<((value: string) => void) | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      cursorBlink: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();
    writeBanner(xterm);

    // Handle terminal input; pasted text arrives as one chunk, so process it per character
    xterm.onData((data) => {
      for (const char of data) {
        if (char === '\r' || char === '\n') {
          xterm.write('\r\n');
          const line = inputBufferRef.current + '\n';
          inputBufferRef.current = '';

          const resolve = inputResolverRef.current;
          if (resolve) {
            inputResolverRef.current = null;
            resolve(line);
          } else {
            pendingLinesRef.current.push(line);
          }
        } else if (char === '\x7f' || char === '\b') {
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            xterm.write('\b \b');
          }
        } else if (char >= ' ' && char <= '~') {
          inputBufferRef.current += char;
          xterm.write(char);
        }
      }
    });

    xtermRef.current = xterm;

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  const write = useCallback((text: string) => {
    // Replace newlines with carriage return + newline for proper terminal display
    xtermRef.current?.write(text.replace(/\n/g, '\r\n'));
  }, []);

  const error = useCallback((message: string) => {
    xtermRef.current?.write(`\x1b[31m${message}\x1b[0m\r\n`);
  }, []);

  const clear = useCallback(() => {
    xtermRef.current?.clear();
  }, []);

  const reset = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.reset();
      writeBanner(xtermRef.current);
    }
    inputBufferRef.current = '';
    pendingLinesRef.current = [];
    inputResolverRef.current = null;
  }, []);

  const requestInput = useCallback((): Promise<string> => {
    const pending = pendingLinesRef.current.shift();
    if (pending !== undefined) return Promise.resolve(pending);
    xtermRef.current?.focus();
    return new Promise((resolve) => {
      inputResolverRef.current = resolve;
    });
  }, []);

  React.useImperativeHandle(
    ref,
    () => ({
      write,
      error,
      clear,
      reset,
      requestInput,
    }),
    [write, error, clear, reset, requestInput]
  );

  return (
    <div ref={terminalRef} className="h-full bg-card" />
  );
});

Terminal.displayName = 'Terminal';

export default Terminal;
