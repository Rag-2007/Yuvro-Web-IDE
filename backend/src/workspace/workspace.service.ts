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

  getProjects() {
    try {
      const entries = fs.readdirSync(this.workspacesRoot, {
        withFileTypes: true,
      });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({ name: entry.name }));
    } catch {
      return [];
    }
  }

  deleteProject(name: string) {
    const projectPath = path.join(this.workspacesRoot, name);
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }
    return { success: true };
  }

  createProject(name: string) {
    const projectPath = path.join(this.workspacesRoot, name);
    if (fs.existsSync(projectPath)) {
      throw new HttpException('Project already exists', HttpStatus.BAD_REQUEST);
    }
    fs.mkdirSync(projectPath, { recursive: true });
    return { success: true, name };
  }

  async cloneProject(name: string, repoUrl: string) {
    const projectPath = path.join(this.workspacesRoot, name);
    if (fs.existsSync(projectPath)) {
      throw new HttpException('Project already exists', HttpStatus.BAD_REQUEST);
    }
    try {
      const git = simpleGit();
      await git.clone(repoUrl, projectPath);
      return { success: true, name };
    } catch {
      throw new HttpException(
        'Failed to clone repository',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async extractZipProject(name: string, fileBuffer: Buffer) {
    const projectPath = path.join(this.workspacesRoot, name);
    if (fs.existsSync(projectPath)) {
      throw new HttpException('Project already exists', HttpStatus.BAD_REQUEST);
    }
    fs.mkdirSync(projectPath, { recursive: true });
    try {
      const directory = await unzipper.Open.buffer(fileBuffer);
      await directory.extract({ path: projectPath });
      return { success: true, name };
    } catch {
      throw new HttpException(
        'Failed to extract zip',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  getTree(projectName: string) {
    const projectPath = path.join(this.workspacesRoot, projectName);
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
          tree.push({
            id,
            name: entry.name,
            children: buildTree(fullPath, relPath),
          });
        } else {
          tree.push({
            id,
            name: entry.name,
          });
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

  readFile(projectName: string, filePathBase64: string) {
    const relPath = Buffer.from(filePathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.workspacesRoot, projectName, relPath);
    if (!fs.existsSync(fullPath)) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    return { content };
  }

  writeFile(projectName: string, filePathBase64: string, content: string) {
    const relPath = Buffer.from(filePathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.workspacesRoot, projectName, relPath);
    fs.writeFileSync(fullPath, content, 'utf8');
    return { success: true };
  }

  createDirectory(projectName: string, dirPathBase64: string) {
    const relPath = Buffer.from(dirPathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.workspacesRoot, projectName, relPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return { success: true };
  }

  createFile(projectName: string, filePathBase64: string) {
    const relPath = Buffer.from(filePathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.workspacesRoot, projectName, relPath);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '', 'utf8');
    }
    return { success: true };
  }

  deletePath(projectName: string, pathBase64: string) {
    const relPath = Buffer.from(pathBase64, 'base64').toString('utf8');
    const fullPath = path.join(this.workspacesRoot, projectName, relPath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    return { success: true };
  }

  renamePath(projectName: string, oldPathBase64: string, newName: string) {
    const oldRelPath = Buffer.from(oldPathBase64, 'base64').toString('utf8');
    const oldFullPath = path.join(this.workspacesRoot, projectName, oldRelPath);
    const newFullPath = path.join(path.dirname(oldFullPath), newName);
    if (fs.existsSync(oldFullPath)) {
      fs.renameSync(oldFullPath, newFullPath);
    }
    return { success: true };
  }

  getProjectPath(projectName: string) {
    return path.join(this.workspacesRoot, projectName);
  }

  findDbFiles(projectName: string): string[] {
    const projectPath = path.join(this.workspacesRoot, projectName);
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

  detectRunCommand(projectName: string): { command: string; label: string } | null {
    const projectPath = path.join(this.workspacesRoot, projectName);
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
              if (['.git', 'node_modules', 'venv', '.venv', 'env', '__pycache__', 'dist', 'build', 'staticfiles', 'media'].includes(entry.name)) {
                continue;
              }
              const found = search(path.join(dir, entry.name), depth + 1);
              if (found) return found;
            }
          }
        } catch {
          return null;
        }
        return null;
      };
      return search(projectPath);
    };

    const managePyPath = findFile('manage.py');
    if (managePyPath) {
      const dir = path.dirname(managePyPath);
      if (dir === '.') {
        return { command: 'python manage.py runserver', label: 'Django Dev Server' };
      } else {
        return { command: `cd "${dir}" && python manage.py runserver`, label: 'Django Dev Server' };
      }
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
            if (dir === '.') {
              return { command: `uvicorn ${moduleName}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' };
            } else {
              return { command: `cd "${dir}" && uvicorn ${moduleName}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' };
            }
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
            if (dir === '.') {
              return { command: `python ${base}`, label: 'Flask Server' };
            } else {
              return { command: `cd "${dir}" && python ${base}`, label: 'Flask Server' };
            }
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
        if (dir === '.') {
          return { command: `uvicorn ${base.replace('.py', '')}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' };
        } else {
          return { command: `cd "${dir}" && uvicorn ${base.replace('.py', '')}:${appVar} --reload --host 0.0.0.0 --port 8000`, label: 'FastAPI Server' };
        }
      }
      if (content.includes('Flask') || content.includes('flask')) {
        if (dir === '.') {
          return { command: 'python main.py', label: 'Flask Server' };
        } else {
          return { command: `cd "${dir}" && python main.py`, label: 'Flask Server' };
        }
      }
      if (dir === '.') {
        return { command: 'python main.py', label: 'Python Script' };
      } else {
        return { command: `cd "${dir}" && python main.py`, label: 'Python Script' };
      }
    }

    const appPyPath = findFile('app.py');
    if (appPyPath) {
      const dir = path.dirname(appPyPath);
      if (dir === '.') {
        return { command: 'python app.py', label: 'Python Script' };
      } else {
        return { command: `cd "${dir}" && python app.py`, label: 'Python Script' };
      }
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
      const serverJsPath = findFile('server.js');
      if (serverJsPath) {
        const sDir = path.dirname(serverJsPath);
        const sBase = path.basename(serverJsPath);
        const prefix = sDir === '.' ? '' : `cd "${sDir}" && `;
        return { command: `${prefix}node ${sBase}`, label: 'Node Server' };
      }
      const indexJsPath = findFile('index.js');
      if (indexJsPath) {
        const iDir = path.dirname(indexJsPath);
        const iBase = path.basename(indexJsPath);
        const prefix = iDir === '.' ? '' : `cd "${iDir}" && `;
        return { command: `${prefix}node ${iBase}`, label: 'Node Server' };
      }
    }

    const serverJsPath = findFile('server.js');
    if (serverJsPath) {
      const dir = path.dirname(serverJsPath);
      const base = path.basename(serverJsPath);
      if (dir === '.') {
        return { command: 'node server.js', label: 'Node Server' };
      } else {
        return { command: `cd "${dir}" && node server.js`, label: 'Node Server' };
      }
    }

    const indexJsPath = findFile('index.js');
    if (indexJsPath) {
      const dir = path.dirname(indexJsPath);
      const base = path.basename(indexJsPath);
      if (dir === '.') {
        return { command: 'node index.js', label: 'Node Server' };
      } else {
        return { command: `cd "${dir}" && node index.js`, label: 'Node Server' };
      }
    }

    const findPythonFile = (): string | null => {
      const isExcluded = (name: string) => {
        const base = name.toLowerCase();
        return (
          base === 'setup.py' ||
          base === 'setup2.py' ||
          base.startsWith('setup_') ||
          base === 'conftest.py' ||
          base === 'manage.py' ||
          base === 'wsgi.py' ||
          base === 'asgi.py' ||
          base === '__init__.py'
        );
      };

      try {
        const pyFilesInRoot = fs.readdirSync(projectPath).filter(f => f.endsWith('.py') && !isExcluded(f));
        if (pyFilesInRoot.length > 0) return pyFilesInRoot[0];
      } catch {}
      const search = (dir: string, depth = 0): string | null => {
        if (depth > 4) return null;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith('.py') && !isExcluded(entry.name)) {
              return path.relative(projectPath, path.join(dir, entry.name));
            }
          }
          for (const entry of entries) {
            if (entry.isDirectory()) {
              if (['.git', 'node_modules', 'venv', '.venv', 'env', '__pycache__', 'dist', 'build', 'staticfiles', 'media'].includes(entry.name)) {
                continue;
              }
              const found = search(path.join(dir, entry.name), depth + 1);
              if (found) return found;
            }
          }
        } catch {
          return null;
        }
        return null;
      };
      return search(projectPath);
    };

    const pyFile = findPythonFile();
    if (pyFile) {
      const dir = path.dirname(pyFile);
      const base = path.basename(pyFile);
      if (dir === '.') {
        return { command: `python ${base}`, label: 'Python Script' };
      } else {
        return { command: `cd "${dir}" && python ${base}`, label: 'Python Script' };
      }
    }

    return null;
  }

  getGlobalLaunchConfig(): Record<string, string> {
    const launchJsonPath = path.join(this.workspacesRoot, 'launch.json');
    if (fs.existsSync(launchJsonPath)) {
      try {
        return JSON.parse(fs.readFileSync(launchJsonPath, 'utf8'));
      } catch {
        return {};
      }
    }
    const defaultMapi: Record<string, string> = {
      'manage.py': 'python manage.py runserver',
      'main.py': 'python main.py',
      'app.py': 'python app.py',
      'index.js': 'node index.js',
      'server.js': 'node server.js',
      'app.js': 'node app.js'
    };
    try {
      fs.writeFileSync(launchJsonPath, JSON.stringify(defaultMapi, null, 2), 'utf8');
    } catch {}
    return defaultMapi;
  }
}
