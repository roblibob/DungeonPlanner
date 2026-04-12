/**
 * useDungeonSync — subscribes to dungeon store changes and, when the local
 * client is the DM, broadcasts map updates to the Colyseus room.
 *
 * Players don't broadcast — their store is hydrated via 'mapSync' messages
 * from the server (see MultiplayerProvider).
 */
import { useEffect, useRef } from 'react'
import { useMultiplayerStore, useIsDM } from './useMultiplayerStore'
import { useDungeonStore } from '../store/useDungeonStore'
import { serializeDungeon } from '../store/serialization'

const SYNC_DEBOUNCE_MS = 150

export function useDungeonSync() {
  const isDM = useIsDM()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isDM) return

    const unsubscribe = useDungeonStore.subscribe(() => {
      const room = useMultiplayerStore.getState().room
      if (!room) return

      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        try {
          const json = serializeDungeon(useDungeonStore.getState())
          room.send('mapUpdate', json)
        } catch (err) {
          console.error('[useDungeonSync] failed to serialize map', err)
        }
      }, SYNC_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isDM])
}
