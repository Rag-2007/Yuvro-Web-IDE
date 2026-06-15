import { Module } from '@nestjs/common';
import { TerminalGateway } from './terminal.gateway';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WorkspaceModule, AuthModule],
  providers: [TerminalGateway],
})
export class TerminalModule {}
