import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class DatabaseService {
  constructor(private workspaceService: WorkspaceService) {}

  private getDbConnection(
    projectName: string,
    dbPathBase64: string,
    readOnly = false,
  ): sqlite3.Database {
    const relPath = Buffer.from(dbPathBase64, 'base64').toString('utf8');
    const fullPath = path.join(
      this.workspaceService.getProjectPath(projectName),
      relPath,
    );
    if (!fs.existsSync(fullPath)) {
      throw new HttpException('Database file not found', HttpStatus.NOT_FOUND);
    }
    const mode = readOnly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE;
    return new sqlite3.Database(fullPath, mode);
  }

  getTables(projectName: string, dbPathBase64: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.getDbConnection(projectName, dbPathBase64, true);
        db.all(
          "SELECT name FROM sqlite_master WHERE type='table'",
          (err, rows) => {
            db.close();
            if (err)
              return reject(
                new HttpException(
                  err.message,
                  HttpStatus.INTERNAL_SERVER_ERROR,
                ),
              );
            resolve((rows as { name: string }[]).map((r) => r.name));
          },
        );
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  getTableSchema(
    projectName: string,
    dbPathBase64: string,
    tableName: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.getDbConnection(projectName, dbPathBase64, true);
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
          db.close();
          if (err)
            return reject(
              new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR),
            );
          resolve(rows);
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  query(
    projectName: string,
    dbPathBase64: string,
    queryStr: string,
    params: any[] = [],
    limit = 100,
    offset = 0,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const trimmedQuery = queryStr.trim();
      const isSelect = trimmedQuery.toUpperCase().startsWith('SELECT');

      try {
        const db = this.getDbConnection(projectName, dbPathBase64, false);

        if (isSelect) {
          const cleanQuery = trimmedQuery.replace(/;+$/, '');
          const hasLimit = /\bLIMIT\b/i.test(cleanQuery);
          const paginatedQuery = hasLimit ? cleanQuery : `${cleanQuery} LIMIT ${limit} OFFSET ${offset}`;
          
          db.all(paginatedQuery, params, (err, rows) => {
            db.close();
            if (err) {
              return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
            }
            resolve(rows);
          });
        } else {
          db.run(trimmedQuery, params, function (err) {
            db.close();
            if (err) {
              return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
            }
            resolve([
              {
                "Status": "Query executed successfully",
                "Rows Affected": this.changes,
                "Last Inserted ID": this.lastID || 'N/A'
              }
            ]);
          });
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }
}
