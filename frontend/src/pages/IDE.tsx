import React, { useState, useEffect, useRef, useCallback } from 'react';
import FileTreeComponent from '../components/FileTree';
import CodeEditor from '../components/CodeEditor';
import type { CodeEditorRef } from '../components/CodeEditor';
import TerminalComponent from '../components/Terminal';
import type { TerminalRef } from '../components/Terminal';
import DatabaseViewer from '../components/DatabaseViewer';
import LivePreview from '../components/LivePreview';
import { getTree, detectRunCommand as detectRunCommandApi, getLaunchConfig } from '../api';
import {
  ArrowLeft, Save, Play, Square, Database, ChevronUp, ChevronDown,
  RotateCcw, RefreshCw, X, Monitor,
} from 'lucide-react';

interface FileNode { id: string; name: string; children?: FileNode[]; }

const flattenNames = (nodes: FileNode[]): string[] => {
  const result: string[] = [];
  for (const n of nodes) { result.push(n.name); if (n.children) result.push(...flattenNames(n.children)); }
  return result;
};

const checkFileExists = (nodes: FileNode[], targetId: string): boolean => {
  for (const n of nodes) {
    if (n.id === targetId) return true;
    if (n.children && checkFileExists(n.children, targetId)) return true;
  }
  return false;
};

