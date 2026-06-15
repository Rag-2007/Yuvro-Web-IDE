import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import * as unzipper from 'unzipper';

export interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

@Injectable()
export class WorkspaceService {
  private workspacesRoot = path.join(process.cwd(), '.workspaces');

  constructor() {
    if (!fs.existsSync(this.workspacesRoot)) {
      fs.mkdirSync(this.workspacesRoot, { recursive: true });
    }
  }

  private getUserRoot(userId: string): string {
    const userRoot = path.join(this.workspacesRoot, userId);
    if (!fs.existsSync(userRoot)) {
      fs.mkdirSync(userRoot, { recursive: true });
    }
    return userRoot;
  }

  getProjects(userId: string) {
    try {
      const userRoot = this.getUserRoot(userId);
      const entries = fs.readdirSync(userRoot, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({ name: entry.name }));
    } catch {
      return [];
    }
  }

  deleteProject(userId: string, name: string) {
    const projectPath = path.join(this.getUserRoot(userId), name);
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    return { success: true };
  }

  createProject(userId: string, name: string) {
    const projectPath = path.join(this.getUserRoot(userId), name);
    if (fs.existsSync(projectPath)) {
      throw new HttpException('Project already exists', HttpStatus.BAD_REQUEST);
    }
    fs.mkdirSync(projectPath, { recursive: true });
    return { success: true, name };
  }

