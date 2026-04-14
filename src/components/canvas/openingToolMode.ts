import type { PropConnector } from '../../content-packs/types'
import type { WallConnectionMode } from '../../store/useDungeonStore'

export function getOpeningToolMode(
  wallConnectionMode: WallConnectionMode,
  connector: PropConnector | undefined,
) {
  if (wallConnectionMode === 'door' && (connector ?? 'FLOOR') === 'FLOOR') {
    return 'floor-asset'
  }

  return 'wall-connection'
}
