import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createTextureMask } from './OutdoorGround'

describe('createTextureMask', () => {
  it('disables vertical texture flipping so painted ground aligns with cursor position', () => {
    const texture = createTextureMask({
      '2:1': {
        cell: [2, 1],
        layerId: 'default',
        textureType: 'rough-stone',
      },
    }, 'rough-stone')

    expect(texture).toBeInstanceOf(THREE.CanvasTexture)
    expect(texture.flipY).toBe(false)
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping)
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping)

    texture.dispose()
  })
})
