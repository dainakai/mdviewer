import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import MarkdownIt from 'markdown-it';
import { tex } from '@mdit/plugin-tex';
import katex from 'katex';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdownLanguage from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FilePlus2,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sun,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import './styles.css';

const api = window.mdviewer;
const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'];
const MERMAID_THEME_BY_APP_THEME = {
  light: 'default',
  dark: 'dark'
};
const MERMAID_THEME_VARIABLES = {
  fontSize: '20px',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};
let mermaidModulePromise = null;

function loadMermaid() {
  mermaidModulePromise ??= import('mermaid').then((module) => module.default);
  return mermaidModulePromise;
}

[
  ['bash', bash],
  ['sh', bash],
  ['cpp', cpp],
  ['c++', cpp],
  ['css', css],
  ['go', go],
  ['java', java],
  ['javascript', javascript],
  ['js', javascript],
  ['json', json],
  ['markdown', markdownLanguage],
  ['md', markdownLanguage],
  ['python', python],
  ['py', python],
  ['rust', rust],
  ['rs', rust],
  ['typescript', typescript],
  ['ts', typescript],
  ['xml', xml],
  ['html', xml],
  ['yaml', yaml],
  ['yml', yaml]
].forEach(([name, language]) => hljs.registerLanguage(name, language));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePath(filePath) {
  const parts = [];
  for (const part of filePath.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function fileUrlFromPath(filePath) {
  return `file://${filePath.split('/').map(encodeURIComponent).join('/')}`;
}

function splitFileUrl(value) {
  const withoutScheme = value.replace(/^file:\/\//, '');
  const hashIndex = withoutScheme.indexOf('#');
  const pathPart = hashIndex >= 0 ? withoutScheme.slice(0, hashIndex) : withoutScheme;
  return decodeURIComponent(pathPart);
}

function isMarkdownFile(filePath) {
  const lower = filePath.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function basename(filePath) {
  const clean = filePath.replace(/\/$/, '');
  return clean.slice(clean.lastIndexOf('/') + 1);
}

function dirname(filePath) {
  const index = filePath.lastIndexOf('/');
  return index <= 0 ? '/' : filePath.slice(0, index);
}

function resolveLocalReference(rawHref, baseDirectory) {
  if (!rawHref || /^(https?:|mailto:|data:|#)/i.test(rawHref)) return rawHref;
  const [withoutHash, hash = ''] = rawHref.split('#');
  const [withoutQuery, query = ''] = withoutHash.split('?');
  const resolvedPath = withoutQuery.startsWith('/')
    ? normalizePath(withoutQuery)
    : normalizePath(`${baseDirectory}/${withoutQuery}`);
  const querySuffix = query ? `?${query}` : '';
  const hashSuffix = hash ? `#${hash}` : '';
  return `${fileUrlFromPath(resolvedPath)}${querySuffix}${hashSuffix}`;
}

function slugify(value) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'heading';
}

function createMarkdownRenderer() {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    highlight(code, language) {
      if (language && hljs.getLanguage(language)) {
        try {
          return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`;
        } catch {
          return '';
        }
      }
      try {
        return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`;
      } catch {
        return '';
      }
    }
  }).use(tex, {
    delimiters: 'all',
    mathFence: true,
    render(content, displayMode) {
      return katex.renderToString(content, {
        displayMode,
        throwOnError: false,
        strict: 'ignore',
        trust: false,
        output: 'htmlAndMathml'
      });
    }
  });

  const defaultFence = md.renderer.rules.fence || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const language = token.info.trim().split(/\s+/)[0]?.toLowerCase();
    if (language === 'mermaid') {
      return `<div class="mermaid-block"><pre class="mermaid">${md.utils.escapeHtml(token.content.trim())}</pre></div>`;
    }
    return defaultFence(tokens, idx, options, env, self);
  };

  const defaultHeadingOpen = md.renderer.rules.heading_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const inline = tokens[idx + 1];
    const text = inline?.content ?? '';
    const baseSlug = slugify(text);
    const count = env.headingCounts.get(baseSlug) ?? 0;
    env.headingCounts.set(baseSlug, count + 1);
    const id = count ? `${baseSlug}-${count + 1}` : baseSlug;
    token.attrSet('id', id);
    env.headings.push({ id, text, level: Number(token.tag.replace('h', '')) || 1 });
    return defaultHeadingOpen(tokens, idx, options, env, self);
  };

  const defaultImage = md.renderer.rules.image || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src');
    token.attrSet('src', resolveLocalReference(src, env.baseDirectory));
    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, idx, options, env, self);
  };

  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href');
    token.attrSet('href', resolveLocalReference(href, env.baseDirectory));
    token.attrSet('rel', 'noreferrer');
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  return md;
}

