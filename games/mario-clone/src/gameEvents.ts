export const gameEvents = {
  onPlayerHurt:  null as (() => void) | null,
  onEnemyKill:   null as ((pts: number) => void) | null,
  onMushroomGet: null as (() => void) | null,
  onFireFlower:  null as (() => void) | null,
  onStar:        null as (() => void) | null,
  onOneUp:       null as (() => void) | null,
  onGoalReached: null as (() => void) | null,
}
