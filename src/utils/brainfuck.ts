export interface BrainfuckState {
  memory: Uint8Array;
  pointer: number;
  programCounter: number;
  output: string;
  isDone: boolean;
  isPaused: boolean;
}

const COMMANDS = new Set(['>', '<', '+', '-', '.', ',', '[', ']']);

// How long run() executes synchronously before yielding to the UI
const TIME_SLICE_MS = 16;

export class BrainfuckInterpreter {
  private program: string;
  private jumps: Map<number, number>;
  private memory: Uint8Array;
  private pointer = 0;
  private programCounter = 0;
  private output = '';
  private input = '';
  private inputIndex = 0;
  private isPaused = false;
  private isHalted = false;
  private isBusy = false;
  private onOutput?: (char: string) => void;
  private onInputRequest?: () => Promise<string>;

  constructor(
    program: string,
    memorySize: number = 30000,
    onOutput?: (char: string) => void,
    onInputRequest?: () => Promise<string>
  ) {
    this.program = program;
    this.jumps = BrainfuckInterpreter.matchBrackets(program);
    this.memory = new Uint8Array(memorySize);
    this.onOutput = onOutput;
    this.onInputRequest = onInputRequest;
    this.skipToCommand();
  }

  // Maps each bracket's index to its partner's, or throws on a mismatch
  static matchBrackets(program: string): Map<number, number> {
    const jumps = new Map<number, number>();
    const stack: number[] = [];
    for (let i = 0; i < program.length; i++) {
      if (program[i] === '[') {
        stack.push(i);
      } else if (program[i] === ']') {
        const open = stack.pop();
        if (open === undefined) {
          throw new SyntaxError(`Unmatched ']' at ${describePosition(program, i)}`);
        }
        jumps.set(open, i);
        jumps.set(i, open);
      }
    }
    if (stack.length > 0) {
      throw new SyntaxError(`Unmatched '[' at ${describePosition(program, stack[stack.length - 1])}`);
    }
    return jumps;
  }

  get isDone(): boolean {
    return this.isHalted || this.programCounter >= this.program.length;
  }

  getState(): BrainfuckState {
    return {
      memory: this.memory,
      pointer: this.pointer,
      programCounter: this.programCounter,
      output: this.output,
      isDone: this.isDone,
      isPaused: this.isPaused,
    };
  }

  // Executes one instruction. Returns a promise only when waiting on input.
  private exec(): void | Promise<void> {
    const instruction = this.program[this.programCounter];

    switch (instruction) {
      case '>':
        this.pointer = (this.pointer + 1) % this.memory.length;
        break;

      case '<':
        this.pointer = (this.pointer - 1 + this.memory.length) % this.memory.length;
        break;

      case '+':
        this.memory[this.pointer]++;
        break;

      case '-':
        this.memory[this.pointer]--;
        break;

      case '.': {
        const outputChar = String.fromCharCode(this.memory[this.pointer]);
        this.output += outputChar;
        this.onOutput?.(outputChar);
        break;
      }

      case ',':
        if (this.inputIndex >= this.input.length && this.onInputRequest) {
          return this.onInputRequest().then((newInput) => {
            this.input += newInput;
            this.readInput();
            this.advance();
          });
        }
        this.readInput();
        break;

      case '[':
        if (this.memory[this.pointer] === 0) {
          this.programCounter = this.jumps.get(this.programCounter)!;
        }
        break;

      case ']':
        if (this.memory[this.pointer] !== 0) {
          this.programCounter = this.jumps.get(this.programCounter)!;
        }
        break;
    }

    this.advance();
  }

  private readInput() {
    // EOF leaves 0 in the cell
    this.memory[this.pointer] =
      this.inputIndex < this.input.length ? this.input.charCodeAt(this.inputIndex++) : 0;
  }

  private advance() {
    this.programCounter++;
    this.skipToCommand();
  }

  // Moves past comments so programCounter always rests on a real instruction
  private skipToCommand() {
    while (this.programCounter < this.program.length && !COMMANDS.has(this.program[this.programCounter])) {
      this.programCounter++;
    }
  }

  // Executes one instruction. Returns false if nothing ran (finished, or already busy).
  async step(): Promise<boolean> {
    if (this.isBusy || this.isDone) return false;
    this.isBusy = true;
    try {
      await this.exec();
      return true;
    } finally {
      this.isBusy = false;
    }
  }

  // Runs until finished, paused, or halted, calling onUpdate each time it yields to the UI.
  // getDelay is read every step so speed changes apply mid-run; 0 runs as fast as possible.
  async run(onUpdate?: () => void, getDelay: () => number = () => 0) {
    this.isPaused = false;
    // A loop is already active (e.g. waiting on input); un-pausing lets it continue
    if (this.isBusy) return;

    this.isBusy = true;
    try {
      while (!this.isDone && !this.isPaused) {
        const delay = getDelay();
        if (delay > 0) {
          await this.exec();
          onUpdate?.();
          await sleep(delay);
          continue;
        }

        const sliceEnd = performance.now() + TIME_SLICE_MS;
        while (!this.isDone && !this.isPaused && performance.now() < sliceEnd) {
          // Check the clock every 1000 instructions to keep the hot loop cheap
          for (let i = 0; i < 1000 && !this.isDone && !this.isPaused; i++) {
            const pending = this.exec();
            if (pending) {
              onUpdate?.();
              await pending;
            }
          }
        }
        onUpdate?.();
        await sleep(0);
      }
    } finally {
      this.isBusy = false;
    }
  }

  pause() {
    this.isPaused = true;
  }

  // Stops execution permanently; any active run loop exits at its next check
  halt() {
    this.isHalted = true;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describePosition(program: string, index: number): string {
  const before = program.slice(0, index).split('\n');
  return `line ${before.length}, column ${before[before.length - 1].length + 1}`;
}
