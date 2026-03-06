import { Entity, Transform, Sprite, RigidBody, BoxCollider } from '@cubeforge/react'

export function Platform({
  x, y, width, height = 20, color = '#455a64',
}: {
  x: number; y: number; width: number; height?: number; color?: string
}) {
  return (
    <Entity tags={['solid']}>
      <Transform x={x} y={y} />
      <Sprite width={width} height={height} color={color} zIndex={0} />
      <RigidBody isStatic />
      <BoxCollider width={width} height={height} />
    </Entity>
  )
}
