import { useState } from 'react'
import { useMultiplayerStore, useIsDM } from '../../multiplayer/useMultiplayerStore'

const DEFAULT_MOVEMENT_RANGE = 10

export function TokenToolPanel() {
  const isDM = useIsDM()
  const entities = useMultiplayerStore((s) => s.entities)
  const room     = useMultiplayerStore((s) => s.room)

  const [newName,   setNewName]   = useState('Token')
  const [newType,   setNewType]   = useState<'PLAYER' | 'NPC'>('PLAYER')

  function handleRemove(id: string) {
    room?.send('removeToken', { entityId: id })
  }

  function handleToggleVisible(id: string, current: boolean) {
    room?.send('toggleVisible', { entityId: id, visible: !current })
  }

  function handlePatch(id: string, patch: Record<string, unknown>) {
    room?.send('patchEntity', { entityId: id, patch })
  }

  return (
    <div className="space-y-5">
      {/* Add token form — DM only */}
      {isDM && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">
            New Token
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Token name"
              className="w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-amber-400/40"
            />
            <div className="flex gap-2">
              {(['PLAYER', 'NPC'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                    newType === t
                      ? t === 'PLAYER'
                        ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
                        : 'border-rose-400/40 bg-rose-400/10 text-rose-300'
                      : 'border-stone-700 text-stone-500 hover:border-stone-600 hover:text-stone-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Click a floor cell to place.
          </p>
        </section>
      )}

      {/* Token list */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">
          Tokens ({Object.keys(entities).length})
        </p>
        {Object.keys(entities).length === 0 ? (
          <p className="text-xs text-stone-600">No tokens placed yet.</p>
        ) : (
          <div className="space-y-2">
            {Object.values(entities).map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-stone-800 bg-stone-900/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${
                      e.type === 'PLAYER' ? 'bg-sky-400' : 'bg-rose-400'
                    }`} />
                    <span className="truncate text-sm font-medium text-stone-100">
                      {e.name}
                    </span>
                  </div>
                  {isDM && (
                    <div className="flex shrink-0 gap-1">
                      {e.type === 'NPC' && (
                        <button
                          type="button"
                          title={e.visibleToPlayers ? 'Hide from players' : 'Show to players'}
                          onClick={() => handleToggleVisible(e.id, e.visibleToPlayers)}
                          className={`rounded-lg px-2 py-1 text-xs transition ${
                            e.visibleToPlayers
                              ? 'text-stone-400 hover:text-amber-300'
                              : 'text-stone-600 hover:text-stone-400'
                          }`}
                        >
                          {e.visibleToPlayers ? '👁' : '🙈'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemove(e.id)}
                        className="rounded-lg px-2 py-1 text-xs text-stone-600 transition hover:text-rose-400"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2 text-xs text-stone-500">
                  <span className={e.type === 'PLAYER' ? 'text-sky-400/70' : 'text-rose-400/70'}>
                    {e.type}
                  </span>
                  <span>·</span>
                  <span>Range {e.movementRange}</span>
                  <span>·</span>
                  <span>
                    {e.cellX},{e.cellZ}
                  </span>
                  {!e.visibleToPlayers && (
                    <>
                      <span>·</span>
                      <span className="text-stone-600">hidden</span>
                    </>
                  )}
                </div>
                {isDM && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      defaultValue={e.name}
                      onBlur={(ev) => {
                        if (ev.target.value !== e.name)
                          handlePatch(e.id, { name: ev.target.value })
                      }}
                      className="flex-1 rounded-lg border border-stone-700/50 bg-stone-900 px-2 py-1 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                    />
                    <input
                      type="number"
                      defaultValue={e.movementRange}
                      min={1}
                      max={30}
                      onBlur={(ev) => {
                        const v = parseInt(ev.target.value, 10)
                        if (!isNaN(v) && v !== e.movementRange)
                          handlePatch(e.id, { movementRange: v })
                      }}
                      className="w-14 rounded-lg border border-stone-700/50 bg-stone-900 px-2 py-1 text-xs text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                      title="Movement range"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {!isDM && (
        <p className="text-xs text-stone-600">
          Only the DM can place and manage tokens.
        </p>
      )}
    </div>
  )
}

// Exported for use by the canvas placement handler
export { DEFAULT_MOVEMENT_RANGE }
export type { }
