import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

// ─── Constants ────────────────────────────────────────────────────────────────
export const CELL = 48
export const GRID_W = 9
export const GRID_H = 9

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

// ─── Seeded RNG ──────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Procedural level generator ──────────────────────────────────────────────
// Strategy: generate a room with inner walls, place boxes on targets,
// then "reverse-play" random pulls to scatter boxes away from targets.
// This guarantees every generated level is solvable.

export function generateLevel(levelNum: number): LevelDef {
  const rng = mulberry32(levelNum * 7919 + 31)
  const w = GRID_W
  const h = GRID_H
  const grid: Tile[] = new Array(w * h).fill('.')

  const idx = (x: number, y: number) => y * w + x

  // Border walls
  for (let x = 0; x < w; x++) {
    grid[idx(x, 0)] = 'W'
    grid[idx(x, h - 1)] = 'W'
  }
  for (let y = 0; y < h; y++) {
    grid[idx(0, y)] = 'W'
    grid[idx(w - 1, y)] = 'W'
  }

  // Inner walls — scale with level number (2 + level, capped)
  const numInnerWalls = Math.min(2 + levelNum, 10)
  let placed = 0
  for (let attempt = 0; attempt < 200 && placed < numInnerWalls; attempt++) {
    const wx = 2 + Math.floor(rng() * (w - 4))
    const wy = 2 + Math.floor(rng() * (h - 4))
    if (grid[idx(wx, wy)] === '.') {
      grid[idx(wx, wy)] = 'W'
      // Ensure we haven't walled off large sections — check connectivity later
      placed++
    }
  }

  // Collect all floor cells
  const floors: { x: number; y: number }[] = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (grid[idx(x, y)] === '.') floors.push({ x, y })
    }
  }

  // Check flood-fill connectivity — if not connected, remove random inner walls
  function floodFill(start: { x: number; y: number }): Set<string> {
    const visited = new Set<string>()
    const stack = [start]
    while (stack.length > 0) {
      const { x, y } = stack.pop()!
      const key = `${x},${y}`
      if (visited.has(key)) continue
      if (x < 0 || x >= w || y < 0 || y >= h) continue
      if (grid[idx(x, y)] === 'W') continue
      visited.add(key)
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
    }
    return visited
  }

  // Ensure connectivity
  if (floors.length > 0) {
    let connected = floodFill(floors[0])
    let safety = 0
    while (connected.size < floors.length && safety < 20) {
      // Find a disconnected floor and remove a nearby wall
      for (const f of floors) {
        if (!connected.has(`${f.x},${f.y}`)) {
          // Remove a wall adjacent to this floor cell that borders the connected region
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]]
          for (const [dx, dy] of dirs) {
            const nx = f.x + dx
            const ny = f.y + dy
            if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[idx(nx, ny)] === 'W') {
              grid[idx(nx, ny)] = '.'
              floors.push({ x: nx, y: ny })
              break
            }
          }
          break
        }
      }
      connected = floodFill(floors[0])
      safety++
    }
  }

  // Rebuild floors list after wall removals
  const validFloors: { x: number; y: number }[] = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (grid[idx(x, y)] === '.') validFloors.push({ x, y })
    }
  }

  // Shuffle helper
  function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  // Number of boxes scales with level
  const numBoxes = Math.min(1 + Math.floor(levelNum / 2), 5)

  // Pick target positions (must have at least 2 open neighbors for pull-ability)
  shuffle(validFloors)
  const targets: { x: number; y: number }[] = []
  for (const f of validFloors) {
    if (targets.length >= numBoxes) break
    // Must have at least 2 non-wall neighbors
    let openNeighbors = 0
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      if (grid[idx(f.x + dx, f.y + dy)] !== 'W') openNeighbors++
    }
    if (openNeighbors >= 2) {
      targets.push({ x: f.x, y: f.y })
    }
  }

  // Mark targets on grid
  for (const t of targets) {
    grid[idx(t.x, t.y)] = 'T'
  }

  // Start boxes on targets, then reverse-play to scatter them
  const boxes = targets.map(t => ({ x: t.x, y: t.y }))
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const

  // Reverse moves: "pull" a box = move player to the far side and pull box back
  const pullCount = 8 + levelNum * 6
  for (let i = 0; i < pullCount; i++) {
    const bi = Math.floor(rng() * boxes.length)
    const box = boxes[bi]
    const di = Math.floor(rng() * 4)
    const [dx, dy] = dirs[di]

    // Pull direction: box moves opposite to (dx,dy), player was at box+(dx,dy) and moves to box+2*(dx,dy)
    const newBx = box.x - dx
    const newBy = box.y - dy
    const playerNeed = { x: box.x + dx, y: box.y + dy }

    // Validate: new box pos is floor, player position is floor, no other box there
    if (newBx < 1 || newBx >= w - 1 || newBy < 1 || newBy >= h - 1) continue
    if (playerNeed.x < 1 || playerNeed.x >= w - 1 || playerNeed.y < 1 || playerNeed.y >= h - 1) continue
    const newBTile = grid[idx(newBx, newBy)]
    const playerTile = grid[idx(playerNeed.x, playerNeed.y)]
    if (newBTile === 'W' || playerTile === 'W') continue
    if (boxes.some((b, j) => j !== bi && b.x === newBx && b.y === newBy)) continue
    if (boxes.some((b, j) => j !== bi && b.x === playerNeed.x && b.y === playerNeed.y)) continue

    box.x = newBx
    box.y = newBy
  }

  // Place player — find a floor cell not occupied by a box or target
  let player = { x: 1, y: 1 }
  shuffle(validFloors)
  for (const f of validFloors) {
    const t = grid[idx(f.x, f.y)]
    if (t === 'W') continue
    if (boxes.some(b => b.x === f.x && b.y === f.y)) continue
    player = { x: f.x, y: f.y }
    break
  }

  return { width: w, height: h, grid, boxes, player }
}

// Keep one generated level cached per level number
const levelCache = new Map<number, LevelDef>()

export function getLevel(levelNum: number): LevelDef {
  if (!levelCache.has(levelNum)) {
    levelCache.set(levelNum, generateLevel(levelNum))
  }
  return levelCache.get(levelNum)!
}

export function clearLevelCache(levelNum: number) {
  levelCache.delete(levelNum)
}

// ─── Canvas dimensions helper ────────────────────────────────────────────────
export function canvasSize() {
  return { w: GRID_W * CELL, h: GRID_H * CELL }
}

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
  const def = getLevel(levelIdx)
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

export function regenerateLevel(levelNum: number) {
  clearLevelCache(levelNum)
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
    currentLevel++
    const fresh = createState(currentLevel)
    stateMap.set(id, fresh)
    keyLock = {}
    sokobanEvents.onStateChange?.(fresh)
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
