// Module-level image cache for imperative entity creation (Script-spawned entities)
const cache = new Map<string, HTMLImageElement>()

export function preloadImage(src: string): void {
  if (cache.has(src)) return
  const img = new Image()
  img.src = src
  cache.set(src, img)
}

/** Returns the image if loaded, undefined if still loading */
export function getImage(src: string): HTMLImageElement | undefined {
  const img = cache.get(src)
  return img?.complete && img.naturalWidth > 0 ? img : undefined
}
