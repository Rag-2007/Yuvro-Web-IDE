import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { MongoClient, ObjectId } from 'mongodb';
import { WorkspaceService } from '../workspace/workspace.service';

export interface DbConnection {
  id: string;
  name: string;
  type: 'sqlite' | 'mongodb';
  // sqlite: relative file path inside project
  filePath?: string;
  // mongodb: connection URI
  uri?: string;
  createdAt: string;
}

@Injectable()
export class DatabaseService {
  constructor(private workspaceService: WorkspaceService) {}

  // ─── Connection Config ───────────────────────────────────────────────────────

  private getConfigPath(userId: string, projectName: string): string {
    const projectPath = this.workspaceService.getProjectPath(userId, projectName);
    return path.join(projectPath, '_yuvro_db.json');
  }

  getConnections(userId: string, projectName: string): DbConnection[] {
    const configPath = this.getConfigPath(userId, projectName);
    if (!fs.existsSync(configPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')) as DbConnection[];
    } catch {
      return [];
    }
  }

  addConnection(userId: string, projectName: string, conn: Omit<DbConnection, 'id' | 'createdAt'>): DbConnection {
    const configPath = this.getConfigPath(userId, projectName);
    const existing = this.getConnections(userId, projectName);
    const newConn: DbConnection = {
      ...conn,
      id: `conn_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    existing.push(newConn);
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf8');
    return newConn;
  }

  removeConnection(userId: string, projectName: string, connId: string): void {
    const configPath = this.getConfigPath(userId, projectName);
    const existing = this.getConnections(userId, projectName);
    const updated = existing.filter((c) => c.id !== connId);
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
  }

  // ─── SQLite helpers ───────────────────────────────────────────────────────────

  private getDbConnection(userId: string, projectName: string, dbPathBase64: string, readOnly = false): sqlite3.Database {
    const relPath = Buffer.from(dbPathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.workspaceService.getProjectPath(userId, projectName), relPath);
    if (!fs.existsSync(fullPath)) {
      throw new HttpException('Database file not found', HttpStatus.NOT_FOUND);
    }
    const mode = readOnly ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE;
    return new sqlite3.Database(fullPath, mode);
  }

  getTables(userId: string, projectName: string, dbPathBase64: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.getDbConnection(userId, projectName, dbPathBase64, true);
        db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
          db.close();
          if (err) return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
          resolve((rows as { name: string }[]).map((r) => r.name));
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  getTableSchema(userId: string, projectName: string, dbPathBase64: string, tableName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.getDbConnection(userId, projectName, dbPathBase64, true);
        db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
          db.close();
          if (err) return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
          resolve(rows);
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  query(userId: string, projectName: string, dbPathBase64: string, queryStr: string, params: any[] = [], limit = 100, offset = 0): Promise<any> {
    return new Promise((resolve, reject) => {
      const trimmedQuery = queryStr.trim();
      const isSelect = trimmedQuery.toUpperCase().startsWith('SELECT');
      try {
        const db = this.getDbConnection(userId, projectName, dbPathBase64, false);
        if (isSelect) {
          const cleanQuery = trimmedQuery.replace(/;+$/, '');
          const hasLimit = /\bLIMIT\b/i.test(cleanQuery);
          const paginatedQuery = hasLimit ? cleanQuery : `${cleanQuery} LIMIT ${limit} OFFSET ${offset}`;
          db.all(paginatedQuery, params, (err, rows) => {
            db.close();
            if (err) return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
            resolve(rows);
          });
        } else {
          db.run(trimmedQuery, params, function (err) {
            db.close();
            if (err) return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
            resolve([{ 'Status': 'Query executed successfully', 'Rows Affected': this.changes, 'Last Inserted ID': this.lastID || 'N/A' }]);
          });
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  // ─── SQLite CRUD ──────────────────────────────────────────────────────────────

  sqliteInsert(userId: string, projectName: string, dbPathBase64: string, table: string, data: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.getDbConnection(userId, projectName, dbPathBase64, false);
        const cols = Object.keys(data);
        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map((c) => data[c]);
        db.run(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`, values, function (err) {
          db.close();
          if (err) return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
          resolve({ success: true, lastID: this.lastID });
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  sqliteUpdate(userId: string, projectName: string, dbPathBase64: string, table: string, data: Record<string, any>, where: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.getDbConnection(userId, projectName, dbPathBase64, false);
        const setCols = Object.keys(data).map((c) => `"${c}" = ?`).join(', ');
        const whereCols = Object.keys(where).map((c) => `"${c}" = ?`).join(' AND ');
        const values = [...Object.values(data), ...Object.values(where)];
        db.run(`UPDATE "${table}" SET ${setCols} WHERE ${whereCols}`, values, function (err) {
          db.close();
          if (err) return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
          resolve({ success: true, changes: this.changes });
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  sqliteDelete(userId: string, projectName: string, dbPathBase64: string, table: string, where: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        const db = this.getDbConnection(userId, projectName, dbPathBase64, false);
        const whereCols = Object.keys(where).map((c) => `"${c}" = ?`).join(' AND ');
        const values = Object.values(where);
        db.run(`DELETE FROM "${table}" WHERE ${whereCols}`, values, function (err) {
          db.close();
          if (err) return reject(new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR));
          resolve({ success: true, changes: this.changes });
        });
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  // ─── MongoDB ───────────────────────────────────────────────────────────

  private async getMongoClient(uri: string): Promise<MongoClient> {
    try {
      // Short timeout so failed connections fail fast and don't hang
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
        socketTimeoutMS: 5000,
      });
      await client.connect();
      // Ping to verify connection is truly alive
      await client.db('admin').command({ ping: 1 });
      return client;
    } catch (e: any) {
      const msg = e?.message || String(e);
      throw new HttpException(
        `MongoDB connection failed: ${msg}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private safeObjectId(id: string): ObjectId | null {
    try { return new ObjectId(id); } catch { return null; }
  }

  async mongoTestConnection(uri: string): Promise<{ success: boolean; databases: string[] }> {
    let client: MongoClient | null = null;
    try {
      client = await this.getMongoClient(uri);
      const adminDb = client.db().admin();
      const result = await adminDb.listDatabases();
      return { success: true, databases: result.databases.map((d: any) => d.name) };
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }

  async mongoListCollections(uri: string, dbName: string): Promise<string[]> {
    let client: MongoClient | null = null;
    try {
      client = await this.getMongoClient(uri);
      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      return collections.map((c) => c.name);
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }

  async mongoFind(uri: string, dbName: string, collection: string, filter: Record<string, any> = {}, limit = 100): Promise<any[]> {
    let client: MongoClient | null = null;
    try {
      client = await this.getMongoClient(uri);
      const db = client.db(dbName);
      const col = db.collection(collection);
      const docs = await col.find(filter).limit(limit).toArray();
      // Convert _id to string so it can be sent as JSON and used to delete
      return docs.map((d) => {
        const { _id, ...rest } = d;
        return { _id: _id ? _id.toString() : '', ...rest };
      });
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }

  async mongoInsert(uri: string, dbName: string, collection: string, document: Record<string, any>): Promise<any> {
    let client: MongoClient | null = null;
    try {
      client = await this.getMongoClient(uri);
      const db = client.db(dbName);
      const col = db.collection(collection);
      const result = await col.insertOne(document);
      return { success: true, insertedId: result.insertedId.toString() };
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }

  async mongoUpdate(uri: string, dbName: string, collection: string, id: string, update: Record<string, any>): Promise<any> {
    let client: MongoClient | null = null;
    try {
      client = await this.getMongoClient(uri);
      const db = client.db(dbName);
      const col = db.collection(collection);
      const oid = this.safeObjectId(id);
      if (!oid) throw new HttpException('Invalid document id', HttpStatus.BAD_REQUEST);
      const result = await col.updateOne({ _id: oid }, { $set: update });
      return { success: true, modifiedCount: result.modifiedCount };
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }

  async mongoDelete(uri: string, dbName: string, collection: string, id: string): Promise<any> {
    let client: MongoClient | null = null;
    try {
      client = await this.getMongoClient(uri);
      const db = client.db(dbName);
      const col = db.collection(collection);
      const oid = this.safeObjectId(id);
      if (!oid) throw new HttpException('Invalid document id', HttpStatus.BAD_REQUEST);
      const result = await col.deleteOne({ _id: oid });
      return { success: true, deletedCount: result.deletedCount };
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }
}
