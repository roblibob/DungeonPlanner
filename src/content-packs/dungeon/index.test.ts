import { describe, expect, it } from 'vitest'
import { dungeonContentPack } from './index'

describe('dungeonContentPack', () => {
  it('defines placement with connectors instead of connectsTo', () => {
    for (const asset of dungeonContentPack.assets) {
      expect(asset.metadata?.connectsTo, asset.id).toBeUndefined()
    }
  })
})
