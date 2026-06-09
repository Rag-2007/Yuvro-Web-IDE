import { Module } from '@nestjs/common';
import { WorkspaceModule } from './workspace/workspace.module';
import { TerminalModule } from './terminal/terminal.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [WorkspaceModule, TerminalModule, DatabaseModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
