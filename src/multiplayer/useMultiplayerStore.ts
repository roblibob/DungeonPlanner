/**
 * Thin Zustand slice that holds multiplayer connection metadata.
 * Kept separate from useDungeonStore to avoid polluting the dungeon model.
 */
import { create } from 'zustand'
import type { Room } from '@colyseus/sdk'
import type { DungeonState, Entity } from './colyseusTypes'
import { getCellKey, GRID_SIZE } from '../hooks/useSnapToGrid'
import { generateId } from '../utils/generateId'

export type ClientRole = 'dm' | 'player' | 'offline'

/** Radius in cells within which a PLAYER entity reveals the map. */
export const FOG_REVEAL_RADIUS = 6

type MultiplayerState = {
  role:       ClientRole
  connected:  boolean
  sessionId:  string | null
  room:       Room<DungeonState> | null

  // Derived entity map (plain objects, updated from Colyseus patches)
  entities:   Record<string, EntitySnapshot>

  /** Cells that have ever been visible to the players. Persists across moves. */
  discoveredCells: Set<string>

  /** Config used when placing the next token by clicking the canvas */
  pendingToken: { name: string; type: 'PLAYER' | 'NPC'; movementRange: number }

  setRole:          (role: ClientRole) => void
  setConnected:     (connected: boolean) => void
  setRoom:          (room: Room<DungeonState> | null, sessionId: string | null) => void
  setEntities:      (entities: Record<string, EntitySnapshot>) => void
  updateEntity:     (id: string, patch: Partial<EntitySnapshot>) => void
  removeEntity:     (id: string) => void
  discoverCells:    (cellKeys: string[]) => void
  resetDiscovered:  () => void
  setPendingToken:  (patch: Partial<MultiplayerState['pendingToken']>) => void

  /**
   * Place a token at a grid cell.
   * Works offline (adds directly to local store) and online (sends to server).
   */
  placeToken: (cellX: number, cellZ: number) => void
}

export type EntitySnapshot = {
  id:               string
  type:             'PLAYER' | 'NPC'
  cellX:            number
  cellZ:            number
  worldX:           number
  worldZ:           number
  movementRange:    number
  assetId:          string
  name:             string
  visibleToPlayers: boolean
}

export function entityToSnapshot(e: Entity): EntitySnapshot {
  return {
    id:               e.id,
    type:             e.type,
    cellX:            e.cellX,
    cellZ:            e.cellZ,
    worldX:           e.worldX,
    worldZ:           e.worldZ,
    movementRange:    e.movementRange,
    assetId:          e.assetId,
    name:             e.name,
    visibleToPlayers: e.visibleToPlayers,
  }
}

/** Build a set of cell keys within `radius` of the given cell (Chebyshev/square) */
export function getCellsInRadius(cx: number, cz: number, radius: number): string[] {
  const keys: string[] = []
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      // Circular LoS: skip corners beyond radius
      if (dx * dx + dz * dz > radius * radius) continue
      keys.push(getCellKey([cx + dx, cz + dz]))
    }
  }
  return keys
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => ({
  role:      'offline',
  connected: false,
  sessionId: null,
  room:      null,
  entities:  {},
  discoveredCells: new Set<string>(),
  pendingToken: { name: 'Token', type: 'PLAYER', movementRange: 10 },

  setRole:      (role) => set({ role }),
  setConnected: (connected) => set({ connected }),
  setRoom:      (room, sessionId) => set({ room, sessionId }),
  setEntities:  (entities) => set({ entities }),
  updateEntity: (id, patch) =>
    set((s) => ({ entities: { ...s.entities, [id]: { ...s.entities[id], ...patch } } })),
  removeEntity: (id) =>
    set((s) => {
      const next = { ...s.entities }
      delete next[id]
      return { entities: next }
    }),
  discoverCells: (cellKeys) =>
    set((s) => {
      const newCells = cellKeys.filter((k) => !s.discoveredCells.has(k))
      if (newCells.length === 0) return s
      const next = new Set(s.discoveredCells)
      for (const k of newCells) next.add(k)
      return { discoveredCells: next }
    }),
  resetDiscovered: () => set({ discoveredCells: new Set() }),
  setPendingToken: (patch) =>
    set((s) => ({ pendingToken: { ...s.pendingToken, ...patch } })),

  placeToken: (cellX, cellZ) => {
    const { room, pendingToken } = get()
    const id = generateId()
    const snapshot: EntitySnapshot = {
      id,
      type:             pendingToken.type,
      cellX,
      cellZ,
      worldX:           (cellX + 0.5) * GRID_SIZE,
      worldZ:           (cellZ + 0.5) * GRID_SIZE,
      movementRange:    pendingToken.movementRange,
      assetId:          '',
      name:             pendingToken.name,
      visibleToPlayers: true,
    }

    if (room) {
      // Online: let server create the authoritative entity
      room.send('placeToken', {
        id:            snapshot.id,
        type:          snapshot.type,
        cellX:         snapshot.cellX,
        cellZ:         snapshot.cellZ,
        name:          snapshot.name,
        assetId:       snapshot.assetId,
        movementRange: snapshot.movementRange,
      })
      // Optimistic local add (will be overwritten by server patch)
      set((s) => ({ entities: { ...s.entities, [id]: snapshot } }))
    } else {
      // Offline: manage entities locally
      set((s) => ({ entities: { ...s.entities, [id]: snapshot } }))
    }
  },
}))

/** Convenience selector — true when connected as DM */
export function useIsDM() {
  return useMultiplayerStore((s) => s.role === 'dm' || s.role === 'offline')
}
