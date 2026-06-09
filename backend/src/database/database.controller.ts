import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get(':project/tables')
  getTables(@Param('project') project: string, @Query('db') dbPath: string) {
    return this.databaseService.getTables(project, dbPath);
  }

  @Get(':project/schema/:table')
  getSchema(
    @Param('project') project: string,
    @Param('table') table: string,
    @Query('db') dbPath: string,
  ) {
    return this.databaseService.getTableSchema(project, dbPath, table);
  }

  @Post(':project/query')
  executeQuery(
    @Param('project') project: string,
    @Body('dbPath') dbPath: string,
    @Body('query') query: string,
    @Body('limit') limit?: number,
    @Body('offset') offset?: number,
  ) {
    return this.databaseService.query(
      project,
      dbPath,
      query,
      [],
      limit || 100,
      offset || 0,
    );
  }
}
