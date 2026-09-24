import React, { useState, useRef, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { CodeEditor } from './components/CodeEditor';
import Terminal from './components/Terminal';
import type { TerminalRef } from './components/Terminal';
import { MemoryVisualizer } from './components/MemoryVisualizer';
import { Button } from './components/ui/button';
import { BrainfuckInterpreter } from './utils/brainfuck';
import type { BrainfuckState } from './utils/brainfuck';
import { Play, Pause, RotateCcw, StepForward } from 'lucide-react';

const STORAGE_KEY = 'brainfuck-code';

// Delay between instructions when running, in milliseconds
const SPEEDS = [
  { label: 'Slow', delay: 200 },
  { label: 'Medium', delay: 50 },
  { label: 'Fast', delay: 5 },
  { label: 'Instant', delay: 0 },
];
const DEFAULT_SPEED = 5;

// Default Hello World program in Brainfuck
const DEFAULT_PROGRAM = `++++++++++[>+++++++>++++++++++>+++>+<<<<-]
>++.>+.+++++++..+++.>++.<<+++++++++++++++.
>.+++.------.--------.>+.>.`;

function loadSavedCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_PROGRAM;
  } catch {
    return DEFAULT_PROGRAM;
  }
}

function App() {
  const [code, setCode] = useState<string>(loadSavedCode);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [interpreterState, setInterpreterState] = useState<BrainfuckState | null>(null);
  const [executionState, setExecutionState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [isStepping, setIsStepping] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  // Read by the running interpreter so speed changes apply immediately
  const speedRef = useRef<number>(DEFAULT_SPEED);
  const terminalRef = useRef<TerminalRef>(null);
  const interpreterRef = useRef<BrainfuckInterpreter | null>(null);

  // Handle code changes
  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    setIsSaved(false);
  }, []);

  // Save code to localStorage
  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, code);
      setIsSaved(true);
    } catch {
      terminalRef.current?.error('Could not save: browser storage is unavailable.');
    }
  }, [code]);

  // Create a fresh interpreter wired to the terminal, or report a syntax error
  const createInterpreter = useCallback(() => {
    interpreterRef.current?.halt();
    interpreterRef.current = null;
    terminalRef.current?.reset();

    try {
      const interpreter = new BrainfuckInterpreter(
        code,
        30000,
        (char: string) => terminalRef.current?.write(char),
        () => terminalRef.current?.requestInput() ?? Promise.resolve('')
      );
      interpreterRef.current = interpreter;
      setInterpreterState(interpreter.getState());
      return interpreter;
    } catch (e) {
      terminalRef.current?.error((e as Error).message);
      setInterpreterState(null);
      return null;
    }
  }, [code]);

  // Run until the program finishes or is paused
  const runInterpreter = useCallback(async (interpreter: BrainfuckInterpreter) => {
    setExecutionState('running');
    await interpreter.run(() => {
      if (interpreterRef.current === interpreter) {
        setInterpreterState(interpreter.getState());
      }
    }, () => speedRef.current);

    // Ignore interpreters that were reset or replaced while running
    if (interpreterRef.current !== interpreter) return;
    const state = interpreter.getState();
    setInterpreterState(state);
    setExecutionState(state.isDone ? 'idle' : state.isPaused ? 'paused' : 'running');
  }, []);

  // Start/Resume the program
  const handleStart = useCallback(() => {
    if (executionState === 'paused' && interpreterRef.current) {
      runInterpreter(interpreterRef.current);
    } else if (executionState === 'idle') {
      const interpreter = createInterpreter();
      if (interpreter) runInterpreter(interpreter);
    }
  }, [executionState, createInterpreter, runInterpreter]);

  // Pause the program
  const handlePause = useCallback(() => {
    if (interpreterRef.current && executionState === 'running') {
      interpreterRef.current.pause();
      setExecutionState('paused');
    }
  }, [executionState]);

  // Reset the program
  const handleReset = useCallback(() => {
    interpreterRef.current?.halt();
    interpreterRef.current = null;
    setInterpreterState(null);
    terminalRef.current?.reset();
    setExecutionState('idle');
    setIsStepping(false);
  }, []);

  // Step through the program, starting a paused session if none is active
  const handleStep = useCallback(async () => {
    if (executionState === 'running' || isStepping) return;

    let interpreter = interpreterRef.current;
    if (executionState === 'idle' || !interpreter) {
      interpreter = createInterpreter();
      if (!interpreter) return;
    }

    setExecutionState('paused');
    setIsStepping(true);
    await interpreter.step();

    if (interpreterRef.current !== interpreter) return;
    setIsStepping(false);
    const state = interpreter.getState();
    setInterpreterState(state);
    if (state.isDone) setExecutionState('idle');
  }, [executionState, isStepping, createInterpreter]);

  const handleSpeedChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const delay = Number(e.target.value);
    speedRef.current = delay;
    setSpeed(delay);
  }, []);

  const isSessionActive = executionState !== 'idle';

  return (
    <div className="h-screen flex flex-col bg-background">
      <TopBar isSaved={isSaved} onSave={handleSave} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Code Editor */}
        <div className="w-1/2 p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-2">
            Code Editor
            {isSessionActive && (
              <span className="ml-2 font-normal text-muted-foreground">(read-only while running, Reset to edit)</span>
            )}
          </h2>
          <div className="flex-1 min-h-0">
            <CodeEditor
              value={code}
              onChange={handleCodeChange}
              currentCharIndex={isSessionActive ? interpreterState?.programCounter : undefined}
              readOnly={isSessionActive}
            />
          </div>
        </div>
        
        {/* Terminal */}
        <div className="w-1/2 p-4 flex flex-col">
          <h2 className="text-sm font-semibold mb-2">Terminal</h2>
          <div className="flex-1 border rounded-md overflow-hidden">
            <Terminal ref={terminalRef} />
          </div>
        </div>
      </div>
      
      {/* Controls */}
      <div className="px-4 py-2 bg-card border-t">
        <div className="flex gap-2">
          {executionState === 'running' ? (
            <Button
              onClick={handlePause}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          ) : (
            <Button
              onClick={handleStart}
              variant="default"
              disabled={isStepping}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {executionState === 'paused' ? 'Resume' : 'Start'}
            </Button>
          )}
          
          <Button
            onClick={handleReset}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          
          <Button
            onClick={handleStep}
            variant="outline"
            disabled={executionState === 'running' || isStepping}
            className="flex items-center gap-2"
          >
            <StepForward className="h-4 w-4" />
            Step
          </Button>

          <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            Speed
            <select
              value={speed}
              onChange={handleSpeedChange}
              className="h-10 rounded-md border border-input bg-background px-3 text-foreground"
            >
              {SPEEDS.map(({ label, delay }) => (
                <option key={delay} value={delay}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      
      {/* Memory Visualizer */}
      <div className="p-4 bg-card border-t">
        {interpreterState ? (
          <MemoryVisualizer
            memory={interpreterState.memory}
            pointer={interpreterState.pointer}
          />
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Run or step through your program to see memory visualization
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
