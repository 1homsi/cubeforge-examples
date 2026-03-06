import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent } from '@cubeforge/react'

const ENEMY_SPEED = 90

interface EnemyState {
  direction: 1 | -1
  leftBound: number
  rightBound: number
  alive: boolean
}

const enemyStates = new Map<EntityId, EnemyState>()

function enemyInit(entityId: EntityId, _world: ECSWorld, patrolLeft: number, patrolRight: number) {
  enemyStates.set(entityId, {
    direction: 1,
    leftBound: patrolLeft,
    rightBound: patrolRight,
    alive: true,
  })
}

function enemyUpdate(entityId: EntityId, world: ECSWorld) {
  const state = enemyStates.get(entityId)
  if (!state || !state.alive) return

  const transform = world.getComponent<TransformComponent>(entityId, 'Transform')!
  const rb = world.getComponent<RigidBodyComponent>(entityId, 'RigidBody')!

  // Reverse at patrol bounds
  if (transform.x >= state.rightBound) state.direction = -1
  if (transform.x <= state.leftBound) state.direction = 1

  rb.vx = ENEMY_SPEED * state.direction
}

interface EnemyProps {
  x?: number
  y?: number
  patrolLeft?: number
  patrolRight?: number
}

export function Enemy({ x = 400, y = 200, patrolLeft, patrolRight }: EnemyProps) {
  const pLeft = patrolLeft ?? x - 120
  const pRight = patrolRight ?? x + 120

  return (
    <Entity tags={['enemy', 'damageable']}>
      <Transform x={x} y={y} />
      <Sprite width={28} height={34} color="#ef5350" zIndex={10} />
      <RigidBody mass={1} gravityScale={1} friction={1} />
      <BoxCollider width={26} height={34} />
      <Script
        init={(id: EntityId, world: ECSWorld) => enemyInit(id, world, pLeft, pRight)}
        update={(id: EntityId, world: ECSWorld) => enemyUpdate(id, world)}
      />
    </Entity>
  )
}
