import { Module } from '@nestjs/common';
import { TerminalGateway } from './terminal.gateway';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [WorkspaceModule],
  providers: [TerminalGateway],
})
export class TerminalModule {}
