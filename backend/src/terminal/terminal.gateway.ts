import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as pty from 'node-pty';
import { spawn, ChildProcess } from 'child_process';
import { WorkspaceService } from '../workspace/workspace.service';
import * as os from 'os';

@WebSocketGateway({ cors: { origin: '*' } })
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private ptys: Map<string, pty.IPty> = new Map();
  private runningProcs: Map<string, ChildProcess> = new Map();
  private lastRunArgs: Map<string, { project: string; command: string }> = new Map();

  constructor(private workspaceService: WorkspaceService) {}

  private killProcessGroup(child: ChildProcess) {
    if (!child || !child.pid) return;
    const pid = child.pid;
    try {
      if (os.platform() === 'win32') {
        spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
      } else {
        process.kill(-pid, 'SIGINT');
        setTimeout(() => {
          try {
            process.kill(-pid, 'SIGKILL');
          } catch {}
        }, 1000);
      }
    } catch (err) {
      try { child.kill('SIGINT'); } catch {}
    }
  }

  handleConnection() {}

  handleDisconnect(client: Socket) {
    const ptyProcess = this.ptys.get(client.id);
    if (ptyProcess) {
      ptyProcess.kill();
      this.ptys.delete(client.id);
    }
    const child = this.runningProcs.get(client.id);
    if (child) {
      this.killProcessGroup(child);
      this.runningProcs.delete(client.id);
    }
    this.lastRunArgs.delete(client.id);
  }

  @SubscribeMessage('start-terminal')
  handleStartTerminal(
    @MessageBody() data: { project: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const projectPath = this.workspaceService.getProjectPath(data.project);
      const shell = os.platform() === 'win32'
        ? 'powershell.exe'
        : (process.env.SHELL || '/bin/zsh');

      const env = { ...process.env };
      delete env.PWD;
      delete env.OLDPWD;

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: projectPath,
        env: env,
      });

      this.ptys.set(client.id, ptyProcess);

      ptyProcess.onData((output) => {
        client.emit('terminal-output', output);
      });

      ptyProcess.onExit(() => {
        this.ptys.delete(client.id);
        client.emit('process-exit');
      });

      return { status: 'started' };
    } catch (e) {
      client.emit(
        'terminal-output',
        `Failed to start terminal: ${(e as Error).message}\r\n`,
      );
    }
  }

  @SubscribeMessage('terminal-input')
  handleTerminalInput(
    @MessageBody() data: { input: string },
    @ConnectedSocket() client: Socket,
  ) {
    const ptyProcess = this.ptys.get(client.id);
    if (ptyProcess) {
      ptyProcess.write(data.input);
    }
  }

  @SubscribeMessage('resize-terminal')
  handleResizeTerminal(
    @MessageBody() data: { cols: number; rows: number },
    @ConnectedSocket() client: Socket,
  ) {
    const ptyProcess = this.ptys.get(client.id);
    if (ptyProcess) {
      ptyProcess.resize(data.cols, data.rows);
    }
  }

  @SubscribeMessage('run-command')
  handleRunCommand(
    @MessageBody() data: { project: string; command: string },
    @ConnectedSocket() client: Socket,
  ) {
    const prev = this.runningProcs.get(client.id);
    if (prev) {
      this.killProcessGroup(prev);
      this.runningProcs.delete(client.id);
    }

    this.lastRunArgs.set(client.id, { project: data.project, command: data.command });

    const projectPath = this.workspaceService.getProjectPath(data.project);
    const shell = os.platform() === 'win32' ? 'cmd' : '/bin/sh';
    const shellFlag = os.platform() === 'win32' ? '/c' : '-c';

    const env = {
      ...process.env,
      FORCE_COLOR: '1',
      TERM: 'xterm-256color',
      PYTHONUNBUFFERED: '1',
    };

    const child = spawn(shell, [shellFlag, data.command], {
      cwd: projectPath,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    });

    this.runningProcs.set(client.id, child);

    client.emit('terminal-output', '\r\n');

    const forward = (chunk: Buffer | string) => {
      const text = chunk.toString().replace(/\r?\n/g, '\r\n');
      client.emit('terminal-output', text);
    };

    child.stdout?.on('data', forward);
    child.stderr?.on('data', forward);

    child.on('close', (code) => {
      this.runningProcs.delete(client.id);
      const msg = code === 0
        ? '\r\n\x1b[32m[Process exited successfully]\x1b[0m\r\n'
        : `\r\n\x1b[31m[Process exited with code ${code}]\x1b[0m\r\n`;
      client.emit('terminal-output', msg);
      client.emit('process-exit');
      const ptyProc = this.ptys.get(client.id);
      if (ptyProc) ptyProc.write('\r');
    });

    child.on('error', (err) => {
      this.runningProcs.delete(client.id);
      client.emit('terminal-output', `\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`);
      client.emit('process-exit');
    });
  }

  @SubscribeMessage('stop-command')
  handleStopCommand(@ConnectedSocket() client: Socket) {
    const child = this.runningProcs.get(client.id);
    if (child) {
      this.killProcessGroup(child);
      this.runningProcs.delete(client.id);
    }
  }

  @SubscribeMessage('restart-command')
  handleRestartCommand(@ConnectedSocket() client: Socket) {
    const lastArgs = this.lastRunArgs.get(client.id);
    if (!lastArgs) return;

    const child = this.runningProcs.get(client.id);
    if (child) {
      this.killProcessGroup(child);
      this.runningProcs.delete(client.id);
    }

    client.emit('terminal-output', '\r\n\x1b[33m[Restarting...]\x1b[0m\r\n');

    setTimeout(() => {
      this.handleRunCommand(lastArgs, client);
    }, 800);
  }
}
