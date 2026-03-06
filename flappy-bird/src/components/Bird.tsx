import { Entity, Transform, Sprite, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'
import type { SpriteComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAVITY    = 900   // px/s²
const FLAP_FORCE = -320  // px/s (upward)
const BIRD_SIZE  = 24    // px (square)
const PIPE_WIDTH = 52    // must match PipeManager

// ─── Per-entity state ────────────────────────────────────────────────────────
interface BirdState {
  vy: number
  dead: boolean
}

const birdStates = new Map<EntityId, BirdState>()

// ─── PipeMeta stored on pipe entities by PipeManager ─────────────────────────
interface PipeMetaComponent {
  readonly type: 'PipeMeta'
  pipeHeight: number   // full height of this pipe segment
  isTop: boolean
}

// ─── Tag component shape ─────────────────────────────────────────────────────
interface TagComponent {
  readonly type: 'Tag'
  tags: string[]
}

// ─── Script functions ────────────────────────────────────────────────────────
function birdInit(id: EntityId): void {
  birdStates.set(id, { vy: 0, dead: false })
}

function birdUpdate(
  id: EntityId,
  world: ECSWorld,
  input: InputManager,
  dt: number,
): void {
  if (!world.hasEntity(id)) return
  const state = birdStates.get(id)
  if (!state) return
  if (state.dead) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  // 1. Apply gravity
  state.vy += GRAVITY * dt

  // 2. Move
  transform.y += state.vy * dt

  // 3. Flap on Space pressed OR left mouse button pressed
  if (input.isPressed('Space') || input.mouse.isPressed(0)) {
    state.vy = FLAP_FORCE
  }

  // 4. Rotation based on velocity
  transform.rotation = Math.max(-0.4, Math.min(0.8, state.vy / 600))

  // 5. Check ceiling
  if (transform.y < 12) {
    state.dead = true
    sprite.visible = false
    gameEvents.onDeath?.()
    return
  }

  // 6. Check floor
  if (transform.y > 628) {
    state.dead = true
    sprite.visible = false
    gameEvents.onDeath?.()
    return
  }

  // 7. Check pipe collision — query entities tagged 'pipe'
  const birdLeft   = transform.x - BIRD_SIZE / 2
  const birdRight  = transform.x + BIRD_SIZE / 2
  const birdTop    = transform.y - BIRD_SIZE / 2
  const birdBottom = transform.y + BIRD_SIZE / 2

  for (const eid of world.query('Tag')) {
    if (!world.hasEntity(eid)) continue
    const tag = world.getComponent<TagComponent>(eid, 'Tag')
    if (!tag?.tags.includes('pipe')) continue

    const pipeMeta = world.getComponent<PipeMetaComponent>(eid, 'PipeMeta')
    const pipeTransform = world.getComponent<TransformComponent>(eid, 'Transform')
    if (!pipeMeta || !pipeTransform) continue

    // Pipe anchor is center of the sprite, anchorY=0.5
    const pipeLeft   = pipeTransform.x - PIPE_WIDTH / 2
    const pipeRight  = pipeTransform.x + PIPE_WIDTH / 2
    const pipeTop    = pipeTransform.y - pipeMeta.pipeHeight / 2
    const pipeBottom = pipeTransform.y + pipeMeta.pipeHeight / 2

    const overlapX = birdRight > pipeLeft && birdLeft < pipeRight
    const overlapY = birdBottom > pipeTop && birdTop < pipeBottom

    if (overlapX && overlapY) {
      state.dead = true
      sprite.visible = false
      gameEvents.onDeath?.()
      return
    }
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface BirdProps {
  onInit?: (id: EntityId) => void
}

export function Bird({ onInit }: BirdProps) {
  return (
    <Entity tags={['bird']}>
      <Transform x={120} y={320} />
      <Sprite width={BIRD_SIZE} height={BIRD_SIZE} color="#ffd54f" zIndex={10} />
      <Script
        init={(id) => {
          birdInit(id)
          onInit?.(id)
        }}
        update={birdUpdate}
      />
    </Entity>
  )
}
