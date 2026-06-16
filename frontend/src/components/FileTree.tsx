import { useState } from 'react';
import { Tree, NodeApi } from 'react-arborist';
import { File, Folder, ChevronRight, ChevronDown, Plus, Trash2, Edit2 } from 'lucide-react';
import { createDir, createFile, deletePath, renamePath } from '../api';
import QuickInput from './QuickInput';

// ─── Language-aware file icon colors ─────────────────────────────────────────
function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    html: '#e34c26', htm: '#e34c26',
    css: '#264de4', scss: '#cc6699', sass: '#cc6699', less: '#1d365d',
    js: '#f7df1e', jsx: '#61dafb', mjs: '#f7df1e',
    ts: '#3178c6', tsx: '#61dafb',
    py: '#3572A5', pyw: '#3572A5',
    json: '#cbcb41', jsonc: '#cbcb41',
    md: '#083fa1', mdx: '#083fa1',
    yml: '#cb171e', yaml: '#cb171e',
    sh: '#89e051', bash: '#89e051', zsh: '#89e051',
    sql: '#e38c00', db: '#e38c00', sqlite: '#e38c00', sqlite3: '#e38c00',
    txt: '#8b949e', env: '#ecd53f', gitignore: '#f14e32',
    rs: '#dea584', go: '#00acd7', java: '#b07219', php: '#4f5d95',
    rb: '#701516', c: '#555555', cpp: '#f34b7d', cs: '#178600',
    vue: '#41b883', svelte: '#ff3e00',
    png: '#a78bfa', jpg: '#a78bfa', jpeg: '#a78bfa', gif: '#a78bfa',
    svg: '#ffb13b', ico: '#a78bfa', webp: '#a78bfa',
    pdf: '#f40f02', zip: '#f59e0b', tar: '#f59e0b', gz: '#f59e0b',
    dockerfile: '#0db7ed', toml: '#9c4221', xml: '#0060ac',
    lock: '#6b7280', requirements: '#3572A5',
  };
  return map[ext] ?? 'var(--text-muted)';
}

function FileIcon({ name }: { name: string }) {
  const color = getFileColor(name);
  return <File size={16} color={color} />;
}

interface FileNode {
  id: string;
  name: string;
  children?: FileNode[];
}

type DialogState =
  | { type: 'none' }
  | { type: 'create-file'; parentId: string | null }
  | { type: 'create-folder'; parentId: string | null }
  | { type: 'rename'; nodeId: string; currentName: string }
  | { type: 'delete'; nodeId: string; nodeName: string };

export default function FileTreeComponent({
  projectName,
  treeData,
  onSelectFile,
  onRefresh
}: {
  projectName: string;
  treeData: unknown[];
  onSelectFile: (path: string) => void;
  onRefresh: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: 'none' });

  const openCreateFile = () => setDialog({ type: 'create-file', parentId: selectedId });
  const openCreateFolder = () => setDialog({ type: 'create-folder', parentId: selectedId });

  const openRename = () => {
    if (!selectedId) return;
    const findName = (nodes: FileNode[]): string | null => {
      for (const n of nodes) {
        if (n.id === selectedId) return n.name;
        if (n.children) {
          const found = findName(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const name = findName(treeData as FileNode[]) ?? '';
    setDialog({ type: 'rename', nodeId: selectedId, currentName: name });
  };

  const openDelete = () => {
    if (!selectedId) return;
    const findName = (nodes: FileNode[]): string | null => {
      for (const n of nodes) {
        if (n.id === selectedId) return n.name;
        if (n.children) {
          const found = findName(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const name = findName(treeData as FileNode[]) ?? 'this item';
    setDialog({ type: 'delete', nodeId: selectedId, nodeName: name });
  };

  const handleDialogConfirm = async (value?: string) => {
    if (dialog.type === 'create-file') {
      if (!value?.trim()) return;
      const parent = dialog.parentId ? atob(dialog.parentId) + '/' : '';
      await createFile(projectName, btoa(parent + value.trim()));
      onRefresh();
    } else if (dialog.type === 'create-folder') {
      if (!value?.trim()) return;
      const parent = dialog.parentId ? atob(dialog.parentId) + '/' : '';
      await createDir(projectName, btoa(parent + value.trim()));
      onRefresh();
    } else if (dialog.type === 'rename') {
      if (!value?.trim()) return;
      await renamePath(projectName, dialog.nodeId, value.trim());
      onRefresh();
    } else if (dialog.type === 'delete') {
      await deletePath(projectName, dialog.nodeId);
      setSelectedId(null);
      onRefresh();
    }
    setDialog({ type: 'none' });
  };

  const handleDialogCancel = () => setDialog({ type: 'none' });

  const Node = ({ node, style, dragHandle }: { node: NodeApi<FileNode>, style: React.CSSProperties, dragHandle?: React.Ref<HTMLDivElement> }) => {
    const isFolder = node.data.children !== undefined;
    return (
      <div
        style={style}
        ref={dragHandle}
        className={`file-node ${selectedId === node.data.id ? 'selected' : ''}`}
        onClick={() => {
          setSelectedId(node.data.id);
          if (isFolder) {
            node.toggle();
          } else {
            onSelectFile(node.data.id);
          }
        }}
      >
        {isFolder ? (
          node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : <span style={{ width: 14, display: 'inline-block' }}></span>}

        {isFolder ? <Folder size={16} color="var(--accent)" /> : <FileIcon name={node.data.name} />}
        <span>{node.data.name}</span>
      </div>
    );
  };

  const dialogConfig = (() => {
    switch (dialog.type) {
      case 'create-file':
        return { isOpen: true, type: 'input' as const, title: 'New File', placeholder: 'filename.py', confirmText: 'Create', defaultValue: '' };
      case 'create-folder':
        return { isOpen: true, type: 'input' as const, title: 'New Folder', placeholder: 'folder-name', confirmText: 'Create', defaultValue: '' };
      case 'rename':
        return { isOpen: true, type: 'input' as const, title: 'Rename', placeholder: 'new-name', confirmText: 'Rename', defaultValue: dialog.currentName };
      case 'delete':
        return { isOpen: true, type: 'confirm' as const, title: 'Delete Item', message: `Delete "${dialog.nodeName}"? This action cannot be undone.`, confirmText: 'Delete', defaultValue: '' };
      default:
        return { isOpen: false, type: 'input' as const, title: '', placeholder: '', confirmText: 'OK', defaultValue: '' };
    }
  })();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <QuickInput
        isOpen={dialogConfig.isOpen}
        type={dialogConfig.type}
        title={dialogConfig.title}
        placeholder={'placeholder' in dialogConfig ? dialogConfig.placeholder : undefined}
        defaultValue={dialogConfig.defaultValue}
        message={'message' in dialogConfig ? dialogConfig.message : undefined}
        confirmText={dialogConfig.confirmText}
        cancelText="Cancel"
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />

      <div className="sidebar-header">
        <span>Explorer</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={openCreateFile} title="New File"><Plus size={16} /></button>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={openCreateFolder} title="New Folder"><Folder size={16} /></button>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={openRename} title="Rename"><Edit2 size={16} /></button>
          <button style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={openDelete} title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="file-tree-container">
        <Tree
          data={treeData as FileNode[]}
          width="100%"
          height={1000}
          indent={16}
          rowHeight={28}
          padding={8}
        >
          {Node}
        </Tree>
      </div>
    </div>
  );
}
