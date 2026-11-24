"use client";

// A student's written papers still to come, with room and seat once the exam
// section has allotted them. Used on the student's own page (from 10 minutes before
// the paper starts) and by the office (always). The room is drawn with its real benches: only
// this student's seat is filled in, every other seat is shown empty.

import { useState } from "react";

const SESSION = { FN: "Morning", AN: "Afternoon" };
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const time = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "");
const keyOf = (r) => `${r.date}|${r.session}|${r.code}`;
const WOOD = "#a9713a";
const WOOD_DARK = "#7c4f24";
const SEAT = "#e3c9a6";
const ME = "#8E0D3C";

// where a desk is: bench k = desks k (left), k + benches (right), k + 2 x benches (middle)
function findSeat(layout, seat) {
  const { rows, benches } = layout;
  const n = Number(seat);
  if (!benches || !n || n > 3 * benches) return null;
  const bench = ((n - 1) % benches) + 1;
  const side = ["left", "right", "middle"][Math.ceil(n / benches) - 1];
  let first = 1;
  for (let c = 0; c < rows.length; c++) {
    if (bench < first + rows[c]) return { bench, side, column: c, fromFront: bench - first + 1 };
    first += rows[c];
  }
  return null;
}

function Person() {
  return (
    <svg viewBox="0 0 24 28" className="mx-auto h-8 w-7" aria-hidden="true">
      <circle cx="12" cy="7.5" r="6" fill="#f2c9a1" stroke={ME} strokeWidth="1" />
      <path d="M2 28c0-9 4.5-13 10-13s10 4 10 13z" fill={ME} />
    </svg>
  );
}

function Bench({ places, mine, seat, student }) {
  return (
    <div className={`rounded-md p-0.5 ${mine ? "bg-yellow-200 ring-2 ring-[#8E0D3C]" : ""}`}>
      {/* the writing desk, in front of the students */}
      <div className="h-2 rounded-sm" style={{ background: WOOD }} />
      {/* one seat for each student of the bench; only this student's is filled */}
      <div className="mt-0.5 flex items-end gap-0.5">
        {places.map((p) => (
          <div key={p} className="min-w-0 flex-1 text-center">
            {mine === p && (
              <>
                <span className="block text-[15px] font-black leading-none tabular-nums text-[#8E0D3C]">{seat}</span>
                <Person />
              </>
            )}
            <div className="h-2.5 rounded-b-md" style={{ background: mine === p ? ME : SEAT, borderBottom: `2px solid ${mine === p ? ME : WOOD_DARK}` }} />
          </div>
        ))}
      </div>
      {mine && (student?.registerNumber || student?.name) && (
        <div className="mt-0.5 rounded-sm bg-[#8E0D3C] px-1 py-0.5 text-center text-white">
          <span className="block text-[10px] font-bold leading-tight tabular-nums">{student.registerNumber}</span>
          <span className="block break-words text-[9px] leading-tight">{student.name}</span>
        </div>
      )}
    </div>
  );
}

function RoomMap({ row, student }) {
  const { layout, seat } = row;
  const at = layout ? findSeat(layout, seat) : null;
  if (!at) return null;
  const places = layout.third ? ["left", "middle", "right"] : ["left", "right"];
  const depth = Math.max(...layout.rows);
  const starts = layout.rows.map((_, c) => layout.rows.slice(0, c).reduce((a, b) => a + b, 1));

  return (
    <div className="mt-2.5 w-full rounded-xl border border-stone-200 bg-stone-50 p-2 sm:p-3">
      <p className="rounded-lg bg-yellow-100 px-3 py-2 text-center text-sm text-stone-900">
        <b>Row {at.column + 1}</b> from the left · <b>Bench {at.fromFront}</b> from the front · <b>{at.side}</b> side · Seat <b className="text-base text-[#8E0D3C]">{seat}</b>
      </p>
      <div className="mx-auto mt-2 max-w-xl" role="img" aria-label={`Room ${row.room}: your seat ${seat} is in row ${at.column + 1}, bench ${at.fromFront} from the front, ${at.side} side`}>
        <div className="rounded bg-emerald-900 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest text-white">Blackboard · front of the room</div>
        <div className="mt-2 grid gap-x-3 gap-y-1.5 sm:gap-x-6" style={{ gridTemplateColumns: `repeat(${layout.rows.length}, minmax(0, 1fr))` }}>
          {layout.rows.map((_, c) => (
            <p key={c} className={`text-center text-[10px] font-bold uppercase ${c === at.column ? "text-[#8E0D3C]" : "text-stone-500"}`}>
              Row {c + 1}
            </p>
          ))}
          {Array.from({ length: depth }, (_, d) =>
            layout.rows.map((count, c) => {
              if (d >= count) return <div key={`${c}-${d}`} />;
              const bench = starts[c] + d;
              return <Bench key={`${c}-${d}`} places={places} mine={bench === at.bench ? at.side : null} seat={seat} student={student} />;
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function StudentSeats({ rows, student }) {
  // the next paper's room is open at first; a tap opens or closes any other
  const [picked, setPicked] = useState(null);
  if (!rows) return <div className="mt-3 h-20 animate-pulse rounded-2xl bg-slate-100" />;
  if (rows.length === 0) return <p className="mt-3 text-sm leading-6 text-slate-500">No written examination is coming up for you yet.</p>;
  const first = rows.find((r) => r.room && r.layout);
  const openKey = picked === null ? (first ? keyOf(first) : "") : picked;
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((r) => (
        <li key={keyOf(r)} className="rounded-2xl border border-slate-200 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-full sm:basis-0">
              <p className="text-sm font-bold text-slate-950">
                {r.code} <span className="font-semibold text-slate-700">{r.name}</span>
              </p>
              <p className="text-xs text-slate-500">
                {day(r.date)} · {SESSION[r.session] || r.session}
                {r.startsAt && ` · ${time(r.startsAt)} – ${time(r.endsAt)}`}
              </p>
            </div>
            {r.room ? (
              <div className="flex gap-2 text-center">
                <span className="rounded-xl bg-[#1D1842] px-3 py-1.5 text-white">
                  <span className="block text-[10px] uppercase tracking-wide opacity-80">Room</span>
                  <span className="block text-sm font-bold">{r.room}</span>
                </span>
                <span className="rounded-xl bg-[#8E0D3C] px-3 py-1.5 text-white">
                  <span className="block text-[10px] uppercase tracking-wide opacity-80">Seat</span>
                  <span className="block text-sm font-bold tabular-nums">{r.seat}</span>
                </span>
              </div>
            ) : r.seatState === "WAIT" ? (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900">
                Room &amp; seat at {time(r.seatShowsAt)}
                {new Date(r.seatShowsAt).toDateString() !== new Date().toDateString() && ` on ${day(r.date)}`}
              </span>
            ) : r.seatState === "OVER" ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Exam over</span>
            ) : (
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">Room not allotted yet</span>
            )}
          </div>
          {r.room && r.layout && (
            <>
              <button
                type="button"
                onClick={() => setPicked(openKey === keyOf(r) ? "" : keyOf(r))}
                aria-expanded={openKey === keyOf(r)}
                className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {openKey === keyOf(r) ? "Hide room layout" : "Show my seat in the room"}
              </button>
              {openKey === keyOf(r) && <RoomMap row={r} student={student} />}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
