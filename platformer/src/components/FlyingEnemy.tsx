import { Entity, Transform, AnimatedSprite, Script } from '@cubeforge/react'
import { defineAnimations } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, SpriteComponent } from '@cubeforge/react'

// bat.png: 64×96 — 2 cols × 3 rows of 32×32 = 6 frames
const flyingAnims = defineAnimations({
  fly: { frames: [0, 1, 2, 3, 4, 5], fps: 10 },
})

interface FlyingState {
  x:          number
  baseY:      number
  direction:  1 | -1
  leftBound:  number
  rightBound: number
  phase:      number
}

const flyingStates = new Map<EntityId, FlyingState>()

function flyingInit(id: EntityId, x: number, y: number, left: number, right: number) {
  flyingStates.set(id, {
    x, baseY: y,
    direction: 1,
    leftBound: left,
    rightBound: right,
    phase: Math.random() * Math.PI * 2,
  })
}

const FLYING_SPEED = 100

function flyingUpdate(id: EntityId, world: ECSWorld, _input: unknown, dt: number) {
  if (!world.hasEntity(id)) return
  const state = flyingStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!

  state.x     += FLYING_SPEED * state.direction * dt
  state.phase += dt * 2.5

  if (state.x >= state.rightBound) { state.x = state.rightBound; state.direction = -1 }
  if (state.x <= state.leftBound)  { state.x = state.leftBound;  state.direction =  1 }

  transform.x  = state.x
  transform.y  = state.baseY + Math.sin(state.phase) * 20
  sprite.flipX = state.direction === -1
}

interface FlyingEnemyProps {
  x?:           number
  y?:           number
  patrolLeft?:  number
  patrolRight?: number
  color?:       string
}

export function FlyingEnemy({
  x = 400, y = 300,
  patrolLeft, patrolRight,
}: FlyingEnemyProps) {
  const left  = patrolLeft  ?? x - 130
  const right = patrolRight ?? x + 130

  return (
    // No RigidBody — Script drives position directly; player detects via findByTag + distance
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <AnimatedSprite
        src="/bat.png"
        frameWidth={32} frameHeight={32} frameColumns={2}
        width={32} height={32}
        zIndex={10}
        animations={flyingAnims}
        current="fly"
      />
      <Script
        init={(id) => flyingInit(id, x, y, left, right)}
        update={flyingUpdate}
      />
    </Entity>
  )
}
