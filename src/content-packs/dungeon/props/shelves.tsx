import { createDungeonAsset } from '../shared/createDungeonAsset'
import { DUNGEON_PROP_TRANSFORM } from '../shared/dungeonConstants'

export const dungeonShelvesAsset = createDungeonAsset({
  id: 'dungeon.props_shelves',
  slug: 'dungeon-props-shelves',
  name: 'Dungeon Shelves',
  category: 'prop',
  modelName: 'shelves',
  transform: DUNGEON_PROP_TRANSFORM,
  metadata: {
    snapsTo: 'GRID',
    blocksLineOfSight: false,
    connectors: [
      {
        point: [0, 0, 0.25],
        type: 'WALL',
        rotation: [0, 0, 0],  // Faces outward from wall
      },
    ]
  },
})
