import axios from 'axios';

export const API_URL = 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
});

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

export const getTables = (project: string, dbPath: string) => api.get(`/database/${project}/tables?db=${dbPath}`).then(res => res.data);
export const getSchema = (project: string, table: string, dbPath: string) => api.get(`/database/${project}/schema/${table}?db=${dbPath}`).then(res => res.data);
export const executeQuery = (project: string, dbPath: string, query: string, limit?: number, offset?: number) =>
  api.post(`/database/${project}/query`, { dbPath, query, limit, offset }).then(res => res.data);
export const getDbFiles = (project: string) => api.get(`/workspace/${project}/db-files`).then(res => res.data);

export const detectRunCommand = (project: string) => api.get(`/workspace/${project}/detect-run`).then(res => res.data);
export const getLaunchConfig = () => api.get('/workspace/launch-config').then(res => res.data);

