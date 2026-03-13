// Module-level callbacks wired from App → game scripts.
// One instance per game session — safe because only one Game is mounted at a time.
export const gameCallbacks = {
  onPlayerHurt: null as (() => void) | null,
  onEnemyKill:  null as (() => void) | null,
}
