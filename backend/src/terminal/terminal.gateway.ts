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
import * as fs from 'fs';
import * as path from 'path';
import { WorkspaceService } from '../workspace/workspace.service';
import { AuthService } from '../auth/auth.service';
import * as os from 'os';

@WebSocketGateway({ cors: { origin: '*' } })
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private ptys: Map<string, pty.IPty> = new Map();
  private lastRunArgs: Map<string, { project: string; command: string }> = new Map();

  constructor(
    private workspaceService: WorkspaceService,
    private authService: AuthService,
  ) {}

  private getUserId(client: Socket): string {
    const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('Authentication required');
    const payload = this.authService.verifyToken(token);
    if (!payload || !payload.sub) throw new Error('Invalid or expired token');
    return payload.sub;
  }

  handleConnection() {}

  handleDisconnect(client: Socket) {
    const ptyProcess = this.ptys.get(client.id);
    if (ptyProcess) {
      try { ptyProcess.kill(); } catch {}
      this.ptys.delete(client.id);
    }
    this.lastRunArgs.delete(client.id);
  }

  @SubscribeMessage('start-terminal')
  handleStartTerminal(
    @MessageBody() data: { project: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = this.getUserId(client);
      const projectPath = this.workspaceService.getProjectPath(userId, data.project);
      const shell = os.platform() === 'win32'
        ? 'powershell.exe'
        : (process.env.SHELL || '/bin/zsh');

      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        FORCE_COLOR: '1',
        TERM: 'xterm-256color',
        PYTHONUNBUFFERED: '1',
      };
      delete env['PWD'];
      delete env['OLDPWD'];

      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: projectPath,
        env: env as Record<string, string>,
      });

      this.ptys.set(client.id, ptyProcess);

      ptyProcess.onData((output) => {
        client.emit('terminal-output', output);
      });

      ptyProcess.onExit(() => {
        this.ptys.delete(client.id);
      });

      return { status: 'started' };
    } catch (e) {
      client.emit('terminal-output', `Failed to start terminal: ${(e as Error).message}\r\n`);
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
    try {
      const userId = this.getUserId(client);
      const projectPath = this.workspaceService.getProjectPath(userId, data.project);
      this.lastRunArgs.set(client.id, { project: data.project, command: data.command });

      const ptyProcess = this.ptys.get(client.id);
      if (!ptyProcess) {
        client.emit('terminal-output', '\r\n\x1b[31mTerminal not ready. Please wait...\x1b[0m\r\n');
        return;
      }

      // Auto-install npm deps if package.json exists but node_modules doesn't
      const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));
      const hasNodeModules = fs.existsSync(path.join(projectPath, 'node_modules'));
      const needsInstall = hasPackageJson && !hasNodeModules;

      if (needsInstall) {
        client.emit('terminal-output', '\r\n\x1b[33m📦 Auto-installing dependencies first...\x1b[0m\r\n');
        ptyProcess.write(`npm install && ${data.command}\r`);
      } else {
        ptyProcess.write(`${data.command}\r`);
      }
    } catch (e) {
      client.emit('terminal-output', `\r\n\x1b[31mError: ${(e as Error).message}\x1b[0m\r\n`);
      client.emit('process-exit');
    }
  }

  @SubscribeMessage('stop-command')
  handleStopCommand(@ConnectedSocket() client: Socket) {
    const ptyProcess = this.ptys.get(client.id);
    if (ptyProcess) {
      // Send Ctrl+C to kill whatever is running in the PTY
      ptyProcess.write('\x03');
    }
    // Tell frontend the process stopped
    setTimeout(() => client.emit('process-exit'), 400);
  }

  @SubscribeMessage('restart-command')
  handleRestartCommand(@ConnectedSocket() client: Socket) {
    const lastArgs = this.lastRunArgs.get(client.id);
    if (!lastArgs) return;

    const ptyProcess = this.ptys.get(client.id);
    if (!ptyProcess) return;

    client.emit('terminal-output', '\r\n\x1b[33m[Restarting...]\x1b[0m\r\n');

    // Send Ctrl+C to stop current process, then re-run
    ptyProcess.write('\x03');
    setTimeout(() => {
      ptyProcess.write(`${lastArgs.command}\r`);
    }, 800);
  }
}
