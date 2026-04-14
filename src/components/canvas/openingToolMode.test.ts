import { describe, expect, it } from 'vitest'
import { getOpeningToolMode } from './openingToolMode'

describe('getOpeningToolMode', () => {
  it('keeps floor-connected opening assets in floor placement only for door mode', () => {
    expect(getOpeningToolMode('door', 'FLOOR')).toBe('floor-asset')
    expect(getOpeningToolMode('open', 'FLOOR')).toBe('wall-connection')
    expect(getOpeningToolMode('wall', 'FLOOR')).toBe('wall-connection')
  })

  it('treats wall-connected assets as wall connections', () => {
    expect(getOpeningToolMode('door', 'WALL')).toBe('wall-connection')
    expect(getOpeningToolMode('open', 'WALL')).toBe('wall-connection')
  })
})
