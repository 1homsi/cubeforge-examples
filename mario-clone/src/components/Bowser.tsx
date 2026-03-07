import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent, SpriteComponent } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

interface BowserHPComponent { type: 'BowserHP'; hp: number }

interface BowserState { direction: 1 | -1; leftBound: number; rightBound: number }
const bowserStates = new Map<EntityId, BowserState>()

function bowserUpdate(id: EntityId, world: ECSWorld) {
  if (!world.hasEntity(id)) return
  const state = bowserStates.get(id)
  if (!state) return

  const transform = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb        = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  const sprite    = world.getComponent<SpriteComponent>(id, 'Sprite')!
  const hpComp    = world.getComponent<BowserHPComponent>(id, 'BowserHP')

  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound)  state.direction =  1
  rb.vx        = 45 * state.direction
  sprite.flipX = state.direction === 1

  // Flash red as HP drops
  if (hpComp) {
    if (hpComp.hp <= 2)      sprite.color = '#b71c1c'
    else if (hpComp.hp <= 4) sprite.color = '#e53935'
    else                     sprite.color = '#ff6f00'
  }
}

interface BowserProps {
  x: number
  y: number
  patrolLeft?:  number
  patrolRight?: number
}

export function Bowser({ x, y, patrolLeft, patrolRight }: BowserProps) {
  const left  = patrolLeft  ?? x - 60
  const right = patrolRight ?? x + 60

  return (
    <Entity tags={['enemy', 'bowser']}>
      <Transform x={x} y={y} />
      <Sprite src="/SMB_Bowser_Sprite.png" width={68} height={68} color="#ff6f00" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={60} height={64} />
      <Script
        init={(id, world) => {
          bowserStates.set(id, { direction: -1, leftBound: left, rightBound: right })
          world.addComponent(id, { type: 'BowserHP', hp: 5 } as BowserHPComponent)
        }}
        update={(id: EntityId, world: ECSWorld) => bowserUpdate(id, world)}
      />
    </Entity>
  )
}
