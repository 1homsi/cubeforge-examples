import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

const SPEED = 220
const JUMP_FORCE = -520
const COYOTE_TIME = 0.1    // seconds after leaving platform where jump is still allowed
const JUMP_BUFFER = 0.08   // seconds a jump press is buffered before landing

interface PlayerState {
  coyoteTimer: number
  jumpBuffer: number
  facingRight: boolean
}

const playerStates = new Map<EntityId, PlayerState>()

function playerInit(entityId: EntityId, world: ECSWorld) {
  playerStates.set(entityId, { coyoteTimer: 0, facingRight: true, jumpBuffer: 0 })
  // Custom data component
  world.addComponent(entityId, { type: '_PlayerState' } as never)
}

function playerUpdate(entityId: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  const transform = world.getComponent<TransformComponent>(entityId, 'Transform')!
  const rb = world.getComponent<RigidBodyComponent>(entityId, 'RigidBody')!
  const sprite = world.getComponent<SpriteComponent>(entityId, 'Sprite')!
  const state = playerStates.get(entityId)!

  // Coyote time
  if (rb.onGround) {
    state.coyoteTimer = COYOTE_TIME
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt)
  }

  // Jump buffer
  const jumpPressed =
    input.isPressed('Space') ||
    input.isPressed('ArrowUp') ||
    input.isPressed('KeyW') ||
    input.isPressed('w')
  if (jumpPressed) state.jumpBuffer = JUMP_BUFFER
  else state.jumpBuffer = Math.max(0, state.jumpBuffer - dt)

  // Horizontal movement
  const left = input.isDown('ArrowLeft') || input.isDown('KeyA') || input.isDown('a')
  const right = input.isDown('ArrowRight') || input.isDown('KeyD') || input.isDown('d')

  if (left) {
    rb.vx = -SPEED
    state.facingRight = false
  } else if (right) {
    rb.vx = SPEED
    state.facingRight = true
  } else {
    // Decelerate when no input
    rb.vx *= rb.onGround ? 0.7 : 0.95
    if (Math.abs(rb.vx) < 1) rb.vx = 0
  }

  // Flip sprite
  sprite.flipX = !state.facingRight

  // Jump
  if (state.jumpBuffer > 0 && state.coyoteTimer > 0) {
    rb.vy = JUMP_FORCE
    state.coyoteTimer = 0
    state.jumpBuffer = 0
  }

  // Variable jump height: release to cut jump short
  const jumpHeld =
    input.isDown('Space') || input.isDown('ArrowUp') || input.isDown('KeyW') || input.isDown('w')
  if (!jumpHeld && rb.vy < -200) {
    rb.vy += 900 * dt  // faster fall when key released
  }

  // Respawn if fallen below world
  if (transform.y > 900) {
    transform.x = 100
    transform.y = 200
    rb.vx = 0
    rb.vy = 0
  }
}

interface PlayerProps {
  x?: number
  y?: number
}

export function Player({ x = 100, y = 200 }: PlayerProps) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={28} height={40} color="#4fc3f7" zIndex={10} />
      <RigidBody mass={1} gravityScale={1} friction={0.7} />
      <BoxCollider width={26} height={40} />
      <Script init={playerInit} update={playerUpdate} />
    </Entity>
  )
}
