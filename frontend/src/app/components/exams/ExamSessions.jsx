"use client";

// Written (theory) exam – one session at a time, as the Chief Examiner runs it:
//   1. Question papers  (print from 1 hour before – "Question papers today")
//   2. Rooms            allot register numbers to rooms (25 a room) until the session
//                       starts; saving gives every student an ATS number. One room
//                       diary per paper per room = one packet (P-0001 …)
//   3. Absentees        from 30 minutes after the start until the session ends
//   4. Packets          made automatically when the session is over
// The server enforces the times; this screen only shows them.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import StudentSeats from "./StudentSeats";

const SESSION = { FN: "Morning (FN)", AN: "Afternoon (AN)" };
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
const STATE = {
  BEFORE: { label: "Not yet", chip: "bg-slate-100 text-slate-600" },
  OPEN: { label: "Open now", chip: "bg-emerald-100 text-emerald-800" },
  CLOSED: { label: "Closed", chip: "bg-red-100 text-red-700" },
};
// a light colour per paper, so that the papers of one session stand apart
const PAPER_TINTS = ["bg-cyan-50", "bg-violet-50", "bg-lime-50", "bg-pink-50", "bg-teal-50", "bg-indigo-50", "bg-fuchsia-50", "bg-emerald-50"];
const PAPER_CHIPS = ["bg-cyan-100 text-cyan-900", "bg-violet-100 text-violet-900", "bg-lime-100 text-lime-900", "bg-pink-100 text-pink-900", "bg-teal-100 text-teal-900", "bg-indigo-100 text-indigo-900", "bg-fuchsia-100 text-fuchsia-900", "bg-emerald-100 text-emerald-900"];

