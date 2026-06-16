import axios from 'axios';

export const API_URL = 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_URL,
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('yuvro_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────
export const register = (email: string, password: string) =>
  api.post('/auth/register', { email, password }).then(res => res.data);
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then(res => res.data);

// ─── Workspace ───────────────────────────────────────────────────────────────
export const getProjects = () => api.get('/workspace/projects').then(res => res.data);
export const deleteProject = (name: string) => api.delete(`/workspace/projects/${name}`).then(res => res.data);
export const createProject = (name: string) => api.post('/workspace/projects/create', { name }).then(res => res.data);
export const cloneProject = (name: string, repoUrl: string) => api.post('/workspace/projects/clone', { name, repoUrl }).then(res => res.data);
export const uploadProject = (name: string, file: File) => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('file', file);
  return api.post('/workspace/projects/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data);
};

export const getTree = (project: string) => api.get(`/workspace/${project}/tree`).then(res => res.data);
export const readFile = (project: string, path: string) => api.get(`/workspace/${project}/file/${path}`).then(res => res.data);
export const writeFile = (project: string, path: string, content: string) => api.post(`/workspace/${project}/file/${path}`, { content }).then(res => res.data);
export const createDir = (project: string, path: string) => api.post(`/workspace/${project}/create-dir/${path}`).then(res => res.data);
export const createFile = (project: string, path: string) => api.post(`/workspace/${project}/create-file/${path}`).then(res => res.data);
export const deletePath = (project: string, path: string) => api.delete(`/workspace/${project}/path/${path}`).then(res => res.data);
export const renamePath = (project: string, path: string, newName: string) => api.post(`/workspace/${project}/rename/${path}`, { newName }).then(res => res.data);

// ─── Database – SQLite ────────────────────────────────────────────────────────
export const getTables = (project: string, dbPath: string) => api.get(`/database/${project}/tables?db=${dbPath}`).then(res => res.data);
export const getSchema = (project: string, table: string, dbPath: string) => api.get(`/database/${project}/schema/${table}?db=${dbPath}`).then(res => res.data);
export const executeQuery = (project: string, dbPath: string, query: string, limit?: number, offset?: number) =>
  api.post(`/database/${project}/query`, { dbPath, query, limit, offset }).then(res => res.data);
export const getDbFiles = (project: string) => api.get(`/workspace/${project}/db-files`).then(res => res.data);

export const sqliteInsert = (project: string, dbPath: string, table: string, data: Record<string, any>) =>
  api.post(`/database/${project}/sqlite/insert`, { dbPath, table, data }).then(res => res.data);
export const sqliteUpdate = (project: string, dbPath: string, table: string, data: Record<string, any>, where: Record<string, any>) =>
  api.post(`/database/${project}/sqlite/update`, { dbPath, table, data, where }).then(res => res.data);
export const sqliteDelete = (project: string, dbPath: string, table: string, where: Record<string, any>) =>
  api.post(`/database/${project}/sqlite/delete`, { dbPath, table, where }).then(res => res.data);

// ─── Database – Connections ───────────────────────────────────────────────────
export const getConnections = (project: string) => api.get(`/database/${project}/connections`).then(res => res.data);
export const addConnection = (project: string, body: any) => api.post(`/database/${project}/connections`, body).then(res => res.data);
export const removeConnection = (project: string, connId: string) => api.delete(`/database/${project}/connections/${connId}`).then(res => res.data);

// ─── Database – MongoDB ───────────────────────────────────────────────────────
export const mongoTest = (project: string, uri: string) => api.post(`/database/${project}/mongo/test`, { uri }).then(res => res.data);
export const mongoCollections = (project: string, uri: string, dbName: string) => api.post(`/database/${project}/mongo/collections`, { uri, dbName }).then(res => res.data);
export const mongoFind = (project: string, uri: string, dbName: string, collection: string, filter?: any, limit?: number) =>
  api.post(`/database/${project}/mongo/find`, { uri, dbName, collection, filter, limit }).then(res => res.data);
export const mongoInsert = (project: string, uri: string, dbName: string, collection: string, document: any) =>
  api.post(`/database/${project}/mongo/insert`, { uri, dbName, collection, document }).then(res => res.data);
export const mongoUpdate = (project: string, uri: string, dbName: string, collection: string, id: string, update: any) =>
  api.post(`/database/${project}/mongo/update`, { uri, dbName, collection, id, update }).then(res => res.data);
export const mongoDelete = (project: string, uri: string, dbName: string, collection: string, id: string) =>
  api.post(`/database/${project}/mongo/delete`, { uri, dbName, collection, id }).then(res => res.data);

// ─── Database – External DB (MySQL/PostgreSQL) ────────────────────────────────
export const externalDbTest = (project: string, conn: any) => api.post(`/database/${project}/external/test`, conn).then(res => res.data);
export const externalDbTables = (project: string, conn: any) => api.post(`/database/${project}/external/tables`, conn).then(res => res.data);
export const externalDbQuery = (project: string, conn: any, query: string) =>
  api.post(`/database/${project}/external/query`, { conn, query }).then(res => res.data);

// ─── Misc ─────────────────────────────────────────────────────────────────────
export const detectRunCommand = (project: string) => api.get(`/workspace/${project}/detect-run`).then(res => res.data);
export const getLaunchConfig = () => api.get('/workspace/launch-config').then(res => res.data);

