import { Entity, Transform, Sprite, RigidBody, BoxCollider, Script } from '@cubeforge/react'
import type { EntityId, ECSWorld, TransformComponent, RigidBodyComponent } from '@cubeforge/react'

interface State { dir: 1 | -1; left: number; right: number }
const states = new Map<EntityId, State>()

function update(id: EntityId, world: ECSWorld) {
  const s = states.get(id)
  if (!s) return
  const t = world.getComponent<TransformComponent>(id, 'Transform')!
  const rb = world.getComponent<RigidBodyComponent>(id, 'RigidBody')!
  if (t.x >= s.right) s.dir = -1
  if (t.x <= s.left)  s.dir = 1
  rb.vx = 80 * s.dir
}

export function Enemy({
  x = 400, y = 300,
  patrolLeft, patrolRight,
}: {
  x?: number; y?: number; patrolLeft?: number; patrolRight?: number
}) {
  const l = patrolLeft  ?? x - 100
  const r = patrolRight ?? x + 100
  return (
    <Entity tags={['enemy']}>
      <Transform x={x} y={y} />
      <Sprite width={30} height={34} color="#ef5350" zIndex={10} />
      <RigidBody friction={1} />
      <BoxCollider width={28} height={34} />
      <Script
        init={(id) => states.set(id, { dir: 1, left: l, right: r })}
        update={update}
      />
    </Entity>
  )
}
