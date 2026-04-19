import { RoomPanel } from './RoomPanel'

export function RoomToolPanel() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-stone-800 bg-stone-950/50 p-4 text-sm leading-6 text-stone-400">
        <p className="font-medium text-stone-300">Room Tool</p>
        <p className="mt-1 text-xs">Left-drag to paint rooms. Right-drag to erase.</p>
        <p className="text-xs">Surface variants now live under the unified Assets browser.</p>
      </section>

      <RoomPanel />
    </div>
  )
}
