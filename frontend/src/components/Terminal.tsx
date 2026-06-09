import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

export interface TerminalRef {
  sendCommand: (cmd: string) => void;
  sendRaw: (data: string) => void;
  runCommand: (project: string, cmd: string) => void;
  stopCommand: () => void;
  restartCommand: () => void;
  clearScreen: () => void;
}

interface TerminalProps {
  projectName: string;
  onProcessExit?: () => void;
}

const TerminalComponent = forwardRef<TerminalRef, TerminalProps>(({ projectName, onProcessExit }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onProcessExitRef = useRef(onProcessExit);
  onProcessExitRef.current = onProcessExit;

  useImperativeHandle(ref, () => ({
    sendCommand: (cmd: string) => {
      socketRef.current?.emit('terminal-input', { input: cmd + '\r' });
    },
    sendRaw: (data: string) => {
      socketRef.current?.emit('terminal-input', { input: data });
    },
    runCommand: (project: string, cmd: string) => {
      socketRef.current?.emit('run-command', { project, command: cmd });
    },
    stopCommand: () => {
      socketRef.current?.emit('stop-command');
    },
    restartCommand: () => {
      socketRef.current?.emit('restart-command');
    },
    clearScreen: () => {
      xtermRef.current?.write('\x1b[2J\x1b[H');
    }
  }));

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0d1117',
        foreground: '#e6edf3',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    requestAnimationFrame(() => { fitAddon.fit(); });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const socket = io('http://localhost:3000');
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('start-terminal', { project: projectName });
      term.write('\r\n\x1b[32m✓ Terminal connected — ' + projectName + '\x1b[0m\r\n');
    });

    socket.on('disconnect', () => {
      term.write('\r\n\x1b[31m✗ Terminal disconnected\x1b[0m\r\n');
    });

    socket.on('terminal-output', (data: string) => {
      term.write(data);
    });

    socket.on('process-exit', () => {
      onProcessExitRef.current?.();
    });

    term.onData((data) => {
      socket.emit('terminal-input', { input: data });
    });

    const handleResize = () => {
      fitAddon.fit();
      socket.emit('resize-terminal', { cols: term.cols, rows: term.rows });
    };

    const resizeObserver = new ResizeObserver(() => { requestAnimationFrame(handleResize); });
    if (terminalRef.current) resizeObserver.observe(terminalRef.current);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, [projectName]);

  return <div ref={terminalRef} style={{ width: '100%', height: '100%', padding: '4px' }} />;
});

TerminalComponent.displayName = 'TerminalComponent';
export default TerminalComponent;
