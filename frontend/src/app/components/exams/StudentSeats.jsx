"use client";

// A student's written papers still to come, with room and seat once the exam
// section has allotted them. Used on the student's own page and by the office
// (to see what the student sees).

const SESSION = { FN: "Morning", AN: "Afternoon" };
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const time = (d) => (d ? new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "");

export default function StudentSeats({ rows }) {
  if (!rows) return <div className="mt-3 h-20 animate-pulse rounded-2xl bg-slate-100" />;
  if (rows.length === 0) return <p className="mt-3 text-sm leading-6 text-slate-500">No written examination is coming up for you yet.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((r) => (
        <li key={`${r.date}|${r.session}|${r.code}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2.5">
          <div className="min-w-0 flex-1">
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
          ) : (
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">Room not allotted yet</span>
          )}
        </li>
      ))}
    </ul>
  );
}