  async cloneProject(userId: string, name: string, repoUrl: string) {
    const projectPath = path.join(this.getUserRoot(userId), name);
    if (fs.existsSync(projectPath)) {
      throw new HttpException('Project already exists', HttpStatus.BAD_REQUEST);
    }
    try {
      const git = simpleGit();
      await git.clone(repoUrl, projectPath);
      return { success: true, name };
    } catch {
      throw new HttpException('Failed to clone repository', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async extractZipProject(userId: string, name: string, fileBuffer: Buffer) {
    const projectPath = path.join(this.getUserRoot(userId), name);
    if (fs.existsSync(projectPath)) {
      throw new HttpException('Project already exists', HttpStatus.BAD_REQUEST);
    }
    fs.mkdirSync(projectPath, { recursive: true });
    try {
      const directory = await unzipper.Open.buffer(fileBuffer);
      await directory.extract({ path: projectPath });
      return { success: true, name };
    } catch {
      throw new HttpException('Failed to extract zip', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  getTree(userId: string, projectName: string) {
    const projectPath = path.join(this.getUserRoot(userId), projectName);
    if (!fs.existsSync(projectPath)) {
      throw new HttpException('Project not found', HttpStatus.NOT_FOUND);
    }

    const buildTree = (dirPath: string, relativePath: string): TreeNode[] => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const tree: TreeNode[] = [];
      for (const entry of entries) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        const id = Buffer.from(relPath).toString('base64');
        if (entry.isDirectory()) {
          tree.push({ id, name: entry.name, children: buildTree(fullPath, relPath) });
        } else {
          tree.push({ id, name: entry.name });
        }
      }
      return tree.sort((a, b) => {
        if (a.children && !b.children) return -1;
        if (!a.children && b.children) return 1;
        return a.name.localeCompare(b.name);
      });
    };

    return buildTree(projectPath, '');
  }

  readFile(userId: string, projectName: string, filePathBase64: string) {
    const relPath = Buffer.from(filePathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.getUserRoot(userId), projectName, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return { content };
  }

  writeFile(userId: string, projectName: string, filePathBase64: string, content: string) {
    const relPath = Buffer.from(filePathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.getUserRoot(userId), projectName, relPath);
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true };
  }

  createDirectory(userId: string, projectName: string, dirPathBase64: string) {
    const relPath = Buffer.from(dirPathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.getUserRoot(userId), projectName, relPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return { success: true };
  }

  createFile(userId: string, projectName: string, filePathBase64: string) {
    const relPath = Buffer.from(filePathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.getUserRoot(userId), projectName, relPath);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '', 'utf8');
    }
    return { success: true };
  }

  deletePath(userId: string, projectName: string, pathBase64: string) {
    const relPath = Buffer.from(pathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.getUserRoot(userId), projectName, relPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    return { success: true };
  }

  renamePath(userId: string, projectName: string, oldPathBase64: string, newName: string) {
    const oldRelPath = Buffer.from(oldPathBase64, 'base64').toString('utf8');
    const oldFullPath = path.join(this.getUserRoot(userId), projectName, oldRelPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);
    if (fs.existsSync(oldFullPath)) {
      fs.renameSync(oldFullPath, newFullPath);
    }
    return { success: true };
  }

  getProjectPath(userId: string, projectName: string) {
    return path.join(this.getUserRoot(userId), projectName);
  }

  findDbFiles(userId: string, projectName: string): string[] {
    const projectPath = path.join(this.getUserRoot(userId), projectName);
    if (!fs.existsSync(projectPath)) return [];
    const results: string[] = [];
    const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', 'venv', '.venv', 'env', 'dist', 'build']);
    const scan = (dir: string) => {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) scan(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
            results.push(path.relative(projectPath, fullPath));
          }
        }
      }
    };
    scan(projectPath);
    return results;
  }

  detectRunCommand(userId: string, projectName: string): { command: string; label: string } | null {
    const projectPath = path.join(this.getUserRoot(userId), projectName);
    if (!fs.existsSync(projectPath)) return null;

    const readSafe = (filePath: string) => {
      try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
    };
    const hasFile = (name: string) => fs.existsSync(path.join(projectPath, name));
    const findFile = (name: string): string | null => {
      if (hasFile(name)) return name;
      const search = (dir: string, depth = 0): string | null => {
        if (depth > 4) return null;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name === name) {
              return path.relative(projectPath, path.join(dir, entry.name));
            }
          }
          for (const entry of entries) {
            if (entry.isDirectory()) {
              if (['.git', 'node_modules', 'venv', '.venv', 'env', '__pycache__', 'dist', 'build', 'staticfiles', 'media'].includes(entry.name)) continue;
              const found = search(path.join(dir, entry.name), depth + 1);
              if (found) return found;
            }
          }
        } catch { return null; }
        return null;
      };
      return search(projectPath);
    };

    const managePyPath = findFile('manage.py');
    if (managePyPath) {
      const dir = path.dirname(managePyPath);
      return dir === '.' ? { command: 'python manage.py runserver', label: 'Django Dev Server' }
        : { command: `cd "${dir}" && python manage.py runserver`, label: 'Django Dev Server' };
    }

    const requirementsPath = findFile('requirements.txt');
    const requirements = requirementsPath ? readSafe(path.join(projectPath, requirementsPath)).toLowerCase() : '';

    if (requirements.includes('fastapi') || requirements.includes('uvicorn')) {
      const candidates = ['main.py', 'app.py', 'server.py', 'api.py'];
      for (const candidate of candidates) {
        const candidatePath = findFile(candidate);
        if (candidatePath) {
          const content = readSafe(path.join(projectPath, candidatePath));
          if (content.includes('FastAPI') || content.includes('fastapi')) {
            const dir = path.dirname(candidatePath);
            const base = path.basename(candidatePath);
            const moduleName = base.replace('.py', '');
            const match = content.match(/(\w+)\s*=\s*FastAPI\s*\(/);
            const appVar = match ? match[1] : 'app';
            return dir === '.'
              ? { command: `uvicorn ${moduleName}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' }
              : { command: `cd "${dir}" && uvicorn ${moduleName}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' };
          }
        }
      }
      return { command: 'uvicorn main:app --reload --host 0.0.0.0 --port 8000', label: 'FastAPI Server' };
    }

    if (requirements.includes('flask')) {
      const candidates = ['app.py', 'main.py', 'server.py', 'run.py'];
      for (const candidate of candidates) {
        const candidatePath = findFile(candidate);
        if (candidatePath) {
          const content = readSafe(path.join(projectPath, candidatePath));
          if (content.includes('Flask') || content.includes('flask')) {
            const dir = path.dirname(candidatePath);
            const base = path.basename(candidatePath);
            return dir === '.' ? { command: `python ${base}`, label: 'Flask Server' }
              : { command: `cd "${dir}" && python ${base}`, label: 'Flask Server' };
          }
        }
      }
      return { command: 'python app.py', label: 'Flask Server' };
    }

    const mainPyPath = findFile('main.py');
    if (mainPyPath) {
      const dir = path.dirname(mainPyPath);
      const base = path.basename(mainPyPath);
      const content = readSafe(path.join(projectPath, mainPyPath));
      if (content.includes('FastAPI') || content.includes('fastapi')) {
        const match = content.match(/(\w+)\s*=\s*FastAPI\s*\(/);
        const appVar = match ? match[1] : 'app';
        return dir === '.'
          ? { command: `uvicorn ${base.replace('.py', '')}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' }
          : { command: `cd "${dir}" && uvicorn ${base.replace('.py', '')}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' };
      }
      return dir === '.' ? { command: 'python main.py', label: 'Python Script' }
        : { command: `cd "${dir}" && python main.py`, label: 'Python Script' };
    }

    const packageJsonPath = findFile('package.json');
    if (packageJsonPath) {
      const dir = path.dirname(packageJsonPath);
      const pkg = readSafe(path.join(projectPath, packageJsonPath));
      try {
        const parsed = JSON.parse(pkg);
        const prefix = dir === '.' ? '' : `cd "${dir}" && `;
        if (parsed.scripts?.dev) return { command: `${prefix}npm run dev`, label: 'Node Dev Server' };
        if (parsed.scripts?.start) return { command: `${prefix}npm start`, label: 'Node Server' };
      } catch {}
    }

    const serverJsPath = findFile('server.js');
    if (serverJsPath) {
      const dir = path.dirname(serverJsPath);
      return dir === '.' ? { command: 'node server.js', label: 'Node Server' }
        : { command: `cd "${dir}" && node server.js`, label: 'Node Server' };
    }

    const indexJsPath = findFile('index.js');
    if (indexJsPath) {
      const dir = path.dirname(indexJsPath);
      return dir === '.' ? { command: 'node index.js', label: 'Node Server' }
        : { command: `cd "${dir}" && node index.js`, label: 'Node Server' };
    }

    return null;
  }

  getGlobalLaunchConfig(): Record<string, string> {
    const launchJsonPath = path.join(this.workspacesRoot, 'launch.json');
    if (fs.existsSync(launchJsonPath)) {
      try { return JSON.parse(fs.readFileSync(launchJsonPath, 'utf8')); } catch { return {}; }
    }
    const defaultMap: Record<string, string> = {
      'manage.py': 'python manage.py runserver',
      'main.py': 'python main.py',
      'app.py': 'python app.py',
      'index.js': 'node index.js',
      'server.js': 'node server.js',
      'app.js': 'node app.js'
    };
    try { fs.writeFileSync(launchJsonPath, JSON.stringify(defaultMap, null, 2), 'utf8'); } catch {}
    return defaultMap;
  }
}
