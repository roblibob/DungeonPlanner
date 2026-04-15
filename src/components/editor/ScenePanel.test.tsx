import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ScenePanel } from './ScenePanel'
import { useDungeonStore } from '../../store/useDungeonStore'

describe('ScenePanel', () => {
  beforeEach(() => {
    useDungeonStore.getState().newDungeon()
  })

  afterEach(() => {
    cleanup()
  })

  it('toggles between scene overview and active floor view', () => {
    render(<ScenePanel />)

    fireEvent.click(screen.getByRole('button', { name: /scene overview/i }))
    expect(useDungeonStore.getState().floorViewMode).toBe('scene')

    fireEvent.click(screen.getByText('Ground Floor'))
    expect(useDungeonStore.getState().floorViewMode).toBe('active')
  })
})