const markdown = createMarkdownRenderer();

function renderMarkdown(content, filePath) {
  const env = {
    baseDirectory: dirname(filePath),
    headings: [],
    headingCounts: new Map()
  };
  const html = markdown.render(content || '', env);
  return { html, headings: env.headings };
}

function createInitialPanes() {
  return [
    { id: 'left', title: 'Left', tabs: [], activeId: null },
    { id: 'right', title: 'Right', tabs: [], activeId: null }
  ];
}

function ToolbarButton({ title, onClick, disabled, active, children }) {
  return (
    <button
      className={`icon-button ${active ? 'is-active' : ''}`}
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function App() {
  const [documents, setDocuments] = useState([]);
  const [panes, setPanes] = useState(createInitialPanes);
  const [activePaneId, setActivePaneId] = useState('left');
  const [showSplit, setShowSplit] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [theme, setTheme] = useState('light');
  const [recentFiles, setRecentFiles] = useState([]);
  const [status, setStatus] = useState('Ready');
  const [searchText, setSearchText] = useState('');
  const searchInputRef = useRef(null);

  const docsById = useMemo(() => new Map(documents.map((doc) => [doc.id, doc])), [documents]);
  const docsByPath = useMemo(() => new Map(documents.map((doc) => [doc.path, doc])), [documents]);
  const activePane = panes.find((pane) => pane.id === activePaneId) ?? panes[0];
  const activeDoc = activePane?.activeId ? docsById.get(activePane.activeId) : null;
  const visiblePanes = showSplit ? panes : [panes[0]];
  const watchedPathKey = documents.map((doc) => doc.path).join('\0');

  const updateDocument = useCallback((id, updater) => {
    setDocuments((current) => current.map((doc) => (doc.id === id ? updater(doc) : doc)));
  }, []);

  const setActiveTab = useCallback((paneId, docId) => {
    setActivePaneId(paneId);
    setPanes((current) => current.map((pane) => (pane.id === paneId ? { ...pane, activeId: docId } : pane)));
  }, []);

  const ensurePaneHasTab = useCallback((paneId, docId) => {
    setPanes((current) =>
      current.map((pane) => {
        if (pane.id !== paneId) return pane;
        return {
          ...pane,
          tabs: pane.tabs.includes(docId) ? pane.tabs : [...pane.tabs, docId],
          activeId: docId
        };
      })
    );
    setActivePaneId(paneId);
  }, []);

  const refreshRecentFiles = useCallback(async () => {
    const settings = await api.getSettings();
    setRecentFiles(settings.recentFiles ?? []);
  }, []);

  const openPaths = useCallback(async (filePaths, targetPaneId = activePaneId) => {
    const uniquePaths = [...new Set((filePaths ?? []).filter(Boolean))];
    for (const filePath of uniquePaths) {
      const existing = docsByPath.get(filePath);
      if (existing) {
        const containingPane = panes.find((pane) => pane.tabs.includes(existing.id));
        ensurePaneHasTab(containingPane?.id ?? targetPaneId, existing.id);
        continue;
      }

      try {
        const loaded = await api.readFile(filePath);
        const id = `${loaded.path}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        const rendered = renderMarkdown(loaded.content, loaded.path);
        const doc = {
          id,
          path: loaded.path,
          name: loaded.name,
          directory: loaded.directory,
          content: loaded.content,
          savedContent: loaded.content,
          mtimeMs: loaded.mtimeMs,
          html: rendered.html,
          headings: rendered.headings,
          isEditing: false,
          dirty: false,
          externalChanged: false,
          deleted: false,
          error: null
        };
        setDocuments((current) => [...current, doc]);
        ensurePaneHasTab(targetPaneId, id);
        setStatus(`Opened ${loaded.name}`);
      } catch (error) {
        setStatus(`Open failed: ${error.message}`);
      }
    }
    refreshRecentFiles();
  }, [activePaneId, docsByPath, ensurePaneHasTab, panes, refreshRecentFiles]);

  const openDialog = useCallback(async () => {
    const filePaths = await api.openFilesDialog();
    if (filePaths.length) openPaths(filePaths, activePaneId);
  }, [activePaneId, openPaths]);

  const reloadDocument = useCallback(async (docId, force = false) => {
    const doc = docsById.get(docId);
    if (!doc) return;
    if (doc.dirty && !force) {
      updateDocument(docId, (current) => ({ ...current, externalChanged: true }));
      return;
    }
    try {
      const loaded = await api.readFile(doc.path);
      const rendered = renderMarkdown(loaded.content, loaded.path);
      updateDocument(docId, (current) => ({
        ...current,
        content: loaded.content,
        savedContent: loaded.content,
        mtimeMs: loaded.mtimeMs,
        html: rendered.html,
        headings: rendered.headings,
        dirty: false,
        externalChanged: false,
        deleted: false,
        error: null
      }));
      setStatus(`Refreshed ${loaded.name}`);
      refreshRecentFiles();
    } catch (error) {
      updateDocument(docId, (current) => ({ ...current, error: error.message }));
      setStatus(`Refresh failed: ${error.message}`);
    }
  }, [docsById, refreshRecentFiles, updateDocument]);

  const saveDocument = useCallback(async (docId = activeDoc?.id) => {
    const doc = docsById.get(docId);
    if (!doc) return;
    try {
      const saved = await api.writeFile(doc.path, doc.content);
      const rendered = renderMarkdown(saved.content, saved.path);
      updateDocument(doc.id, (current) => ({
        ...current,
        content: saved.content,
        savedContent: saved.content,
        mtimeMs: saved.mtimeMs,
        html: rendered.html,
        headings: rendered.headings,
        dirty: false,
        externalChanged: false,
        deleted: false,
        error: null
      }));
      setStatus(`Saved ${saved.name}`);
      refreshRecentFiles();
    } catch (error) {
      setStatus(`Save failed: ${error.message}`);
    }
  }, [activeDoc?.id, docsById, refreshRecentFiles, updateDocument]);

  const closeTab = useCallback((paneId = activePaneId, docId = activeDoc?.id) => {
    if (!docId) return;
    const docStillReferenced = (nextPanes) => nextPanes.some((pane) => pane.tabs.includes(docId));
    setPanes((current) => {
      const next = current.map((pane) => {
        if (pane.id !== paneId) return pane;
        const nextTabs = pane.tabs.filter((id) => id !== docId);
        const nextActive = pane.activeId === docId ? nextTabs[nextTabs.length - 1] ?? null : pane.activeId;
        return { ...pane, tabs: nextTabs, activeId: nextActive };
      });
      if (!docStillReferenced(next)) {
        setDocuments((currentDocs) => currentDocs.filter((doc) => doc.id !== docId));
      }
      return next;
    });
  }, [activeDoc?.id, activePaneId]);

  const closeEmptyPane = useCallback((paneId) => {
    setPanes((currentPanes) => {
      const [left, right] = currentPanes;
      if (paneId === 'left' && left.tabs.length === 0) {
        return [
          { ...left, tabs: right.tabs, activeId: right.activeId ?? right.tabs[0] ?? null },
          { ...right, tabs: [], activeId: null }
        ];
      }
      if (paneId === 'right' && right.tabs.length === 0) {
        return [
          left,
          { ...right, tabs: [], activeId: null }
        ];
      }
      return currentPanes;
    });
    setShowSplit(false);
    setActivePaneId('left');
  }, []);

  const toggleSplit = useCallback(() => {
    setShowSplit((current) => {
      const next = !current;
      if (next) {
        const left = panes[0];
        const right = panes[1];
        if (!right.activeId && left.tabs.length > 1) {
          const docToMove = left.activeId ?? left.tabs[left.tabs.length - 1];
          setPanes((currentPanes) =>
            currentPanes.map((pane) => {
              if (pane.id === 'left') {
                const nextTabs = pane.tabs.filter((id) => id !== docToMove);
                return { ...pane, tabs: nextTabs, activeId: nextTabs[nextTabs.length - 1] ?? null };
              }
              return { ...pane, tabs: pane.tabs.includes(docToMove) ? pane.tabs : [...pane.tabs, docToMove], activeId: docToMove };
            })
          );
          setActivePaneId('right');
        }
      } else {
        setPanes((currentPanes) => {
          const [left, right] = currentPanes;
          const mergedTabs = [...left.tabs, ...right.tabs.filter((id) => !left.tabs.includes(id))];
          return [
            { ...left, tabs: mergedTabs, activeId: left.activeId ?? right.activeId ?? mergedTabs[0] ?? null },
            { ...right, tabs: [], activeId: null }
          ];
        });
        setActivePaneId('left');
      }
      return next;
    });
  }, [panes]);

  const moveActiveToOtherPane = useCallback(() => {
    if (!activeDoc) return;
    const fromId = activePaneId;
    const toId = fromId === 'left' ? 'right' : 'left';
    setShowSplit(true);
    setPanes((current) =>
      current.map((pane) => {
        if (pane.id === fromId) {
          const nextTabs = pane.tabs.filter((id) => id !== activeDoc.id);
          return { ...pane, tabs: nextTabs, activeId: nextTabs[nextTabs.length - 1] ?? null };
        }
        if (pane.id === toId) {
          return {
            ...pane,
            tabs: pane.tabs.includes(activeDoc.id) ? pane.tabs : [...pane.tabs, activeDoc.id],
            activeId: activeDoc.id
          };
        }
        return pane;
      })
    );
    setActivePaneId(toId);
  }, [activeDoc, activePaneId]);

  const updateZoom = useCallback((nextZoom) => {
    const clampedZoom = clamp(nextZoom, 0.55, 2.4);
    setZoom(clampedZoom);
    api.setZoom(clampedZoom);
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    api.setTheme(nextTheme);
  }, [theme]);

  const handleWheel = useCallback((event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    updateZoom(zoom + delta);
  }, [updateZoom, zoom]);

  const handleDocumentChange = useCallback((docId, content) => {
    updateDocument(docId, (doc) => {
      return {
        ...doc,
        content,
        dirty: content !== doc.savedContent
      };
    });
  }, [updateDocument]);

  const toggleDocumentEdit = useCallback((docId) => {
    updateDocument(docId, (doc) => {
      if (doc.isEditing) {
        const rendered = renderMarkdown(doc.content, doc.path);
        return { ...doc, html: rendered.html, headings: rendered.headings, isEditing: false };
      }
      return { ...doc, isEditing: true };
    });
  }, [updateDocument]);

  const handlePreviewClick = useCallback((event, doc) => {
    const anchor = event.target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    event.preventDefault();

    if (href.startsWith('#')) {
      document.getElementById(href.slice(1))?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }

    if (href.startsWith('file://')) {
      const localPath = splitFileUrl(href);
      if (isMarkdownFile(localPath)) {
        openPaths([localPath], activePaneId);
      } else {
        api.openPathOrUrl(href);
      }
      return;
    }

    api.openPathOrUrl(href);
  }, [activePaneId, openPaths]);

  const runFind = useCallback((direction = 1, findNext = false) => {
    if (!searchText.trim()) {
      api.stopFind();
      return;
    }
    api.startFind(searchText, { forward: direction > 0, findNext });
  }, [searchText]);

  useEffect(() => {
    api.getSettings().then((settings) => {
      setZoom(settings.zoom ?? 1);
      setTheme(settings.theme === 'dark' ? 'dark' : 'light');
      setRecentFiles(settings.recentFiles ?? []);
    });
    api.loadUserCss().then((css) => {
      if (!css) return;
      const style = document.createElement('style');
      style.id = 'mdviewer-user-css';
      style.textContent = css;
      document.head.appendChild(style);
    });
    api.rendererReady();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const unsubscribers = [
      api.onOpenFiles((filePaths) => openPaths(filePaths, activePaneId)),
      api.onFileChanged(({ path: changedPath, type }) => {
        const doc = docsByPath.get(changedPath);
        if (!doc) return;
        if (type === 'unlink') {
          updateDocument(doc.id, (current) => ({ ...current, deleted: true, externalChanged: true }));
          setStatus(`File deleted: ${doc.name}`);
          return;
        }
        if (doc.dirty || doc.isEditing) {
          updateDocument(doc.id, (current) => ({ ...current, externalChanged: true }));
          setStatus(`External change detected: ${doc.name}`);
        } else {
          reloadDocument(doc.id, true);
        }
      }),
      api.onMenuOpenDialog(openDialog),
      api.onMenuSave(() => saveDocument()),
      api.onMenuCloseTab(() => closeTab()),
      api.onMenuFind(() => searchInputRef.current?.focus()),
      api.onMenuPrint(() => api.print())
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [activePaneId, closeTab, docsByPath, openDialog, openPaths, reloadDocument, saveDocument, updateDocument]);

  useEffect(() => {
    api.watchFiles(watchedPathKey ? watchedPathKey.split('\0') : []);
  }, [watchedPathKey]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === 'o') {
        event.preventDefault();
        openDialog();
      } else if (key === 's') {
        event.preventDefault();
        saveDocument();
      } else if (key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === 'w') {
        event.preventDefault();
        closeTab();
      } else if (key === '=' || key === '+') {
        event.preventDefault();
        updateZoom(zoom + 0.1);
      } else if (key === '-') {
        event.preventDefault();
        updateZoom(zoom - 0.1);
      } else if (key === '0') {
        event.preventDefault();
        updateZoom(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTab, openDialog, saveDocument, updateZoom, zoom]);

  useEffect(() => {
    const handleDrop = (event) => {
      event.preventDefault();
      const paths = [...event.dataTransfer.files]
        .map((file) => file.path)
        .filter((filePath) => filePath && isMarkdownFile(filePath));
      if (paths.length) openPaths(paths, activePaneId);
    };
    const stop = (event) => event.preventDefault();
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', handleDrop);
    };
  }, [activePaneId, openPaths]);

  const activeHeadings = activeDoc?.headings ?? [];

  return (
    <div className="app-shell" onWheel={handleWheel}>
      <header className="topbar">
        <div className="brand">
          <BookOpen size={20} />
          <span>Markdown Viewer</span>
        </div>
        <div className="toolbar">
          <ToolbarButton title="Open Markdown" onClick={openDialog}>
            <FolderOpen size={18} />
          </ToolbarButton>
          <ToolbarButton title="Refresh" disabled={!activeDoc} onClick={() => activeDoc && reloadDocument(activeDoc.id, true)}>
            <RefreshCw size={18} />
          </ToolbarButton>
          <ToolbarButton title="Split View" active={showSplit} onClick={toggleSplit}>
            <Columns2 size={18} />
          </ToolbarButton>
          <ToolbarButton title="Move Tab to Other Pane" disabled={!activeDoc} onClick={moveActiveToOtherPane}>
            <ChevronRight size={18} />
          </ToolbarButton>
          <ToolbarButton title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </ToolbarButton>
        </div>
        <div className="search-box">
          <Search size={16} />
          <input
            ref={searchInputRef}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runFind(event.shiftKey ? -1 : 1, true);
              if (event.key === 'Escape') {
                setSearchText('');
                api.stopFind();
              }
            }}
            placeholder="Search"
          />
          <button type="button" title="Previous" onClick={() => runFind(-1, true)}>
            <ChevronLeft size={16} />
          </button>
          <button type="button" title="Next" onClick={() => runFind(1, true)}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="zoom-controls">
          <ToolbarButton title="Zoom Out" onClick={() => updateZoom(zoom - 0.1)}>
            <ZoomOut size={18} />
          </ToolbarButton>
          <span>{Math.round(zoom * 100)}%</span>
          <ToolbarButton title="Zoom In" onClick={() => updateZoom(zoom + 0.1)}>
            <ZoomIn size={18} />
          </ToolbarButton>
        </div>
      </header>

      <main className="main-layout">
        <aside className={`sidebar ${showSidebar ? '' : 'is-collapsed'}`}>
          <button
            className="sidebar-toggle"
            type="button"
            title={showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
            onClick={() => setShowSidebar((current) => !current)}
          >
            {showSidebar ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
          {showSidebar && (
            <>
              <section className="sidebar-section">
                <div className="section-title">Outline</div>
                <nav className="outline">
                  {activeHeadings.length ? activeHeadings.map((heading) => (
                    <button
                      key={heading.id}
                      className="outline-link"
                      style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
                      type="button"
                      onClick={() => document.getElementById(heading.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}
                    >
                      {heading.text}
                    </button>
                  )) : <div className="muted-line">No headings</div>}
                </nav>
              </section>
              <section className="sidebar-section">
                <div className="section-title">Recent</div>
                <div className="recent-list">
                  {recentFiles.length ? recentFiles.map((filePath) => (
                    <button key={filePath} type="button" onClick={() => openPaths([filePath], activePaneId)}>
                      <span>{basename(filePath)}</span>
                      <small>{dirname(filePath)}</small>
                    </button>
                  )) : <div className="muted-line">No recent files</div>}
                </div>
              </section>
            </>
          )}
        </aside>

        <section className={`workspace ${showSplit ? 'is-split' : ''}`}>
          {visiblePanes.map((pane) => {
            const paneDoc = pane.activeId ? docsById.get(pane.activeId) : null;
            return (
              <Pane
                key={pane.id}
                pane={pane}
                doc={paneDoc}
                docsById={docsById}
                zoom={zoom}
                theme={theme}
                isActive={activePaneId === pane.id}
                canCloseEmptyPane={showSplit && pane.tabs.length === 0}
                onActivatePane={() => setActivePaneId(pane.id)}
                onActivateTab={(docId) => setActiveTab(pane.id, docId)}
                onCloseTab={(docId) => closeTab(pane.id, docId)}
                onCloseEmptyPane={() => closeEmptyPane(pane.id)}
                onOpenDialog={openDialog}
                onChangeDocument={handleDocumentChange}
                onReload={(force) => paneDoc && reloadDocument(paneDoc.id, force)}
                onSave={() => paneDoc && saveDocument(paneDoc.id)}
                onRevert={() => paneDoc && updateDocument(paneDoc.id, (doc) => {
                  const rendered = renderMarkdown(doc.savedContent, doc.path);
                  return { ...doc, content: doc.savedContent, html: rendered.html, headings: rendered.headings, dirty: false };
                })}
                onToggleEdit={() => paneDoc && toggleDocumentEdit(paneDoc.id)}
                onReveal={() => paneDoc && api.revealFile(paneDoc.path)}
                onCopyPath={() => paneDoc && api.writeClipboard(paneDoc.path)}
                onPrint={() => api.print()}
                onPdf={() => api.printPdf()}
                onPreviewClick={handlePreviewClick}
              />
            );
          })}
        </section>
      </main>

      <footer className="statusbar">
        <span>{status}</span>
        {activeDoc && <span>{activeDoc.path}</span>}
      </footer>
    </div>
  );
}

function Pane({
  pane,
  doc,
  docsById,
  zoom,
  theme,
  isActive,
  canCloseEmptyPane,
  onActivatePane,
  onActivateTab,
  onCloseTab,
  onCloseEmptyPane,
  onOpenDialog,
  onChangeDocument,
  onReload,
  onSave,
  onRevert,
  onToggleEdit,
  onReveal,
  onCopyPath,
  onPrint,
  onPdf,
  onPreviewClick
}) {
  const paneRef = useRef(null);

  useEffect(() => {
    if (!doc || doc.isEditing) return undefined;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const nodes = paneRef.current?.querySelectorAll('.markdown-preview .mermaid:not([data-processed])');
      if (!nodes?.length) return;

      loadMermaid().then((mermaid) => {
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: MERMAID_THEME_BY_APP_THEME[theme],
          themeVariables: MERMAID_THEME_VARIABLES
        });
        mermaid.run({ nodes, suppressErrors: true }).catch((error) => {
          console.error('Mermaid render failed', error);
        });
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [doc, doc?.html, doc?.isEditing, theme]);

  return (
    <div ref={paneRef} className={`pane ${isActive ? 'is-active' : ''}`} onMouseDown={onActivatePane}>
      <div className="tabbar">
        <div className="tabs">
          {pane.tabs.map((docId) => {
            const tabDoc = docsById.get(docId);
            if (!tabDoc) return null;
            return (
              <button
                key={docId}
                className={`tab ${pane.activeId === docId ? 'is-active' : ''}`}
                type="button"
                onClick={() => onActivateTab(docId)}
                title={tabDoc.path}
              >
                <span>{tabDoc.name}</span>
                {tabDoc.dirty && <i aria-label="Unsaved" />}
                <X
                  size={14}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(docId);
                  }}
                />
              </button>
            );
          })}
        </div>
        <div className="pane-buttons">
          <button className="new-tab-button" type="button" title="Open Markdown" onClick={onOpenDialog}>
            <FilePlus2 size={17} />
          </button>
          {canCloseEmptyPane && (
            <button className="new-tab-button" type="button" title="Close Empty Pane" onClick={onCloseEmptyPane}>
              <X size={17} />
            </button>
          )}
        </div>
      </div>

      {doc ? (
        <>
          <div className="document-toolbar">
            <div className="document-title">
              <strong>{doc.name}</strong>
              {doc.dirty && <span>Unsaved</span>}
              {doc.externalChanged && <span className="warn">External change</span>}
              {doc.deleted && <span className="warn">Deleted</span>}
            </div>
            <div className="document-actions">
              {doc.externalChanged && (
                <button type="button" onClick={() => onReload(true)}>
                  <RotateCcw size={16} />
                  Reload
                </button>
              )}
              <button type="button" onClick={onToggleEdit}>
                {doc.isEditing ? <Check size={16} /> : <Edit3 size={16} />}
                {doc.isEditing ? 'View' : 'Edit'}
              </button>
              <button type="button" disabled={!doc.dirty} onClick={onSave}>
                <Save size={16} />
                Save
              </button>
              <button type="button" disabled={!doc.dirty} onClick={onRevert}>
                <RotateCcw size={16} />
                Revert
              </button>
              <button type="button" onClick={onReveal} title="Reveal in Files">
                <ExternalLink size={16} />
              </button>
              <button type="button" onClick={onCopyPath} title="Copy Path">
                <Copy size={16} />
              </button>
              <button type="button" onClick={onPrint} title="Print">
                <Printer size={16} />
              </button>
              <button type="button" onClick={onPdf} title="Export PDF">
                <Download size={16} />
              </button>
            </div>
          </div>

          {doc.error && <div className="error-banner">{doc.error}</div>}

          <div className="document-body" style={{ '--preview-zoom': zoom }}>
            {doc.isEditing ? (
              <textarea
                className="editor"
                value={doc.content}
                spellCheck="false"
                onChange={(event) => onChangeDocument(doc.id, event.target.value)}
              />
            ) : (
              <article
                key={`${doc.id}:${theme}:${doc.html.length}`}
                className="markdown-preview"
                onClick={(event) => onPreviewClick(event, doc)}
                dangerouslySetInnerHTML={{ __html: doc.html }}
              />
            )}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <BookOpen size={46} />
          <h1>Markdown Viewer</h1>
          <button type="button" onClick={onOpenDialog}>
            <FolderOpen size={18} />
            Open Markdown
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