export default function IDE({ projectName, onBack }: { projectName: string; onBack: () => void }) {
  const [treeData, setTreeData] = useState<FileNode[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>('');
  const [unsaved, setUnsaved] = useState(false);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'database' | 'preview'>('terminal');
  const [bottomHeight, setBottomHeight] = useState(280);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [runCommand, setRunCommand] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [detectedCommand, setDetectedCommand] = useState<{ command: string | null; label: string | null } | null>(null);
  const [launchConfig, setLaunchConfig] = useState<Record<string, string>>({});

  const editorRef = useRef<CodeEditorRef>(null);
  const terminalRef = useRef<TerminalRef>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const isRestartingRef = useRef(false);

  const loadTree = useCallback(() => {
    getTree(projectName)
      .then(data => {
        setTreeData(data as FileNode[]);
        if (activeFile && !checkFileExists(data as FileNode[], activeFile)) {
          setActiveFile(null); setActiveFileName(''); setUnsaved(false);
        }
      })
      .catch(() => setTreeData([]));
  }, [projectName, activeFile]);

  useEffect(() => { loadTree(); }, [loadTree]);

  useEffect(() => {
    getLaunchConfig().then(setLaunchConfig).catch(() => {});
  }, []);

  useEffect(() => {
    detectRunCommandApi(projectName).then(setDetectedCommand).catch(() => {});
  }, [projectName, treeData]);

  useEffect(() => {
    let decodedPath = '';
    try { if (activeFile) decodedPath = atob(activeFile); } catch {}
    const filename = decodedPath.split('/').pop() || '';
    if (filename && launchConfig[filename]) {
      setRunCommand(launchConfig[filename]);
    } else if (decodedPath && launchConfig[decodedPath]) {
      setRunCommand(launchConfig[decodedPath]);
    } else {
      const isFrameworkServer =
        detectedCommand?.label === 'Django Dev Server' ||
        detectedCommand?.label === 'FastAPI Server' ||
        detectedCommand?.label === 'Flask Server';
      if (decodedPath.endsWith('.py') && !isFrameworkServer) setRunCommand(`python "${decodedPath}"`);
      else if (decodedPath.endsWith('.js') && !isFrameworkServer) setRunCommand(`node "${decodedPath}"`);
      else setRunCommand(detectedCommand?.command || '');
    }
  }, [detectedCommand, activeFile, launchConfig]);

  const handleSelectFile = (path: string) => {
    setActiveFile(path);
    setActiveFileName(atob(path).split('/').pop() || '');
    setUnsaved(false);
  };

  const handleSave = async () => { await editorRef.current?.save(); };

  const handleRun = () => {
    if (!runCommand) return;
    setBottomTab('terminal');
    setBottomCollapsed(false);
    setTimeout(() => { terminalRef.current?.runCommand(projectName, runCommand); setIsRunning(true); }, 100);
  };

  const handleStop = () => { terminalRef.current?.stopCommand(); setIsRunning(false); };

  const handleRestart = () => {
    if (!runCommand) return;
    setIsRestarting(true); isRestartingRef.current = true;
    setBottomTab('terminal'); setBottomCollapsed(false);
    terminalRef.current?.restartCommand();
    setIsRunning(true);
    setTimeout(() => { setIsRestarting(false); isRestartingRef.current = false; }, 1500);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startY: e.clientY, startH: bottomHeight };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setBottomHeight(Math.max(80, Math.min(600, dragRef.current.startH + delta)));
      setBottomCollapsed(false);
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="ide-root">
      <div className="ide-toolbar">
        <div className="ide-toolbar-left">
          <div className="ide-brand">
            <img src="/yuvro-head.png" alt="Yuvro" className="ide-brand-logo" />
            <span className="ide-brand-name">Web-IDE</span>
          </div>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onClick={onBack} title="Back to Dashboard"><ArrowLeft size={16} /></button>
          <div className="toolbar-divider" />
          <span className="ide-project-name">{projectName}</span>
          {activeFileName && (
            <>
              <span className="toolbar-sep">/</span>
              <span className="ide-file-name">
                {activeFileName}
                {unsaved && <span className="unsaved-dot" title="Unsaved changes">●</span>}
              </span>
            </>
          )}
        </div>

        <div className="ide-toolbar-center">
          <button
            className={`toolbar-btn ${!activeFile || !unsaved ? 'disabled' : 'save-btn'}`}
            onClick={handleSave}
            disabled={!activeFile || !unsaved}
            title="Save (Ctrl+S)"
          >
            <Save size={15} />
            <span>Save</span>
            {unsaved && <span className="unsaved-badge">●</span>}
          </button>
          <div className="toolbar-divider" />
          {isRunning ? (
            <>
              <button className="toolbar-btn stop-btn" onClick={handleStop} title="Stop process">
                <Square size={15} /><span>Stop</span>
              </button>
              <button className={`toolbar-btn restart-btn ${isRestarting ? 'restarting' : ''}`} onClick={handleRestart} title="Restart process">
                <RefreshCw size={15} className={isRestarting ? 'spin' : ''} /><span>Restart</span>
              </button>
            </>
          ) : (
            <button className="toolbar-btn run-btn" onClick={handleRun} disabled={!runCommand} title="Run">
              <Play size={15} /><span>Run</span>
            </button>
          )}
        </div>

        <div className="ide-toolbar-right">
          <button
            className={`toolbar-btn ${bottomTab === 'terminal' ? 'active' : ''}`}
            onClick={() => { setBottomTab('terminal'); setBottomCollapsed(false); }}
            title="Terminal"
          >
            <span>Terminal</span>
          </button>
          <button
            className={`toolbar-btn ${bottomTab === 'database' ? 'active' : ''}`}
            onClick={() => { setBottomTab('database'); setBottomCollapsed(false); }}
            title="Database"
          >
            <Database size={15} /><span>Database</span>
          </button>
          <button
            className={`toolbar-btn ${bottomTab === 'preview' ? 'active' : ''}`}
            onClick={() => { setBottomTab('preview'); setBottomCollapsed(false); }}
            title="Live Preview"
          >
            <Monitor size={15} /><span>Preview</span>
          </button>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onClick={() => terminalRef.current?.clearScreen()} title="Clear Terminal">
            <RotateCcw size={14} />
          </button>
          <button className="toolbar-btn" onClick={() => setBottomCollapsed(c => !c)} title={bottomCollapsed ? 'Expand' : 'Collapse'}>
            {bottomCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <div className="ide-body">
        <div className="ide-sidebar">
          <FileTreeComponent
            projectName={projectName}
            treeData={treeData as unknown[]}
            onSelectFile={handleSelectFile}
            onRefresh={loadTree}
          />
        </div>

        <div className="ide-main">
          <div className="editor-area">
            {activeFile && (
              <div className="editor-tab-bar">
                <div className="editor-tab active">
                  <span>{activeFileName}</span>
                  {unsaved && <span className="unsaved-dot">●</span>}
                  <button className="tab-close" onClick={() => { setActiveFile(null); setActiveFileName(''); setUnsaved(false); }} title="Close file">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
            <div className="editor-content">
              <CodeEditor ref={editorRef} projectName={projectName} filePath={activeFile} onUnsavedChange={setUnsaved} />
            </div>
          </div>

          {!bottomCollapsed && (
            <>
              <div className="panel-resize-handle" onMouseDown={handleMouseDown} title="Drag to resize" />
              <div className="bottom-panel" style={{ height: bottomHeight }}>
                <div className="bottom-tabs">
                  <button className={`bottom-tab ${bottomTab === 'terminal' ? 'active' : ''}`} onClick={() => setBottomTab('terminal')}>Terminal</button>
                  <button className={`bottom-tab ${bottomTab === 'database' ? 'active' : ''}`} onClick={() => setBottomTab('database')}>
                    <Database size={13} /> Database
                  </button>
                  <button className={`bottom-tab ${bottomTab === 'preview' ? 'active' : ''}`} onClick={() => setBottomTab('preview')}>
                    <Monitor size={13} /> Preview
                  </button>
                  <div className="bottom-tabs-spacer" />
                  <button className="bottom-tab-close" onClick={() => setBottomCollapsed(true)} title="Collapse panel"><X size={13} /></button>
                </div>

                <div className="bottom-content">
                  <div style={{ display: bottomTab === 'terminal' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
                    <TerminalComponent
                      key={projectName}
                      ref={terminalRef}
                      projectName={projectName}
                      onProcessExit={() => { if (!isRestartingRef.current) setIsRunning(false); }}
                    />
                  </div>
                  <div style={{ display: bottomTab === 'database' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
                    <DatabaseViewer key={projectName} projectName={projectName} />
                  </div>
                  <div style={{ display: bottomTab === 'preview' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
                    <LivePreview runCommand={runCommand} isRunning={isRunning} />
                  </div>
                </div>
              </div>
            </>
          )}

          {bottomCollapsed && (
            <div className="bottom-collapsed-bar">
              <button className={`bottom-tab ${bottomTab === 'terminal' ? 'active' : ''}`} onClick={() => { setBottomTab('terminal'); setBottomCollapsed(false); }}>Terminal</button>
              <button className={`bottom-tab ${bottomTab === 'database' ? 'active' : ''}`} onClick={() => { setBottomTab('database'); setBottomCollapsed(false); }}>
                <Database size={13} /> Database
              </button>
              <button className={`bottom-tab ${bottomTab === 'preview' ? 'active' : ''}`} onClick={() => { setBottomTab('preview'); setBottomCollapsed(false); }}>
                <Monitor size={13} /> Preview
              </button>
              <button className="bottom-tab" onClick={() => setBottomCollapsed(false)}><ChevronUp size={13} /> Expand</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
