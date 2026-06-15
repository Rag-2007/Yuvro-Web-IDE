import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

@Injectable()
export class AuthService {
  private db: sqlite3.Database;
  private usersDbPath: string;

  constructor(private jwtService: JwtService) {
    const workspacesRoot = path.join(process.cwd(), '.workspaces');
    if (!fs.existsSync(workspacesRoot)) {
      fs.mkdirSync(workspacesRoot, { recursive: true });
    }
    this.usersDbPath = path.join(workspacesRoot, 'yuvro_users.db');
    this.db = new sqlite3.Database(this.usersDbPath);
    this.initDb();
  }

  private initDb(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);
  }

  private generateId(): string {
    return `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async register(email: string, password: string): Promise<{ token: string; user: User }> {
    const normalEmail = email.trim().toLowerCase();
    if (!normalEmail || !password || password.length < 6) {
      throw new HttpException('Invalid email or password (min 6 chars)', HttpStatus.BAD_REQUEST);
    }

    return new Promise((resolve, reject) => {
      this.db.get('SELECT id FROM users WHERE email = ?', [normalEmail], async (err, row) => {
        if (err) return reject(new HttpException('DB error', HttpStatus.INTERNAL_SERVER_ERROR));
        if (row) return reject(new HttpException('Email already registered', HttpStatus.CONFLICT));

        try {
          const passwordHash = await bcrypt.hash(password, 10);
          const id = this.generateId();
          const createdAt = new Date().toISOString();

          this.db.run(
            'INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)',
            [id, normalEmail, passwordHash, createdAt],
            (insertErr) => {
              if (insertErr) return reject(new HttpException('Failed to register', HttpStatus.INTERNAL_SERVER_ERROR));

              // Create user workspace directory
              const userDir = path.join(process.cwd(), '.workspaces', id);
              if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
              }

              const user: User = { id, email: normalEmail, createdAt };
              const token = this.jwtService.sign({ sub: id, email: normalEmail });
              resolve({ token, user });
            },
          );
        } catch {
          reject(new HttpException('Failed to hash password', HttpStatus.INTERNAL_SERVER_ERROR));
        }
      });
    });
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const normalEmail = email.trim().toLowerCase();

    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, email, passwordHash, createdAt FROM users WHERE email = ?',
        [normalEmail],
        async (err, row: { id: string; email: string; passwordHash: string; createdAt: string } | undefined) => {
          if (err) return reject(new HttpException('DB error', HttpStatus.INTERNAL_SERVER_ERROR));
          if (!row) return reject(new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED));

          try {
            const valid = await bcrypt.compare(password, row.passwordHash);
            if (!valid) return reject(new HttpException('Invalid email or password', HttpStatus.UNAUTHORIZED));

            // Ensure user workspace directory exists
            const userDir = path.join(process.cwd(), '.workspaces', row.id);
            if (!fs.existsSync(userDir)) {
              fs.mkdirSync(userDir, { recursive: true });
            }

            const user: User = { id: row.id, email: row.email, createdAt: row.createdAt };
            const token = this.jwtService.sign({ sub: row.id, email: row.email });
            resolve({ token, user });
          } catch {
            reject(new HttpException('Auth failed', HttpStatus.INTERNAL_SERVER_ERROR));
          }
        },
      );
    });
  }

  async validateUser(payload: { sub: string; email: string }): Promise<User | null> {
    return new Promise((resolve) => {
      this.db.get(
        'SELECT id, email, createdAt FROM users WHERE id = ?',
        [payload.sub],
        (_err, row: { id: string; email: string; createdAt: string } | undefined) => {
          if (!row) return resolve(null);
          resolve({ id: row.id, email: row.email, createdAt: row.createdAt });
        },
      );
    });
  }

  verifyToken(token: string): { sub: string; email: string } | null {
    try {
      return this.jwtService.verify(token) as { sub: string; email: string };
    } catch {
      return null;
    }
  }
}
