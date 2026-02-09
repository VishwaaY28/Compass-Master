import type { Direction } from '../types'

interface ControlPanelProps {
  depth: number
  setDepth: (depth: number) => void
  direction: Direction
  setDirection: (direction: Direction) => void
}

export default function ControlPanel({
  depth,
  setDepth,
  direction,
  setDirection,
}: ControlPanelProps) {
  return (
    <div className="control-panel">
      <div className="control-group">
        <label>Depth:</label>
        <select value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="0">All</option>
        </select>
      </div>

      <div className="control-group">
        <label>Direction:</label>
        <select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
          <option value="outgoing">Outgoing</option>
          <option value="incoming">Incoming</option>
          <option value="both">Both</option>
        </select>
      </div>
    </div>
  )
}
