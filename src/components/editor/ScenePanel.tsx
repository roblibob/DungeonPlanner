import { useState, useRef } from 'react'
import { ChevronRight, Trash2 } from 'lucide-react'
import { useDungeonStore } from '../../store/useDungeonStore'
import { getContentPackAssetById } from '../../content-packs/registry'

export function ScenePanel() {
  const rooms = useDungeonStore((state) => state.rooms)
  const paintedCells = useDungeonStore((state) => state.paintedCells)
  const placedObjects = useDungeonStore((state) => state.placedObjects)
  const removeRoom = useDungeonStore((state) => state.removeRoom)
  const renameRoom = useDungeonStore((state) => state.renameRoom)

  // Derive props per room
  const propsByRoom = Object.values(placedObjects).reduce<Record<string, typeof placedObjects[string][]>>(
    (acc, obj) => {
      const roomId = paintedCells[obj.cellKey]?.roomId ?? null
      if (!roomId) return acc
      if (!acc[roomId]) acc[roomId] = []
      acc[roomId].push(obj)
      return acc
    },
    {},
  )

  const roomList = Object.values(rooms)

  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-sky-200/75">
        Scene
      </p>

      {roomList.length === 0 ? (
        <p className="rounded-2xl border border-stone-800 bg-stone-950/50 px-4 py-3 text-xs text-stone-500">
          Draw rooms to see them here.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {roomList.map((room) => (
            <RoomNode
              key={room.id}
              room={room}
              props={propsByRoom[room.id] ?? []}
              onRename={(name) => renameRoom(room.id, name)}
              onDelete={() => removeRoom(room.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

type RoomNodeProps = {
  room: { id: string; name: string }
  props: { id: string; assetId: string | null; cellKey: string }[]
  onRename: (name: string) => void
  onDelete: () => void
}

function RoomNode({ room, props, onRename, onDelete }: RoomNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(room.name)
  const inputRef = useRef<HTMLInputElement>(null)

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed) onRename(trimmed)
    else setDraft(room.name)
    setEditing(false)
  }

  return (
    <div className="rounded-2xl border border-stone-800 bg-stone-950/50">
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-500 transition hover:text-stone-300"
        >
          <ChevronRight
            size={12}
            strokeWidth={2}
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Room name / rename input */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') { setDraft(room.name); setEditing(false) }
              }}
              className="w-full bg-transparent text-xs text-stone-200 outline-none"
              autoFocus
            />
          ) : (
            <span
              className="block truncate text-xs font-medium text-stone-200 cursor-text"
              onDoubleClick={() => { setDraft(room.name); setEditing(true) }}
              title="Double-click to rename"
            >
              {room.name}
            </span>
          )}
        </div>

        {/* Prop count badge */}
        {props.length > 0 && !expanded && (
          <span className="shrink-0 text-[10px] text-stone-500">{props.length}</span>
        )}

        {/* Delete */}
        <button
          type="button"
          title="Delete room"
          onClick={onDelete}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-600 transition hover:text-red-400"
        >
          <Trash2 size={11} strokeWidth={1.5} />
        </button>
      </div>

      {/* Expanded prop list */}
      {expanded && (
        <div className="border-t border-stone-800/60 px-3 pb-2.5 pt-2">
          {props.length === 0 ? (
            <p className="text-[11px] text-stone-600">No props placed in this room.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {props.map((obj) => {
                const asset = obj.assetId ? getContentPackAssetById(obj.assetId) : null
                return (
                  <div
                    key={obj.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] text-stone-400"
                  >
                    <span className="h-1 w-1 shrink-0 rounded-full bg-stone-600" />
                    <span className="truncate">{asset?.name ?? 'Unknown'}</span>
                    <span className="ml-auto shrink-0 font-mono text-stone-600">{obj.cellKey}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
