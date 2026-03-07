import { useState, useEffect, useRef, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { compile, buildIframeSrcdoc } from './compiler'
import { TEMPLATES } from './templates'

const DEBOUNCE_MS = 500

type Status = { kind: 'ok' } | { kind: 'building' } | { kind: 'error'; message: string }

function encodeCode(code: string): string {
  return btoa(unescape(encodeURIComponent(code)))
}

function decodeCode(hash: string): string | null {
  try {
    return decodeURIComponent(escape(atob(hash.replace(/^#/, ''))))
  } catch {
    return null
  }
}

function getInitialCode(): { code: string; templateId: string } {
  const hash = window.location.hash
  if (hash && hash.length > 1) {
    const decoded = decodeCode(hash)
    if (decoded) return { code: decoded, templateId: '__custom__' }
  }
  return { code: TEMPLATES[0].code, templateId: TEMPLATES[0].id }
}

// ── Icons ────────────────────────────────────────────────────────────────────

function IconPlay() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <path d="M2 1.5l6 3.5-6 3.5V1.5z" />
    </svg>
  )
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
    </svg>
  )
}

function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8a6 6 0 1 0 1.5-3.9L2 5.5" />
      <path d="M2 2v3.5H5.5" />
    </svg>
  )
}

function IconShare() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 1l4 4-4 4" />
      <path d="M14 5H6a4 4 0 0 0-4 4v2" />
    </svg>
  )
}

function IconGitHub() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 4l-7.5 7.5L2.5 8" />
    </svg>
  )
}

function IconChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4l2.5 2.5L7.5 4" />
    </svg>
  )
}

// ── Template Picker ──────────────────────────────────────────────────────────

function TemplatePicker({
  templateId,
  onChange,
}: {
  templateId: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = TEMPLATES.find(t => t.id === templateId)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="template-picker" ref={ref}>
      <button
        className={`template-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="template-option-icon" style={{ width: 16, height: 16, fontSize: 10, borderRadius: 3, background: 'transparent' }}>
          {current?.icon ?? '📄'}
        </span>
        {current?.label ?? 'Custom'}
        <span className="template-trigger-chevron">
          <IconChevron />
        </span>
      </button>

      {open && (
        <div className="template-dropdown">
          {TEMPLATES.map(t => (
            <div
              key={t.id}
              className={`template-option${t.id === templateId ? ' active' : ''}`}
              onClick={() => { onChange(t.id); setOpen(false) }}
            >
              <div className="template-option-icon">{t.icon}</div>
              <div className="template-option-info">
                <div className="template-option-name">{t.label}</div>
                <div className="template-option-desc">{t.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const label =
    status.kind === 'ok' ? 'READY'
    : status.kind === 'building' ? 'BUILDING'
    : 'ERROR'

  return (
    <div className={`status-badge ${status.kind}`}>
      <span className="status-dot" />
      {label}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

export function App() {
  const initial = getInitialCode()
  const [templateId, setTemplateId] = useState(initial.templateId)
  const [code, setCode] = useState(initial.code)
  const [srcdoc, setSrcdoc] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'building' })
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback((source: string) => {
    setStatus({ kind: 'building' })
    setTimeout(() => {
      const result = compile(source)
      if (result.error !== null) {
        setStatus({ kind: 'error', message: result.error })
      } else {
        setSrcdoc(buildIframeSrcdoc(result.code))
        setStatus({ kind: 'ok' })
      }
    }, 0)
  }, [])

  useEffect(() => { run(initial.code) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => run(code), DEBOUNCE_MS)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [code, run])

  // Cmd+Enter to run immediately
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (debounceRef.current) clearTimeout(debounceRef.current)
        run(code)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [code, run])

  function handleTemplateChange(id: string) {
    const tpl = TEMPLATES.find(t => t.id === id)
    if (!tpl) return
    setTemplateId(id)
    setCode(tpl.code)
    window.location.hash = ''
  }

  function handleEditorMount(_: unknown, monaco: Monaco) {
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    })
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      jsxImportSource: 'react',
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function handleReset() {
    const tpl = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0]
    setCode(tpl.code)
    window.location.hash = ''
  }

  function handleShare() {
    const encoded = encodeCode(code)
    window.location.hash = encoded
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    })
  }

  const currentTemplate = TEMPLATES.find(t => t.id === templateId)

  return (
    <div className="playground">
      {/* ── Toolbar ── */}
      <div className="toolbar">
        {/* Logo */}
        <div className="toolbar-logo">
          <div className="toolbar-logo-mark">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" fill="#0b0d14" />
              <rect x="7" y="1" width="4" height="4" fill="#0b0d14" />
              <rect x="1" y="7" width="4" height="4" fill="#0b0d14" />
              <rect x="7" y="7" width="4" height="4" fill="#0b0d14" />
            </svg>
          </div>
          <span className="toolbar-logo-text">
            cube<span>forge</span>
          </span>
        </div>

        <div className="toolbar-divider" />

        {/* Template picker */}
        <TemplatePicker templateId={templateId} onChange={handleTemplateChange} />

        <div className="toolbar-spacer" />

        {/* Status */}
        <StatusBadge status={status} />

        <div className="toolbar-divider" />

        {/* Icon buttons */}
        <button
          className={`icon-btn${copied ? ' copied' : ''}`}
          onClick={handleCopy}
          title="Copy code"
        >
          {copied ? <IconCheck /> : <IconCopy />}
          <span className="tooltip">Copy code</span>
        </button>

        <button
          className={`icon-btn${shared ? ' copied' : ''}`}
          onClick={handleShare}
          title="Share"
        >
          {shared ? <IconCheck /> : <IconShare />}
          <span className="tooltip">Copy share link</span>
        </button>

        <button
          className="icon-btn danger"
          onClick={handleReset}
          title="Reset to default"
        >
          <IconReset />
          <span className="tooltip">Reset</span>
        </button>

        <div className="toolbar-divider" />

        {/* GitHub */}
        <a
          className="github-link"
          href="https://github.com/1homsi/cubeforge"
          target="_blank"
          rel="noopener noreferrer"
          title="GitHub"
        >
          <IconGitHub />
          <span className="tooltip">GitHub</span>
        </a>

        <div className="toolbar-divider" />

        {/* Run button */}
        <button
          className="run-btn"
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            run(code)
          }}
        >
          <IconPlay />
          RUN
          <span className="run-btn-hint">⌘↵</span>
        </button>
      </div>

      {/* ── Panels ── */}
      <div className="panels">
        {/* Editor panel */}
        <div className="editor-panel">
          <div className="editor-tab-bar">
            <div className="editor-tab active">
              <span className="editor-tab-dot" />
              {currentTemplate?.label ?? 'custom'}.tsx
            </div>
          </div>
          <div className="editor-body">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v ?? '')}
              onMount={handleEditorMount}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 12 },
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontLigatures: true,
                lineHeight: 20,
                renderLineHighlight: 'gutter',
                smoothScrolling: true,
              }}
            />
          </div>
        </div>

        {/* Preview panel */}
        <div className="preview-panel">
          <div className="preview-tab-bar">
            <span>PREVIEW</span>
          </div>
          <div className="preview-body">
            {srcdoc ? (
              <iframe
                key={srcdoc}
                srcDoc={srcdoc}
                sandbox="allow-scripts allow-pointer-lock"
                title="game preview"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block', overflow: 'hidden' }}
              />
            ) : (
              <div className="preview-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Press Run to start</span>
              </div>
            )}
            {status.kind === 'error' && (
              <div className="error-overlay">
                <div className="error-box">{status.message}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