export default function ExamSessions({ qpHref = "/chief-examiner", codingHref = "" }) {
  const api = useApi();
  const toast = useToast();
  const [sessions, setSessions] = useState(null);
  const [key, setKey] = useState(""); // examId|date|session

  const loadList = useCallback(async () => {
    try {
      const r = await api("get", "/exam-sessions");
      const list = r.data.data || [];
      setSessions(list);
      // today's open session first, else the next one to come, else the last
      setKey((k) => {
        if (k) return k;
        const now = Date.now();
        const pick = list.find((s) => s.today && new Date(s.endsAt) > now) || list.find((s) => new Date(s.endsAt) > now) || list[list.length - 1];
        return pick ? `${pick.examId}|${pick.date}|${pick.session}` : "";
      });
    } catch (e) {
      setSessions([]);
      toast.error(errMsg(e, "Could not load the exam sessions."));
    }
  }, [api, toast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Exam sessions – rooms &amp; absentees</h2>
      <p className="mt-1 text-sm text-slate-500">Written examinations, one session (date + morning / afternoon) at a time.</p>

      {sessions === null && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white" />}
      {sessions?.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No published time table. The COE publishes the time table first.
        </p>
      )}

      {sessions?.length > 0 && (
        <label className="mt-4 block max-w-xl">
          <span className="text-xs font-semibold text-slate-500">Session</span>
          <select value={key} onChange={(e) => setKey(e.target.value)} className={`${field} mt-1`}>
            {sessions.map((s) => (
              <option key={`${s.examId}|${s.date}|${s.session}`} value={`${s.examId}|${s.date}|${s.session}`}>
                {s.today ? "TODAY · " : ""}
                {day(s.date)} · {SESSION[s.session]} · {s.papers.join(", ")}
              </option>
            ))}
          </select>
        </label>
      )}

      {key && (
        <Session
          key={key}
          id={key}
          qpHref={qpHref}
          codingHref={codingHref}
          onMoved={async (k) => {
            await loadList();
            setKey(k);
          }}
        />
      )}
    </div>
  );
}

function Session({ id, qpHref, codingHref, onMoved }) {
  const api = useApi();
  const toast = useToast();
  const [examId, date, session] = id.split("|");
  const path = `/exam-sessions/${examId}/${date}/${session}`;
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("rooms");

  const load = useCallback(async () => {
    try {
      const r = await api("get", path);
      setD(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the session."));
    }
  }, [api, path, toast]);

  useEffect(() => {
    load();
    // the open / closed state changes with the clock
    const t = setInterval(() => api("get", path).then((r) => setD((old) => (old ? { ...old, times: r.data.times, roomsOpen: r.data.roomsOpen } : r.data))).catch(() => {}), 60 * 1000);
    return () => clearInterval(t);
  }, [load, api, path]);

  if (!d) return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />;

  const tint = Object.fromEntries(d.papers.map((p, i) => [p.code, i % PAPER_TINTS.length]));
  const anyCoded = d.papers.some((p) => p.coded);
  const allCoded = d.papers.length > 0 && d.papers.every((p) => p.coded);
  const t = d.times;
  const steps = [
    { n: 1, title: "Question papers", when: `from ${time(t.printOpensAt)}`, state: t.print, href: qpHref },
    { n: 2, title: "Rooms, ATS & room diary", when: `until ${time(t.startsAt)}`, state: d.roomsOpen ? "OPEN" : "CLOSED", tab: "rooms" },
    { n: 3, title: "Mark absentees", when: `${time(t.absentOpensAt)} – ${time(t.endsAt)}`, state: t.absent, tab: "absent" },
    { n: 4, title: "Packets (automatic)", when: allCoded ? "made" : anyCoded ? "partly made" : `after ${time(t.endsAt)}`, state: allCoded ? "DONE" : "BEFORE", href: codingHref },
  ];

  // TRIAL DATABASE ONLY (local copy): end the session now, to see the packets without waiting
  const trialEnd = async () => {
    try {
      const r = await api("post", `${path}/trial-end`);
      toast.success(r.data.message, 6000);
      onMoved(`${examId}|${r.data.date}|${session}`);
    } catch (e) {
      toast.error(errMsg(e, "Could not end the session."));
    }
  };

  return (
    <>
      {d.trial && !allCoded && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex-1">
            <b>Trial copy.</b> No waiting: end this session now to make its packets.
          </span>
          <button onClick={trialEnd} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
            End this session now (trial)
          </button>
        </div>
      )}
      {/* the four steps with their times */}
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => {
          const st = s.state === "DONE" ? { label: "Done", chip: "bg-emerald-100 text-emerald-800" } : STATE[s.state];
          const box = (
            <div className={`h-full rounded-xl border p-3 ${s.state === "OPEN" ? "border-emerald-300 bg-emerald-50/60" : s.state === "CLOSED" ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{s.n}</span>
                <p className="flex-1 text-sm font-semibold text-slate-900">{s.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.chip}`}>{st.label}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{s.when}</p>
            </div>
          );
          if (s.tab) return <li key={s.n}><button onClick={() => setTab(s.tab)} className="block h-full w-full text-left">{box}</button></li>;
          if (s.href) return <li key={s.n}><Link href={s.href}>{box}</Link></li>;
          return <li key={s.n}>{box}</li>;
        })}
      </ol>

      {/* papers of the session */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Paper</th>
              <th className="px-3 py-2 text-right">Candidates</th>
              <th className="px-3 py-2 text-right">Absent</th>
              <th className="px-3 py-2">Packets</th>
            </tr>
          </thead>
          <tbody>
            {d.papers.map((p) => (
              <tr key={p.code} className={`border-t border-slate-100 ${PAPER_TINTS[tint[p.code]]}`}>
                <td className="px-3 py-2">
                  <b>{p.code}</b> <span className="text-slate-600">{p.name}</span>
                  {p.drawing && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">Drawing · 4 hours</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.candidates}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${p.absent ? "font-bold text-red-700" : ""}`}>{p.absent}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      p.coded ? "bg-emerald-100 text-emerald-800" : p.waiting ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.coded ? "Made" : p.waiting ? "Waiting" : "After the session"}
                  </span>
                  {p.waiting && <p className="mt-1 max-w-md text-xs text-orange-800">{p.waiting}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex gap-1 border-b border-slate-200">
        {[
          ["rooms", "Rooms & room diary"],
          ["absent", "Absentees"],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-slate-900 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "rooms" ? (
        <Rooms d={d} path={path} tint={tint} onSaved={load} />
      ) : (
        <Absentees d={d} path={path} tint={tint} onSaved={load} />
      )}
    </>
  );
}

// ------------------------------------------------------------------ rooms

function Rooms({ d, path, tint, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  // rooms (and so the ATS numbers) are locked from the start of the session (Admin: until the packets are made)
  const closed = !d.roomsOpen;
  const [rooms, setRooms] = useState(() =>
    d.rooms.map((r) => ({ name: r.name, invigilator: r.invigilator, capacity: r.capacity || 50, students: [...r.students], seats: { ...(r.seats || {}) } }))
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [target, setTarget] = useState(d.rooms[0]?.name || "");
  const [newRoom, setNewRoom] = useState("");
  const [newCap, setNewCap] = useState("50");
  const [size, setSize] = useState("50");
  const [paper, setPaper] = useState("");
  const [show, setShow] = useState("ALL"); // ALL | FREE | <room name>
  const [q, setQ] = useState("");

  const roomOf = useMemo(() => {
    const m = new Map();
    for (const r of rooms) for (const n of r.students) m.set(n, r.name);
    return m;
  }, [rooms]);
  // desk numbers start at 1 in every room: bench k = desk k (left) and k + 25 (right);
  // the arranged desk is kept, a student put in by hand gets the lowest free desk
  const info = useMemo(() => new Map(d.candidates.map((c) => [c.registerNumber, c])), [d.candidates]);
  const { seatOf, deskMaps, sameOf } = useMemo(() => {
    const seat = new Map();
    const maps = new Map();
    const same = new Map();
    const dept = (c) => String(c?.department || "").toLowerCase();
    for (const r of rooms) {
      const map = {};
      const used = new Set();
      for (const reg of r.students) {
        const given = r.seats?.[reg];
        if (given && !used.has(given)) {
          map[reg] = given;
          used.add(given);
        }
      }
      let next = 1;
      for (const reg of r.students) {
        if (map[reg]) continue;
        while (used.has(next)) next++;
        map[reg] = next;
        used.add(next);
      }
      maps.set(r.name, map);
      for (const [reg, s] of Object.entries(map)) seat.set(reg, s);
      // benches whose two students write the same paper and are from the same department
      const half = Math.floor((r.capacity || 50) / 2);
      const at = new Map(Object.entries(map).map(([reg, s]) => [s, reg]));
      let n = 0;
      for (let k = 1; k <= half; k++) {
        const a = info.get(at.get(k));
        const b = info.get(at.get(k + half));
        if (a && b && a.code === b.code && dept(a) === dept(b)) n++;
      }
      same.set(r.name, n);
    }
    return { seatOf: seat, deskMaps: maps, sameOf: same };
  }, [rooms, info]);
  const free = d.candidates.filter((c) => !roomOf.has(c.registerNumber));
  const list = d.candidates.filter(
    (c) =>
      (!paper || c.code === paper) &&
      (show === "ALL" || (show === "FREE" ? !roomOf.has(c.registerNumber) : roomOf.get(c.registerNumber) === show)) &&
      (!q || `${c.registerNumber} ${c.name}`.toLowerCase().includes(q.toLowerCase()))
  );

  const change = (fn) => {
    setRooms((rs) => fn(rs.map((r) => ({ ...r, students: [...r.students], seats: { ...(r.seats || {}) } }))));
    setDirty(true);
  };
  const addRoom = () => {
    const name = newRoom.trim();
    if (!name) return;
    if (rooms.some((r) => r.name.toLowerCase() === name.toLowerCase())) return toast.error("A room with this name is already there.");
    change((rs) => [...rs, { name, invigilator: "", capacity: Math.max(2, Number(newCap) || 50), students: [], seats: {} }]);
    setTarget(name);
    setNewRoom("");
  };
  const put = (numbers, room) => {
    const t = rooms.find((r) => r.name === room);
    const stay = t ? t.students.filter((n) => !numbers.includes(n)).length : 0;
    const cap = Math.floor((t?.capacity || 50) * 1.5); // 3 a bench at most
    if (t && stay + numbers.length > cap) return toast.error(`${room} holds at most ${cap} students – only ${cap - stay} more fit.`);
    change((rs) => {
      for (const r of rs) {
        r.students = r.students.filter((n) => !numbers.includes(n));
        for (const n of numbers) delete r.seats[n];
      }
      const x = rs.find((r) => r.name === room);
      if (x) x.students.push(...numbers);
      for (const r of rs) r.students.sort();
      return rs;
    });
  };
  // automatic seating: bench partners write different papers; for a common paper,
  // different departments (not saved until "Save rooms")
  const arrange = async () => {
    if (rooms.some((r) => r.students.length)) {
      const ok = await confirm({
        title: "Arrange the seating again?",
        message: "Every student of this session is seated again from the start. Changes made by hand are lost.",
        confirmText: "Arrange again",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api("post", `${path}/arrange`, { rooms: rooms.map((x) => ({ name: x.name, invigilator: x.invigilator, capacity: x.capacity })) });
      setRooms(r.data.rooms.map((x) => ({ name: x.name, invigilator: x.invigilator, capacity: x.capacity, students: x.students, seats: x.seats })));
      setTarget(r.data.rooms[0]?.name || "");
      setDirty(true);
      toast.success(r.data.message, 9000);
    } catch (e) {
      toast.error(errMsg(e, "Could not arrange the seating."), 8000);
    }
    setBusy(false);
  };
  const putPicked = () => {
    if (!target) return toast.error("Add a room first.");
    put([...picked], target);
    setPicked(new Set());
  };
  // the next N not-allotted candidates (shown order, i.e. register-number order) go to the room
  const fillNext = () => {
    if (!target) return toast.error("Add a room first.");
    const n = Math.max(1, Number(size) || 50);
    const next = list.filter((c) => !roomOf.has(c.registerNumber)).slice(0, n).map((c) => c.registerNumber);
    if (!next.length) return toast.error("Everybody in this list is already in a room.");
    put(next, target);
  };
  const removeRoom = async (name) => {
    const ok = await confirm({ title: `Remove ${name}?`, message: "Its students become “not allotted”.", confirmText: "Remove", tone: "danger" });
    if (ok) change((rs) => rs.filter((r) => r.name !== name));
  };
  const save = async () => {
    setBusy(true);
    try {
      // the desks as shown are saved
      const r = await api("put", `${path}/rooms`, { rooms: rooms.map((x) => ({ ...x, seats: deskMaps.get(x.name) || {} })) });
      toast.success(r.data.message, 6000);
      setDirty(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the rooms."), 8000);
    }
    setBusy(false);
  };
  const [examId, date, session] = path.split("/").slice(2);
  const print = (room) => `/print/exam-room/${examId}?date=${date}&session=${session}${room ? `&room=${encodeURIComponent(room)}` : ""}`;

  // which papers sit on the left, right (and middle) desks of a room
  const sidesOf = (r) => {
    const half = Math.floor((r.capacity || 50) / 2);
    const out = [
      ["Left desks", 1, half],
      ["Right desks", half + 1, 2 * half],
      ["Middle desks (3rd student)", 2 * half + 1, 3 * half],
    ].map(([label, from, to]) => {
      const papers = {};
      for (const [reg, desk] of Object.entries(deskMaps.get(r.name) || {}))
        if (desk >= from && desk <= to) {
          const code = info.get(reg)?.code || "?";
          papers[code] = (papers[code] || 0) + 1;
        }
      return { label: `${label} ${from}–${to}`, papers: Object.entries(papers) };
    });
    return out.filter((x) => x.papers.length);
  };
  const used = rooms.filter((r) => r.students.length);

  return (
    <div className="pb-24">
      {closed && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-700">
          The session has started – the seating (and the ATS numbers) is locked. It can only be viewed and printed (any change: the Admin).
        </p>
      )}

      {/* ---------------- one button ---------------- */}
      {!closed && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 text-sm text-emerald-950">
              <p className="font-bold">Seating – one button</p>
              <p className="mt-1">
                Rooms are filled in order – 220, 117, 114, 113, 105, 101, AT Lab, Chemical Lab, EE1, EE2, Civil MT Lab – only as many as needed, 50 a room
                (25 benches). One paper sits on the left desks (1–25), another paper on the right desks (26–50). For a common paper the bench partner is from
                another branch. If the rooms are not enough, a 3rd student (another paper) sits in the middle (desks 51–75).
              </p>
            </div>
            <button onClick={arrange} disabled={busy} className={btn.primary}>
              {used.length ? "Arrange again" : "Arrange seating"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${free.length ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"}`}>
          {free.length ? `${free.length} of ${d.candidates.length} not seated` : `All ${d.candidates.length} seated ✓`}
        </span>
        {dirty && <span className="text-xs font-semibold text-orange-700">Not saved yet – press Save rooms below.</span>}
        {!dirty && d.diaries.some((x) => x.reprint) && (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
            {d.diaries.filter((x) => x.reprint).length} room diar{d.diaries.filter((x) => x.reprint).length === 1 ? "y has" : "ies have"} changed – print again
          </span>
        )}
      </div>

      {/* ---------------- the rooms used ---------------- */}
      {used.length > 0 && (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {used.map((r) => (
            <div key={r.name} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-2">
                <p className="flex-1 font-bold text-slate-950">{r.name}</p>
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">{r.students.length} students</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {sidesOf(r).map((x) => (
                  <li key={x.label} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-44 shrink-0 text-slate-500">{x.label}</span>
                    {x.papers.map(([code, n]) => (
                      <span key={code} className={`rounded-md px-1.5 py-0.5 font-bold ${PAPER_CHIPS[tint[code]] || "bg-slate-100"}`}>
                        {code} ({n})
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              {sameOf.get(r.name) > 0 && (
                <p className="mt-2 rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-800">
                  {sameOf.get(r.name)} bench{sameOf.get(r.name) === 1 ? "" : "es"}: same paper and same branch side by side (no other choice)
                </p>
              )}
              <input
                value={r.invigilator}
                disabled={closed}
                onChange={(e) => change((rs) => rs.map((x) => (x.name === r.name ? { ...x, invigilator: e.target.value } : x)))}
                placeholder="Invigilator (optional)"
                className="mt-3 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs"
              />
              {/* its room diaries (one per paper) = its packets */}
              {!dirty &&
                d.diaries
                  .filter((x) => x.room === r.name)
                  .map((x) => (
                    <p key={x._id} className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                      {x.base && <b className="tabular-nums text-slate-900">ATS {x.base}</b>}
                      {x.number && <span className="tabular-nums text-slate-500">({x.number})</span>}
                      <span className={`rounded-md px-1.5 py-0.5 font-bold ${PAPER_CHIPS[tint[x.code]] || "bg-slate-100"}`}>{x.code}</span>
                      {x.students} students
                      {x.reprint && <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">Changed – print again</span>}
                    </p>
                  ))}
              {!dirty && d.seesAts && (
                <a href={print(r.name)} target="_blank" rel="noreferrer" className={`${btn.small} mt-2`}>
                  <Icon name="download" className="h-3.5 w-3.5" />
                  Room diary
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- printing ---------------- */}
      {used.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mr-auto text-sm text-slate-600">
            {dirty ? "Save the rooms first, then print." : `${used.length} rooms · ${d.candidates.length - free.length} students seated${d.seesAts ? ` · ${d.diaries.length} room diaries (packets)` : ""}`}
          </p>
          {dirty ? (
            <span className={`${btn.secondary} pointer-events-none opacity-40`}>
              <Icon name="download" className="h-4 w-4" />
              Seating plan
            </span>
          ) : (
            <a href={`/print/seating/${examId}?date=${date}&session=${session}`} target="_blank" rel="noreferrer" className={btn.secondary}>
              <Icon name="download" className="h-4 w-4" />
              Seating plan
            </a>
          )}
          {d.seesAts &&
            (dirty ? (
              <span className={`${btn.primary} pointer-events-none opacity-40`}>
                <Icon name="download" className="h-4 w-4" />
                Print all room diaries
              </span>
            ) : (
              <a href={print("")} target="_blank" rel="noreferrer" className={btn.primary}>
                <Icon name="download" className="h-4 w-4" />
                Print all room diaries
              </a>
            ))}
        </div>
      )}

      {/* ---------------- by hand (rarely needed) ---------------- */}
      <details className="mt-4 rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Every student · change by hand</summary>
        <div className="border-t border-slate-100 px-4 py-3">
          {!closed && (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-slate-600">
                Room
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 block h-9 rounded-lg border border-slate-300 px-2 text-sm">
                  <option value="">Choose</option>
                  {rooms.map((r) => (
                    <option key={r.name}>{r.name}</option>
                  ))}
                </select>
              </label>
              <button onClick={putPicked} disabled={!picked.size || !target} className={btn.secondary}>
                Move {picked.size || ""} ticked to {target || "the room"}
              </button>
              <label className="text-xs text-slate-600">
                How many
                <input type="number" min="1" value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 block h-9 w-20 rounded-lg border border-slate-300 px-2 text-sm" />
              </label>
              <button onClick={fillNext} disabled={!target} className={btn.secondary}>
                Put the next {Math.max(1, Number(size) || 50)} not seated in {target || "the room"}
              </button>
              <span className="mx-2 h-8 w-px bg-slate-200" />
              <input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRoom()} placeholder="Another room" className="h-9 w-36 rounded-lg border border-slate-300 px-2 text-sm" />
              <input type="number" min="2" value={newCap} onChange={(e) => setNewCap(e.target.value)} title="Students it holds" aria-label="Students it holds" className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-sm" />
              <button onClick={addRoom} className={btn.secondary}>
                Add room
              </button>
              {target && rooms.some((r) => r.name === target) && (
                <button onClick={() => removeRoom(target)} className={`${btn.secondary} !text-red-700`}>
                  Remove {target}
                </button>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no. or name" className="h-9 w-56 rounded-lg border border-slate-300 px-3 text-sm" />
            <select value={paper} onChange={(e) => setPaper(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="">All papers</option>
              {d.papers.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.code}
                </option>
              ))}
            </select>
            <select value={show} onChange={(e) => setShow(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
              <option value="ALL">Everybody</option>
              <option value="FREE">Not seated only</option>
              {used.map((r) => (
                <option key={r.name} value={r.name}>
                  In {r.name}
                </option>
              ))}
            </select>
          </div>

          <CandidateTable
            rows={list}
            tint={tint}
            picked={closed ? null : picked}
            setPicked={setPicked}
            extra={(c) =>
              roomOf.get(c.registerNumber) ? (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {roomOf.get(c.registerNumber)} · Desk {seatOf.get(c.registerNumber)}
                </span>
              ) : (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">Not seated</span>
              )
            }
            extraHead="Room & desk"
            rowClass={(c) => (roomOf.has(c.registerNumber) ? "" : "!bg-orange-50/70")}
          />
        </div>
      </details>

      <SeatLookup />

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">Seating changed – not saved yet.</p>
            <button onClick={save} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {busy ? "Saving…" : "Save rooms"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ a student's rooms and seats

// What a student sees on his own page: type his register number
function SeatLookup() {
  const api = useApi();
  const toast = useToast();
  const [rn, setRn] = useState("");
  const [found, setFound] = useState(null);
  const look = async (e) => {
    e.preventDefault();
    try {
      const r = await api("get", `/exam-sessions/student/${encodeURIComponent(rn.trim().toUpperCase())}`);
      setFound(r.data);
    } catch (err) {
      setFound(null);
      toast.error(errMsg(err, "Could not find the student."));
    }
  };
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <form onSubmit={look} className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="font-semibold text-slate-800">A student&apos;s rooms and seats</span>
          <span className="block text-xs text-slate-500">The same as the student sees after signing in.</span>
          <input value={rn} onChange={(e) => setRn(e.target.value)} placeholder="Register number" className="mt-1 block h-9 w-52 rounded-lg border border-slate-300 px-3 text-sm uppercase" />
        </label>
        <button disabled={rn.trim().length < 6} className={btn.secondary}>
          Show
        </button>
      </form>
      {found && (
        <div className="mt-3">
          <p className="text-sm font-semibold text-slate-900">
            {found.student.registerNumber} {found.student.name}
          </p>
          <StudentSeats rows={found.data} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ absentees

function Absentees({ d, path, tint, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [absent, setAbsent] = useState(() => new Set(d.candidates.filter((c) => c.attendance === "ABSENT").map((c) => c.registerNumber)));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [room, setRoom] = useState("");
  const [paper, setPaper] = useState("");
  const [onlyAbsent, setOnlyAbsent] = useState(false);
  const [q, setQ] = useState("");
  const [paste, setPaste] = useState("");
  const t = d.times;
  // the server refuses a change for a packet whose marks are already typed
  const open = t.absent === "OPEN";

  const list = d.candidates.filter(
    (c) =>
      (!room || c.room === room) &&
      (!paper || c.code === paper) &&
      (!onlyAbsent || absent.has(c.registerNumber)) &&
      (!q || `${c.registerNumber} ${c.name}`.toLowerCase().includes(q.toLowerCase()))
  );
  const toggle = (n) => {
    setAbsent((s) => {
      const x = new Set(s);
      if (x.has(n)) x.delete(n);
      else x.add(n);
      return x;
    });
    setDirty(true);
  };
  // register numbers typed / pasted from the room diaries
  const addPasted = () => {
    const known = new Set(d.candidates.map((c) => c.registerNumber));
    const nums = [...new Set(paste.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))];
    const bad = nums.filter((n) => !known.has(n));
    setAbsent((s) => new Set([...s, ...nums.filter((n) => known.has(n))]));
    setDirty(true);
    setPaste("");
    if (bad.length) toast.error(`Not in this session: ${bad.join(", ")}`, 8000);
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `${path}/absent`, { absent: [...absent] });
      toast.success(r.data.message, 6000);
      setDirty(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the absentees."), 8000);
    }
    setBusy(false);
  };

  return (
    <div className="pb-24">
      <div
        className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          t.absent === "OPEN" ? "bg-emerald-50 text-emerald-900" : t.absent === "BEFORE" ? "bg-orange-50 text-orange-900" : "bg-red-50 text-red-800"
        }`}
      >
        {t.absent === "OPEN"
          ? `Open now until ${time(t.endsAt)}. Mark the students written “Absent” in the room diaries, then Save.`
          : t.absent === "BEFORE"
          ? `Absentees can be marked from ${time(t.absentOpensAt)} (30 minutes after the start) until ${time(t.endsAt)} on ${day(d.date)}.`
          : "The session is over – absentees can no longer be marked here. Ask the COE office for any correction."}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">{absent.size} absent</span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{d.candidates.length - absent.size} present</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no. or name" className="h-9 w-56 rounded-lg border border-slate-300 px-3 text-sm" />
        <select value={room} onChange={(e) => setRoom(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">All rooms</option>
          {d.rooms.map((r) => (
            <option key={r.name}>{r.name}</option>
          ))}
        </select>
        <select value={paper} onChange={(e) => setPaper(e.target.value)} className="h-9 rounded-lg border border-slate-300 px-2 text-sm">
          <option value="">All papers</option>
          {d.papers.map((p) => (
            <option key={p.code}>{p.code}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={onlyAbsent} onChange={(e) => setOnlyAbsent(e.target.checked)} className="h-4 w-4" />
          Absent only
        </label>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <label className="min-w-0 flex-1 text-xs text-slate-600">
            Or type / paste the absent register numbers
            <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="103CS26004, 103CS26017 …" className="mt-1 block h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" />
          </label>
          <button onClick={addPasted} disabled={!paste.trim()} className={btn.secondary}>
            Mark absent
          </button>
        </div>
      )}

      <CandidateTable
        rows={list}
        tint={tint}
        extraHead="Present / Absent"
        rowClass={(c) => (absent.has(c.registerNumber) ? "!bg-red-50" : "")}
        extra={(c) => (
          <button
            onClick={() => toggle(c.registerNumber)}
            disabled={!open}
            className={`rounded-lg border px-3 py-1 text-xs font-bold disabled:cursor-not-allowed ${
              absent.has(c.registerNumber) ? "border-red-600 bg-red-600 text-white" : "border-emerald-300 bg-emerald-50 text-emerald-800"
            } ${!open ? "opacity-60" : ""}`}
          >
            {absent.has(c.registerNumber) ? "ABSENT" : "Present"}
          </button>
        )}
        showRoom
      />

      {dirty && open && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">{absent.size} absent – not saved yet.</p>
            <button onClick={save} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {busy ? "Saving…" : "Save absentees"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ the candidate table

function CandidateTable({ rows, tint, picked, setPicked, extra, extraHead, rowClass, showRoom }) {
  const all = picked && rows.length > 0 && rows.every((c) => picked.has(c.registerNumber));
  return (
    <div className="mt-3 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            {picked && (
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={all}
                  onChange={() => setPicked(all ? new Set() : new Set(rows.map((c) => c.registerNumber)))}
                  aria-label="Tick all shown"
                  className="h-4 w-4"
                />
              </th>
            )}
            <th className="w-12 px-3 py-2">Sl.</th>
            <th className="px-3 py-2">Register No.</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Class</th>
            <th className="px-3 py-2">Paper</th>
            {showRoom && <th className="px-3 py-2">Room</th>}
            <th className="px-3 py-2">{extraHead}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c._id} className={`border-t border-slate-100 ${PAPER_TINTS[tint[c.code]]} ${rowClass ? rowClass(c) : ""}`}>
              {picked && (
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={picked.has(c.registerNumber)}
                    onChange={() =>
                      setPicked((s) => {
                        const x = new Set(s);
                        if (x.has(c.registerNumber)) x.delete(c.registerNumber);
                        else x.add(c.registerNumber);
                        return x;
                      })
                    }
                    className="h-4 w-4"
                  />
                </td>
              )}
              <td className="px-3 py-1.5 tabular-nums text-slate-500">{i + 1}</td>
              <td className="px-3 py-1.5 font-semibold tabular-nums text-slate-900">{c.registerNumber}</td>
              <td className="px-3 py-1.5 text-slate-700">{c.name}</td>
              <td className="px-3 py-1.5 text-xs text-slate-600">
                {String(c.department || "").toUpperCase()} · Sem {c.semester}
                {c.kind === "BACKLOG" && <span className="ml-1 font-semibold text-orange-700">(back paper)</span>}
              </td>
              <td className="px-3 py-1.5">
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${PAPER_CHIPS[tint[c.code]]}`}>{c.code}</span>
              </td>
              {showRoom && <td className="px-3 py-1.5 text-xs text-slate-700">{c.room || "–"}</td>}
              <td className="px-3 py-1.5">{extra(c)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                Nobody matches the filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
