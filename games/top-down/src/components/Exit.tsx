import { useRef } from 'react'
import { Entity, Transform, Sprite, BoxCollider, useTriggerEnter } from '@cubeforge/react'
import { gameEvents } from '../gameEvents'

interface ExitProps {
  x: number
  y: number
  keysCollected: number
  totalKeys: number
}

function ExitActivator({ keysCollected, totalKeys }: { keysCollected: number; totalKeys: number }) {
  // Always read the latest value inside the trigger handler via ref
  const keysRef = useRef(keysCollected)
  keysRef.current = keysCollected

  useTriggerEnter(() => {
    if (keysRef.current >= totalKeys) {
      gameEvents.onExitReached?.()
    }
  }, { tag: 'player' })

  return null
}

export function Exit({ x, y, keysCollected, totalKeys }: ExitProps) {
  return (
    <Entity tags={['exit']}>
      <Transform x={x} y={y} />
      <Sprite width={36} height={48} color="#4fc3f7" zIndex={3} />
      <BoxCollider width={36} height={48} isTrigger />
      <ExitActivator keysCollected={keysCollected} totalKeys={totalKeys} />
    </Entity>
  )
}
