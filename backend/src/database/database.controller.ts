import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  // ─── Connection management ────────────────────────────────────────────────────

  @Get(':project/connections')
  getConnections(@Request() req: any, @Param('project') project: string) {
    return this.databaseService.getConnections(req.user.id, project);
  }

  @Post(':project/connections')
  addConnection(@Request() req: any, @Param('project') project: string, @Body() body: any) {
    return this.databaseService.addConnection(req.user.id, project, body);
  }

  @Delete(':project/connections/:connId')
  removeConnection(@Request() req: any, @Param('project') project: string, @Param('connId') connId: string) {
    return this.databaseService.removeConnection(req.user.id, project, connId);
  }

  // ─── SQLite ───────────────────────────────────────────────────────────────────

  @Get(':project/tables')
  getTables(@Request() req: any, @Param('project') project: string, @Query('db') dbPath: string) {
    return this.databaseService.getTables(req.user.id, project, dbPath);
  }

  @Get(':project/schema/:table')
  getSchema(@Request() req: any, @Param('project') project: string, @Param('table') table: string, @Query('db') dbPath: string) {
    return this.databaseService.getTableSchema(req.user.id, project, dbPath, table);
  }

  @Post(':project/query')
  executeQuery(
    @Request() req: any,
    @Param('project') project: string,
    @Body('dbPath') dbPath: string,
    @Body('query') query: string,
    @Body('limit') limit?: number,
    @Body('offset') offset?: number,
  ) {
    return this.databaseService.query(req.user.id, project, dbPath, query, [], limit || 100, offset || 0);
  }

  @Post(':project/sqlite/insert')
  sqliteInsert(
    @Request() req: any,
    @Param('project') project: string,
    @Body('dbPath') dbPath: string,
    @Body('table') table: string,
    @Body('data') data: Record<string, any>,
  ) {
    return this.databaseService.sqliteInsert(req.user.id, project, dbPath, table, data);
  }

  @Post(':project/sqlite/update')
  sqliteUpdate(
    @Request() req: any,
    @Param('project') project: string,
    @Body('dbPath') dbPath: string,
    @Body('table') table: string,
    @Body('data') data: Record<string, any>,
    @Body('where') where: Record<string, any>,
  ) {
    return this.databaseService.sqliteUpdate(req.user.id, project, dbPath, table, data, where);
  }

  @Post(':project/sqlite/delete')
  sqliteDelete(
    @Request() req: any,
    @Param('project') project: string,
    @Body('dbPath') dbPath: string,
    @Body('table') table: string,
    @Body('where') where: Record<string, any>,
  ) {
    return this.databaseService.sqliteDelete(req.user.id, project, dbPath, table, where);
  }

  // ─── MongoDB ──────────────────────────────────────────────────────────────────

  @Post(':project/mongo/test')
  mongoTest(@Body('uri') uri: string) {
    return this.databaseService.mongoTestConnection(uri);
  }

  @Post(':project/mongo/collections')
  mongoCollections(@Body('uri') uri: string, @Body('dbName') dbName: string) {
    return this.databaseService.mongoListCollections(uri, dbName);
  }

  @Post(':project/mongo/find')
  mongoFind(
    @Body('uri') uri: string,
    @Body('dbName') dbName: string,
    @Body('collection') collection: string,
    @Body('filter') filter?: Record<string, any>,
    @Body('limit') limit?: number,
  ) {
    return this.databaseService.mongoFind(uri, dbName, collection, filter || {}, limit || 100);
  }

  @Post(':project/mongo/insert')
  mongoInsert(
    @Body('uri') uri: string,
    @Body('dbName') dbName: string,
    @Body('collection') collection: string,
    @Body('document') document: Record<string, any>,
  ) {
    return this.databaseService.mongoInsert(uri, dbName, collection, document);
  }

  @Post(':project/mongo/update')
  mongoUpdate(
    @Body('uri') uri: string,
    @Body('dbName') dbName: string,
    @Body('collection') collection: string,
    @Body('id') id: string,
    @Body('update') update: Record<string, any>,
  ) {
    return this.databaseService.mongoUpdate(uri, dbName, collection, id, update);
  }

  @Post(':project/mongo/delete')
  mongoDelete(
    @Body('uri') uri: string,
    @Body('dbName') dbName: string,
    @Body('collection') collection: string,
    @Body('id') id: string,
  ) {
    return this.databaseService.mongoDelete(uri, dbName, collection, id);
  }

  // ─── External DB (MySQL / PostgreSQL) ─────────────────────────────────────────

  @Post(':project/external/test')
  externalDbTest(@Body() body: any) {
    return this.databaseService.externalDbTest(body);
  }

  @Post(':project/external/tables')
  externalDbTables(@Body() body: any) {
    return this.databaseService.externalDbTables(body);
  }

  @Post(':project/external/query')
  externalDbQuery(@Body('conn') conn: any, @Body('query') query: string) {
    return this.databaseService.externalDbQuery(conn, query);
  }
}
