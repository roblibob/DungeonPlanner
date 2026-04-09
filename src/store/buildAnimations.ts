import { getCellKey, type GridCell } from '../hooks/useSnapToGrid'

const BUILD_DEPTH        = 3.0   // world units tiles emerge from / sink into the ground
const RISE_DURATION_MS   = 450   // ms each tile takes to animate
const MAX_STAGGER_MS     = 320   // max additional delay for the furthest cells
const CLEANUP_BUFFER_MS  = 200   // extra time after full animation before map cleanup

/** Total time before erased cells can safely be removed from the store. */
export const DEMOLISH_TOTAL_MS = MAX_STAGGER_MS + RISE_DURATION_MS + CLEANUP_BUFFER_MS

type AnimEntry = { delay: number; startedAt: number; type: 'build' | 'demolish' }

const registry = new Map<string, AnimEntry>()

function scheduleAnimation(
  cells: GridCell[],
  originCell: GridCell,
  type: 'build' | 'demolish',
): void {
  if (cells.length === 0) return
  const now = performance.now()

  const maxDist = cells.reduce((max, cell) => {
    const d = Math.abs(cell[0] - originCell[0]) + Math.abs(cell[1] - originCell[1])
    return Math.max(max, d)
  }, 1)

  cells.forEach((cell) => {
    const d     = Math.abs(cell[0] - originCell[0]) + Math.abs(cell[1] - originCell[1])
    const delay = (d / maxDist) * MAX_STAGGER_MS
    registry.set(getCellKey(cell), { delay, startedAt: now, type })
  })
}

/**
 * Schedule a build (rise) animation.
 * Origin = where the drag started; tiles there appear first.
 */
export function triggerBuild(cells: GridCell[], originCell: GridCell): void {
  scheduleAnimation(cells, originCell, 'build')
}

/**
 * Schedule a demolish (sink) animation.
 * Origin = the far/release corner; tiles there sink first, wave moves toward drag start.
 * Call eraseCells from the store after DEMOLISH_TOTAL_MS to let the animation complete.
 */
export function triggerDemolish(cells: GridCell[], originCell: GridCell): void {
  scheduleAnimation(cells, originCell, 'demolish')
}

/**
 * Returns the Y-axis offset (always ≤ 0) for a tile at the current moment.
 * Returns 0 when there is no active animation.
 *
 * @param cellKey    Floor cell key (e.g. "3:5").
 * @param now        `performance.now()` — call once per useFrame and share.
 * @param extraDelay Optional extra delay in ms (walls use this to trail their floor tile).
 */
export function getBuildYOffset(cellKey: string, now: number, extraDelay = 0): number {
  const entry = registry.get(cellKey)
  if (!entry) return 0

  const elapsed = now - entry.startedAt - entry.delay - extraDelay

  if (entry.type === 'build') {
    if (elapsed < 0) return -BUILD_DEPTH
    if (elapsed >= RISE_DURATION_MS) {
      if (elapsed >= RISE_DURATION_MS + MAX_STAGGER_MS + CLEANUP_BUFFER_MS) {
        registry.delete(cellKey)
      }
      return 0
    }
    // Cubic ease-out: rises quickly then settles
    const t = elapsed / RISE_DURATION_MS
    return -BUILD_DEPTH * Math.pow(1 - t, 3)
  } else {
    // demolish: sinks from 0 → -BUILD_DEPTH with cubic ease-in (slow start, fast fall)
    if (elapsed < 0) return 0
    if (elapsed >= RISE_DURATION_MS) {
      registry.delete(cellKey)
      return -BUILD_DEPTH
    }
    const t = elapsed / RISE_DURATION_MS
    return -BUILD_DEPTH * (t * t * t)
  }
}

/** True when at least one animation is still in progress. */
export function hasActiveBuildAnimations(): boolean {
  return registry.size > 0
}
