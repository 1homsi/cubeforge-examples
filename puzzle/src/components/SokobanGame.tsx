import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
export const CELL = 48

const COLORS = {
  wall:        '#1a1f33',
  floor:       '#151825',
  target:      '#2a3a2a',
  box:         '#e6a23c',
  boxOnTarget: '#67c23a',
  player:      '#4fc3f7',
} as const

// ─── Tile types ──────────────────────────────────────────────────────────────
type Tile = 'W' | '.' | 'T'

export interface LevelDef {
  width:  number
  height: number
  grid:   Tile[]
  boxes:  { x: number; y: number }[]
  player: { x: number; y: number }
}

// ─── Level data ──────────────────────────────────────────────────────────────
// W=wall .=floor T=target B=box P=player
// Every level is hand-tested to be solvable.

const RAW_LEVELS: string[][] = [
  // Level 1 — 5x5, 1 box (tutorial)
  [
    'WWWWW',
    'W..TW',
    'W.B.W',
    'WP..W',
    'WWWWW',
  ],
  // Level 2 — 6x5, 1 box (longer push)
  [
    'WWWWWW',
    'WP...W',
    'W.B..W',
    'W...TW',
    'WWWWWW',
  ],
  // Level 3 — 6x6, 2 boxes
  [
    'WWWWWW',
    'W....W',
    'W.BT.W',
    'W.TB.W',
    'WP...W',
    'WWWWWW',
  ],
  // Level 4 — 7x5, 2 boxes with a wall obstacle
  [
    'WWWWWWW',
    'WT.B..W',
    'W..W..W',
    'WT.B.PW',
    'WWWWWWW',
  ],
  // Level 5 — 7x6, 2 boxes, L-shaped room
  [
    'WWWWWWW',
    'W.....W',
    'W.BWB.W',
    'W..W..W',
    'WP.T.TW',
    'WWWWWWW',
  ],
  // Level 6 — 7x7, 3 boxes
  [
    'WWWWWWW',
    'W.....W',
    'W.B.B.W',
    'W..W..W',
    'W.B...W',
    'WPT.TTW',
    'WWWWWWW',
  ],
  // Level 7 — 8x6, 3 boxes, corridors
  [
    'WWWWWWWW',
    'WT....TW',
    'W.WBW..W',
    'W..B...W',
    'W.PB..TW',
    'WWWWWWWW',
  ],
  // Level 8 — 8x7, 4 boxes
  [
    'WWWWWWWW',
    'W......W',
    'W.B.B..W',
    'W..WW..W',
    'W.B.B..W',
    'WP.TTTTW',
    'WWWWWWWW',
  ],
  // Level 9 — 9x7, 4 boxes, more walls
  [
    'WWWWWWWWW',
    'W.......W',
    'W.BWB.W.W',
    'W...W...W',
    'W.B.W.B.W',
    'WP.TT.TTW',
    'WWWWWWWWW',
  ],
  // Level 10 — 9x8, 5 boxes
  [
    'WWWWWWWWW',
    'W.......W',
    'W.B.B.B.W',
    'W..W.W..W',
    'W...B...W',
    'W..B....W',
    'WPTTTTTPW',
    'WWWWWWWWW',
  ],
]

function parseLevel(raw: string[]): LevelDef {
  const height = raw.length
  const width  = raw[0].length
  const grid:  Tile[] = []
  const boxes: { x: number; y: number }[] = []
  let player = { x: 0, y: 0 }

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const ch = raw[r][c]
      if (ch === 'W')      { grid.push('W') }
      else if (ch === 'T') { grid.push('T') }
      else if (ch === 'B') { grid.push('.'); boxes.push({ x: c, y: r }) }
      else if (ch === 'X') { grid.push('T'); boxes.push({ x: c, y: r }) }
      else if (ch === 'P') { grid.push('.'); player = { x: c, y: r } }
      else                 { grid.push('.') }
    }
  }
  return { width, height, grid, boxes, player }
}

export const LEVELS: LevelDef[] = RAW_LEVELS.map(parseLevel)

// ─── Game state ──────────────────────────────────────────────────────────────
export interface SokobanState {
  level:     number
  cols:      number
  rows:      number
  grid:      Tile[]
  boxes:     { x: number; y: number }[]
  player:    { x: number; y: number }
  moves:     number
  complete:  boolean
}

export type SokobanEvents = {
  onStateChange: ((state: SokobanState) => void) | null
}

export const sokobanEvents: SokobanEvents = { onStateChange: null }

function createState(levelIdx: number): SokobanState {
  const def = LEVELS[levelIdx]
  return {
    level:    levelIdx,
    cols:     def.width,
    rows:     def.height,
    grid:     [...def.grid],
    boxes:    def.boxes.map(b => ({ ...b })),
    player:   { ...def.player },
    moves:    0,
    complete: false,
  }
}

// ─── Canvas dimensions helper ────────────────────────────────────────────────
export function canvasSize(levelIdx: number) {
  const def = LEVELS[levelIdx]
  return { w: def.width * CELL, h: def.height * CELL }
}

// ─── Manager entity (Script-driven logic) ────────────────────────────────────
const stateMap = new Map<EntityId, SokobanState>()
let currentLevel = 0
let pendingRestart = false
let pendingNextLevel = false

export function setLevel(idx: number) {
  currentLevel = idx
  pendingRestart = true
}

