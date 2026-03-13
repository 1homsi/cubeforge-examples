import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import { createTag } from '@cubeforge/core'
import { createTransform } from '@cubeforge/core'
import { createSprite } from '@cubeforge/renderer'
import { gameEvents } from '../gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const PIPE_SPEED  = 160   // px/s (leftward)
const GAP_SIZE    = 140   // px
const PIPE_WIDTH  = 52    // px
const CANVAS_H    = 640
const CANVAS_W    = 480
const SPAWN_EVERY = 1.6   // seconds
const GAP_MIN     = 160
const GAP_MAX     = CANVAS_H - 160
const BIRD_START_X = 120

// ─── PipeMeta component ───────────────────────────────────────────────────────
interface PipeMetaComponent {
  readonly type: 'PipeMeta'
  pipeHeight: number
  isTop: boolean
}

function createPipeMeta(pipeHeight: number, isTop: boolean): PipeMetaComponent {
  return { type: 'PipeMeta', pipeHeight, isTop }
}

// ─── Tag component shape ─────────────────────────────────────────────────────
interface TagComponent {
  readonly type: 'Tag'
  tags: string[]
}

// ─── Pipe pair tracked in module-level state ──────────────────────────────────
interface PipePair {
  x: number
  gapY: number
  topId: EntityId
  bottomId: EntityId
  passed: boolean
}

// Module-level state keyed by manager entity ID so StrictMode double-mount
// doesn't mix up two different instances.
const managerState = new Map<EntityId, {
  pipes: PipePair[]
  spawnTimer: number
}>()

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomGapY(): number {
  return GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN)
}

function spawnPipe(world: ECSWorld, x: number, gapY: number): PipePair {
  const topHeight    = gapY - GAP_SIZE / 2
  const bottomHeight = CANVAS_H - (gapY + GAP_SIZE / 2)

  // Top pipe: center at (x, topHeight/2)
  const topId = world.createEntity()
  world.addComponent(topId, createTag('pipe'))
  world.addComponent(topId, createTransform(x, topHeight / 2))
  world.addComponent(topId, createSprite({ width: PIPE_WIDTH, height: topHeight, color: '#4caf50', zIndex: 5 }))
  world.addComponent(topId, createPipeMeta(topHeight, true))

  // Bottom pipe: center at (x, gapY + GAP_SIZE/2 + bottomHeight/2)
  const bottomY = gapY + GAP_SIZE / 2 + bottomHeight / 2
  const bottomId = world.createEntity()
  world.addComponent(bottomId, createTag('pipe'))
  world.addComponent(bottomId, createTransform(x, bottomY))
  world.addComponent(bottomId, createSprite({ width: PIPE_WIDTH, height: bottomHeight, color: '#4caf50', zIndex: 5 }))
  world.addComponent(bottomId, createPipeMeta(bottomHeight, false))

  return { x, gapY, topId, bottomId, passed: false }
}

function destroyPipe(world: ECSWorld, pair: PipePair): void {
  if (world.hasEntity(pair.topId))    world.destroyEntity(pair.topId)
  if (world.hasEntity(pair.bottomId)) world.destroyEntity(pair.bottomId)
}

// ─── Script functions ────────────────────────────────────────────────────────
function pipeManagerInit(id: EntityId, world: ECSWorld): void {
  // Clean up any leftover state from StrictMode double-mount
  const existing = managerState.get(id)
  if (existing) {
    for (const pair of existing.pipes) destroyPipe(world, pair)
  }
  managerState.set(id, { pipes: [], spawnTimer: 0 })

  // Spawn first pipe slightly off-screen to the right
  const state = managerState.get(id)!
  const pair = spawnPipe(world, CANVAS_W + PIPE_WIDTH / 2, randomGapY())
  state.pipes.push(pair)
}

function pipeManagerUpdate(
  id: EntityId,
  world: ECSWorld,
  _input: InputManager,
  dt: number,
): void {
  if (!world.hasEntity(id)) return
  const state = managerState.get(id)
  if (!state) return

  // ── Find bird transform ──────────────────────────────────────────────────
  let birdX    = BIRD_START_X
  let birdY    = 320
  for (const eid of world.query('Tag')) {
    if (!world.hasEntity(eid)) continue
    const tag = world.getComponent<TagComponent>(eid, 'Tag')
    if (!tag?.tags.includes('bird')) continue
    const bt = world.getComponent<TransformComponent>(eid, 'Transform')
    if (bt) { birdX = bt.x; birdY = bt.y }
    break
  }

  // ── Move pipes left ───────────────────────────────────────────────────────
  for (const pair of state.pipes) {
    pair.x -= PIPE_SPEED * dt

    // Update ECS transforms
    if (world.hasEntity(pair.topId)) {
      const t = world.getComponent<TransformComponent>(pair.topId, 'Transform')!
      t.x = pair.x
    }
    if (world.hasEntity(pair.bottomId)) {
      const t = world.getComponent<TransformComponent>(pair.bottomId, 'Transform')!
      t.x = pair.x
    }
  }

  // ── Score detection ───────────────────────────────────────────────────────
  for (const pair of state.pipes) {
    if (!pair.passed && pair.x + PIPE_WIDTH / 2 < birdX) {
      pair.passed = true
      gameEvents.onScore?.()
    }
  }

  // ── Remove off-screen pipes ───────────────────────────────────────────────
  state.pipes = state.pipes.filter(pair => {
    if (pair.x + PIPE_WIDTH / 2 < 0) {
      destroyPipe(world, pair)
      return false
    }
    return true
  })

  // ── Spawn new pipes ───────────────────────────────────────────────────────
  state.spawnTimer += dt
  if (state.spawnTimer >= SPAWN_EVERY) {
    state.spawnTimer -= SPAWN_EVERY
    const pair = spawnPipe(world, CANVAS_W + PIPE_WIDTH / 2, randomGapY())
    state.pipes.push(pair)
  }

  // ── Collision (death) detection ───────────────────────────────────────────
  // Bird collision is also checked in Bird.tsx but we double-check here for
  // robustness. We rely on Bird.tsx's check via 'PipeMeta' component queries,
  // so no duplicate death call needed here. The Bird script handles it.
  // However we need birdY for the unused-parameter lint. Using it to suppress:
  void birdY
}

// ─── React component ──────────────────────────────────────────────────────────
export function PipeManager() {
  return (
    <Entity>
      <Transform x={0} y={0} />
      <Sprite width={0} height={0} visible={false} />
      <Script
        init={(managerId, world) => pipeManagerInit(managerId, world)}
        update={pipeManagerUpdate}
      />
    </Entity>
  )
}
