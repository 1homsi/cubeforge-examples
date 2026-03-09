import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { Game, World, Camera2D, Entity, Transform, Sprite } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 50
const ROWS = 50
const CELL = 12
const W = COLS * CELL   // 600
const H = ROWS * CELL   // 600

type Grid = boolean[][]
type GameState = 'editing' | 'running'

// ─── Helpers ────────────────────────────────────────────────────────────────
function emptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(false))
}

function countNeighbors(grid: Grid, r: number, c: number): number {
  let count = 0
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = (r + dr + ROWS) % ROWS
      const nc = (c + dc + COLS) % COLS
      if (grid[nr][nc]) count++
    }
  }
  return count
}

function step(grid: Grid): Grid {
  return grid.map((row, r) =>
    row.map((cell, c) => {
      const n = countNeighbors(grid, r, c)
      if (cell) return n === 2 || n === 3
      return n === 3
    })
  )
}

function countAlive(grid: Grid): number {
  let count = 0
  for (const row of grid) for (const cell of row) if (cell) count++
  return count
}

// ─── Presets ────────────────────────────────────────────────────────────────
type Preset = { name: string; cells: [number, number][] }

const PRESETS: Preset[] = [
  {
    name: 'Glider',
    cells: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  },
  {
    name: 'Blinker',
    cells: [[0,0],[0,1],[0,2]],
  },
  {
    name: 'Pulsar',
    cells: (() => {
      const cells: [number, number][] = []
      const pattern = [
        [0,2],[0,3],[0,4],[0,8],[0,9],[0,10],
        [2,0],[2,5],[2,7],[2,12],
        [3,0],[3,5],[3,7],[3,12],
        [4,0],[4,5],[4,7],[4,12],
        [5,2],[5,3],[5,4],[5,8],[5,9],[5,10],
        [7,2],[7,3],[7,4],[7,8],[7,9],[7,10],
        [8,0],[8,5],[8,7],[8,12],
        [9,0],[9,5],[9,7],[9,12],
        [10,0],[10,5],[10,7],[10,12],
        [12,2],[12,3],[12,4],[12,8],[12,9],[12,10],
      ]
      pattern.forEach(([r,c]) => cells.push([r, c]))
      return cells
    })(),
  },
  {
    name: 'Glider Gun',
    cells: [
      [0,24],
      [1,22],[1,24],
      [2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
      [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],
      [4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
      [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],
      [6,10],[6,16],[6,24],
      [7,11],[7,15],
      [8,12],[8,13],
    ],
  },
  {
    name: 'Random',
    cells: [], // Special: fill randomly
  },
]

// ─── App ────────────────────────────────────────────────────────────────────
export function App() {
  const [gameKey, setGameKey] = useState(0)
  const [generation, setGeneration] = useState(0)
  const [alive, setAlive] = useState(0)
  const [gameState, setGameState] = useState<GameState>('editing')
  const [speed, setSpeed] = useState(100)

  const gridRef = useRef<Grid>(emptyGrid())
  const mouseDownRef = useRef(false)
  const drawModeRef = useRef(true) // true = draw, false = erase

  const [, forceRender] = useReducer(n => n + 1, 0)

  // Simulation loop
  useEffect(() => {
    if (gameState !== 'running') return
    const id = setInterval(() => {
      gridRef.current = step(gridRef.current)
      setGeneration(g => g + 1)
      setAlive(countAlive(gridRef.current))
      forceRender()
    }, speed)
    return () => clearInterval(id)
  }, [gameState, speed])

  const toggleCell = useCallback((r: number, c: number) => {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return
    if (mouseDownRef.current) {
      gridRef.current[r][c] = drawModeRef.current
    } else {
      gridRef.current[r][c] = !gridRef.current[r][c]
    }
    setAlive(countAlive(gridRef.current))
    forceRender()
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const c = Math.floor((e.clientX - rect.left) / CELL)
    const r = Math.floor((e.clientY - rect.top) / CELL)
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      mouseDownRef.current = true
      drawModeRef.current = !gridRef.current[r][c]
      toggleCell(r, c)
    }
  }, [toggleCell])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseDownRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const c = Math.floor((e.clientX - rect.left) / CELL)
    const r = Math.floor((e.clientY - rect.top) / CELL)
    toggleCell(r, c)
  }, [toggleCell])

  const handleMouseUp = useCallback(() => { mouseDownRef.current = false }, [])

  const doStep = useCallback(() => {
    gridRef.current = step(gridRef.current)
    setGeneration(g => g + 1)
    setAlive(countAlive(gridRef.current))
    forceRender()
  }, [])

  const clearGrid = useCallback(() => {
    gridRef.current = emptyGrid()
    setGeneration(0)
    setAlive(0)
    setGameState('editing')
    forceRender()
  }, [])

  const loadPreset = useCallback((preset: Preset) => {
    const grid = emptyGrid()
    if (preset.name === 'Random') {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          grid[r][c] = Math.random() < 0.3
    } else {
      const offsetR = Math.floor(ROWS / 2 - 6)
      const offsetC = Math.floor(COLS / 2 - 6)
      preset.cells.forEach(([r, c]) => {
        const nr = r + offsetR
        const nc = c + offsetC
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          grid[nr][nc] = true
        }
      })
    }
    gridRef.current = grid
    setGeneration(0)
    setAlive(countAlive(grid))
    setGameState('editing')
    setGameKey(k => k + 1)
  }, [])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setGameState(s => s === 'running' ? 'editing' : 'running')
      }
      if (e.code === 'KeyN') doStep()
      if (e.code === 'KeyC') clearGrid()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doStep, clearGrid])

  const grid = gridRef.current

  // Collect alive cells for rendering
  const aliveCells: { r: number; c: number }[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c]) aliveCells.push({ r, c })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      {/* HUD */}
      <div style={{
        width: W, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center',
        padding: '7px 18px', background: '#0d0f1a', borderRadius: '10px 10px 0 0',
        fontSize: 13, color: '#90a4ae', letterSpacing: 1, userSelect: 'none',
      }}>
        <div style={{ fontSize: 11, color: '#607d8b' }}>
          GEN {generation} &nbsp;&middot;&nbsp; POP {alive}
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{
            color: gameState === 'running' ? '#69f0ae' : '#fdd835',
            fontWeight: 700, fontSize: 14, letterSpacing: 3,
          }}>
            {gameState === 'running' ? 'RUNNING' : 'EDITING'}
          </span>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#607d8b' }}>GAME OF LIFE</div>
      </div>

      {/* Toolbar */}
      <div style={{
        width: W, background: '#111620', display: 'flex', alignItems: 'center',
        gap: 6, padding: '5px 12px', flexWrap: 'wrap',
      }}>
        <button onClick={() => setGameState(s => s === 'running' ? 'editing' : 'running')} style={toolBtnStyle}>
          {gameState === 'running' ? 'Pause' : 'Play'}
        </button>
        <button onClick={doStep} disabled={gameState === 'running'} style={toolBtnStyle}>Step</button>
        <button onClick={clearGrid} style={toolBtnStyle}>Clear</button>
        <span style={{ color: '#37474f', fontSize: 10 }}>|</span>
        {PRESETS.map(p => (
          <button key={p.name} onClick={() => loadPreset(p)} style={toolBtnStyle}>{p.name}</button>
        ))}
        <span style={{ color: '#37474f', fontSize: 10 }}>|</span>
        <span style={{ color: '#546e7a', fontSize: 10, marginLeft: 4 }}>Speed:</span>
        <input
          type="range" min={20} max={500} step={10} value={500 - speed + 20}
          onChange={e => setSpeed(500 - parseInt(e.target.value) + 20)}
          style={{ width: 60, accentColor: '#4fc3f7' }}
        />
      </div>

      {/* Game */}
      <div
        style={{ position: 'relative', width: W, height: H, cursor: 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Game key={gameKey} width={W} height={H} gravity={0}>
          <World background="#0a0c14">
            <Camera2D x={W / 2} y={H / 2} background="#0a0c14" />

            {/* Grid lines (sparse) */}
            {Array.from({ length: COLS + 1 }, (_, i) => i % 5 === 0 ? (
              <Entity key={`gv${i}`} tags={['grid']}>
                <Transform x={i * CELL} y={H / 2} />
                <Sprite width={1} height={H} color="#111820" zIndex={0} />
              </Entity>
            ) : null)}
            {Array.from({ length: ROWS + 1 }, (_, i) => i % 5 === 0 ? (
              <Entity key={`gh${i}`} tags={['grid']}>
                <Transform x={W / 2} y={i * CELL} />
                <Sprite width={W} height={1} color="#111820" zIndex={0} />
              </Entity>
            ) : null)}

            {/* Alive cells */}
            {aliveCells.map(({ r, c }) => (
              <Entity key={`cell${r}-${c}`} tags={['cell']}>
                <Transform x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} />
                <Sprite width={CELL - 1} height={CELL - 1} color="#4fc3f7" zIndex={2} />
              </Entity>
            ))}
          </World>
        </Game>
      </div>

      {/* Controls */}
      <div style={{
        width: W, background: '#0d0f1a', borderRadius: '0 0 10px 10px',
        padding: '6px 18px', fontSize: 11, color: '#37474f', letterSpacing: 1.5,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Click/drag to draw &nbsp;&middot;&nbsp; Space play/pause &nbsp;&middot;&nbsp; N step &nbsp;&middot;&nbsp; C clear</span>
        <span style={{ color: '#263238' }}>Cubeforge Engine</span>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const toolBtnStyle: React.CSSProperties = {
  padding: '3px 10px',
  background: '#1a1f2e',
  border: '1px solid #1e2535',
  borderRadius: 4,
  color: '#90a4ae',
  fontFamily: '"Courier New", monospace',
  fontSize: 11,
  cursor: 'pointer',
  letterSpacing: 1,
}
