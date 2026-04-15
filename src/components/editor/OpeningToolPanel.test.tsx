import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OpeningToolPanel } from './OpeningToolPanel'
import { useDungeonStore } from '../../store/useDungeonStore'

describe('OpeningToolPanel', () => {
  beforeEach(() => {
    useDungeonStore.getState().reset()
    useDungeonStore.getState().setWallConnectionMode('door')
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the opening catalogue with door and stair thumbnails', () => {
    render(<OpeningToolPanel />)

    expect(screen.getByText('Opening Catalogue')).toBeInTheDocument()
    expect(screen.getByText('Doors')).toBeInTheDocument()
    expect(screen.getByText('Stairs')).toBeInTheDocument()
    expect(screen.getByAltText('Small door thumbnail')).toBeInTheDocument()
    expect(screen.getByAltText('Staircase Up thumbnail')).toBeInTheDocument()
  })

  it('updates the selected opening asset when a catalog card is clicked', () => {
    render(<OpeningToolPanel />)

    fireEvent.click(screen.getByRole('button', { name: /small door with bars/i }))

    expect(useDungeonStore.getState().selectedAssetIds.opening).toBe('core.opening_door_wall_bars_1')
    expect(screen.getByRole('button', { name: /small door with bars/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