export function restartLevel() {
  pendingRestart = true
}

export function nextLevel() {
  pendingNextLevel = true
}

// Debounce key repeats
let keyLock: Record<string, boolean> = {}

function managerInit(id: EntityId) {
  const state = createState(currentLevel)
  stateMap.set(id, state)
  keyLock = {}
  sokobanEvents.onStateChange?.(state)
}

function managerUpdate(id: EntityId, world: ECSWorld, input: InputManager, _dt: number) {
  if (!world.hasEntity(id)) return
  const state = stateMap.get(id)
  if (!state) return

  if (pendingRestart) {
    pendingRestart = false
    const fresh = createState(currentLevel)
    stateMap.set(id, fresh)
    keyLock = {}
    sokobanEvents.onStateChange?.(fresh)
    return
  }
  if (pendingNextLevel) {
    pendingNextLevel = false
    if (currentLevel < LEVELS.length - 1) {
      currentLevel++
      const fresh = createState(currentLevel)
      stateMap.set(id, fresh)
      keyLock = {}
      sokobanEvents.onStateChange?.(fresh)
    }
    return
  }

  if (state.complete) return

  // R to restart
  if (input.isDown('KeyR')) {
    if (!keyLock['KeyR']) {
      keyLock['KeyR'] = true
      pendingRestart = true
    }
  } else {
    keyLock['KeyR'] = false
  }

  const dirs: { key: string; dx: number; dy: number }[] = [
    { key: 'ArrowUp',    dx:  0, dy: -1 },
    { key: 'ArrowDown',  dx:  0, dy:  1 },
    { key: 'ArrowLeft',  dx: -1, dy:  0 },
    { key: 'ArrowRight', dx:  1, dy:  0 },
  ]

  for (const { key, dx, dy } of dirs) {
    if (input.isDown(key)) {
      if (keyLock[key]) continue
      keyLock[key] = true

      const nx = state.player.x + dx
      const ny = state.player.y + dy

      if (!inBounds(nx, ny, state) || tileAt(nx, ny, state) === 'W') continue

      const boxIdx = state.boxes.findIndex(b => b.x === nx && b.y === ny)
      if (boxIdx >= 0) {
        const bx = nx + dx
        const by = ny + dy
        if (!inBounds(bx, by, state) || tileAt(bx, by, state) === 'W') continue
        if (state.boxes.some(b => b.x === bx && b.y === by)) continue
        state.boxes[boxIdx].x = bx
        state.boxes[boxIdx].y = by
      }

      state.player.x = nx
      state.player.y = ny
      state.moves++

      const allOnTarget = state.boxes.every(b =>
        state.grid[b.y * state.cols + b.x] === 'T'
      )
      if (allOnTarget) state.complete = true

      sokobanEvents.onStateChange?.(state)
    } else {
      keyLock[key] = false
    }
  }
}

function inBounds(x: number, y: number, state: SokobanState): boolean {
  return x >= 0 && x < state.cols && y >= 0 && y < state.rows
}

function tileAt(x: number, y: number, state: SokobanState): Tile {
  return state.grid[y * state.cols + x]
}

// ─── Exported components ─────────────────────────────────────────────────────

export function SokobanManager() {
  return (
    <Entity id="sokoban-manager">
      <Transform x={0} y={0} />
      <Script init={managerInit} update={managerUpdate} />
    </Entity>
  )
}

export function GridTiles({ state }: { state: SokobanState }) {
  const tiles: JSX.Element[] = []
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const t = state.grid[r * state.cols + c]
      let color = COLORS.floor
      if (t === 'W') color = COLORS.wall
      else if (t === 'T') color = COLORS.target

      tiles.push(
        <Entity key={`tile-${r}-${c}`}>
          <Transform x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} />
          <Sprite width={CELL} height={CELL} color={color} zIndex={0} />
        </Entity>
      )
    }
  }
  return <>{tiles}</>
}

export function TargetMarkers({ state }: { state: SokobanState }) {
  const markers: JSX.Element[] = []
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.grid[r * state.cols + c] === 'T') {
        markers.push(
          <Entity key={`target-${r}-${c}`}>
            <Transform x={c * CELL + CELL / 2} y={r * CELL + CELL / 2} />
            <Sprite width={16} height={16} color="#3d5c3d" zIndex={1} />
          </Entity>
        )
      }
    }
  }
  return <>{markers}</>
}

export function Boxes({ state }: { state: SokobanState }) {
  return (
    <>
      {state.boxes.map((b, i) => {
        const onTarget = state.grid[b.y * state.cols + b.x] === 'T'
        return (
          <Entity key={`box-${i}`}>
            <Transform x={b.x * CELL + CELL / 2} y={b.y * CELL + CELL / 2} />
            <Sprite
              width={CELL - 6}
              height={CELL - 6}
              color={onTarget ? COLORS.boxOnTarget : COLORS.box}
              zIndex={5}
            />
          </Entity>
        )
      })}
    </>
  )
}

export function PlayerEntity({ state }: { state: SokobanState }) {
  return (
    <Entity id="sokoban-player" tags={['player']}>
      <Transform
        x={state.player.x * CELL + CELL / 2}
        y={state.player.y * CELL + CELL / 2}
      />
      <Sprite width={CELL - 10} height={CELL - 10} color={COLORS.player} zIndex={10} />
    </Entity>
  )
}
