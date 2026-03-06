import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import type { InputManager } from '@cubeforge/react'

const SPEED = 200
const JUMP_FORCE = -480

interface State { coyote: number; buffer: number; right: boolean }
const states = new Map<EntityId, State>()

function init(id: EntityId) {
  states.set(id, { coyote: 0, buffer: 0, right: true })
}

function update(id: EntityId, world: ECSWorld, input: InputManager, dt: number) {
  const t = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sp = world.getComponent<SpriteComponent>(id, 'Sprite')!
  const s = states.get(id)!

  s.coyote = rb.onGround ? 0.1 : Math.max(0, s.coyote - dt)

  const jump = input.isPressed('Space') || input.isPressed('ArrowUp') || input.isPressed('KeyW')
  if (jump) s.buffer = 0.08
  else s.buffer = Math.max(0, s.buffer - dt)

  const left = input.isDown('ArrowLeft') || input.isDown('KeyA')
  const right = input.isDown('ArrowRight') || input.isDown('KeyD')

  if (left)  { rb.vx = -SPEED; s.right = false }
  else if (right) { rb.vx = SPEED; s.right = true }
  else rb.vx *= rb.onGround ? 0.6 : 0.96

  sp.flipX = !s.right

  if (s.buffer > 0 && s.coyote > 0) {
    rb.vy = JUMP_FORCE
    s.coyote = 0
    s.buffer = 0
  }

  // Short-hop: release early to cut jump
  const held = input.isDown('Space') || input.isDown('ArrowUp') || input.isDown('KeyW')
  if (!held && rb.vy < -150) rb.vy += 800 * dt

  // Respawn
  if (t.y > 800) { t.x = 100; t.y = 300; rb.vx = 0; rb.vy = 0 }
}

export function Player({ x = 100, y = 300 }: { x?: number; y?: number }) {
  return (
    <Entity id="player" tags={['player']}>
      <Transform x={x} y={y} />
      <Sprite width={30} height={42} color="#4fc3f7" zIndex={10} />
      <RigidBody friction={0.65} />
      <BoxCollider width={28} height={42} />
      <Script init={(id) => init(id)} update={update} />
    </Entity>
  )
}
