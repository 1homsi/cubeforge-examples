export const gameEvents = {
  onPlayerHit:    null as (() => void) | null,
  onEnemyKill:    null as ((score: number) => void) | null,
  onWaveComplete: null as (() => void) | null,
}
