import { normalizeSeatMap } from '../lib/seats.js';

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={`inline-block h-4 w-4 rounded border border-line ${className}`} />
      {label}
    </span>
  );
}

export default function SeatMap({ seatMap, busType, taken, selected, onToggle, max = 6 }) {
  const takenSet = new Set(taken);
  const layout = normalizeSeatMap(seatMap, busType);
  const shape = layout.kind; // 'seater' | 'sleeper'

  const toggle = (s) => {
    if (selected.includes(s)) onToggle(selected.filter((x) => x !== s));
    else if (selected.length < max) onToggle([...selected, s]);
  };

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-muted">
        <LegendDot className="bg-white" label="Available" />
        <LegendDot className="bg-slate-200" label="Booked" />
        <LegendDot className="bg-primary border-primary" label="Selected" />
      </div>

      <div className="my-4 flex flex-wrap gap-6">
        {layout.decks.map((d, di) => (
          <div className="deck" key={di}>
            {d.name && <div className="deck-name">{d.name}</div>}
            <div className="deck-front">🚍 front</div>
            {d.rows.map((row, ri) => (
              <div className="seat-row" key={ri}>
                {row.map((cell, ci) =>
                  cell === null ? (
                    <span className="aisle" key={`a${ci}`} />
                  ) : (
                    <button
                      type="button"
                      key={cell}
                      className={`seat ${shape} ${takenSet.has(cell) ? 'taken' : ''} ${selected.includes(cell) ? 'selected' : ''}`}
                      disabled={takenSet.has(cell)}
                      onClick={() => toggle(cell)}
                    >
                      {cell}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="muted">Up to {max} seats per booking.</p>
    </div>
  );
}
