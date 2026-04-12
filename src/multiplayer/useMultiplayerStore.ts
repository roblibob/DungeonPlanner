/**
 * Thin Zustand slice that holds multiplayer connection metadata.
 * Kept separate from useDungeonStore to avoid polluting the dungeon model.
 */
import { create } from 'zustand'
import type { Room } from '@colyseus/sdk'
import type { DungeonState, Entity } from './colyseusTypes'

export type ClientRole = 'dm' | 'player' | 'offline'

type MultiplayerState = {
  role:       ClientRole
  connected:  boolean
  sessionId:  string | null
  room:       Room<DungeonState> | null

  // Derived entity map (plain objects, updated from Colyseus patches)
  entities:   Record<string, EntitySnapshot>

  setRole:      (role: ClientRole) => void
  setConnected: (connected: boolean) => void
  setRoom:      (room: Room<DungeonState> | null, sessionId: string | null) => void
  setEntities:  (entities: Record<string, EntitySnapshot>) => void
  updateEntity: (id: string, patch: Partial<EntitySnapshot>) => void
  removeEntity: (id: string) => void
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

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  role:      'offline',
  connected: false,
  sessionId: null,
  room:      null,
  entities:  {},

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
}))

/** Convenience selector — true when connected as DM */
export function useIsDM() {
  return useMultiplayerStore((s) => s.role === 'dm' || s.role === 'offline')
}
