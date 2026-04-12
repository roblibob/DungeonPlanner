/**
 * Minimal TypeScript shapes for the Colyseus Schema objects as seen from the
 * client SDK.  These mirror server/src/schema/DungeonStateSchema.ts but are
 * plain interfaces — we don't import @colyseus/schema on the client.
 */

export interface Entity {
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

export interface DungeonState {
  entities: Map<string, Entity>
  mapJson:  string
  activeFloorId: string
}
