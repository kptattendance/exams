// A fixed light colour for every department, so rows of different departments
// stand apart in long lists (the site's theme leaves these colours alone).
//   const t = deptTint("cs");  <tr className={`border-l-4 ${t.edge} ${odd ? t.row : "bg-white"}`}>
//   <span className={t.chip}>CS</span>

const TINTS = {
  at: { row: "bg-sky-50/70", edge: "border-sky-400", chip: "bg-sky-100 text-sky-900" },
  ce: { row: "bg-yellow-50/70", edge: "border-yellow-500", chip: "bg-yellow-100 text-yellow-900" },
  ch: { row: "bg-lime-50/70", edge: "border-lime-500", chip: "bg-lime-100 text-lime-900" },
  cs: { row: "bg-indigo-50/70", edge: "border-indigo-400", chip: "bg-indigo-100 text-indigo-900" },
  ec: { row: "bg-teal-50/70", edge: "border-teal-400", chip: "bg-teal-100 text-teal-900" },
  ee: { row: "bg-violet-50/70", edge: "border-violet-400", chip: "bg-violet-100 text-violet-900" },
  me: { row: "bg-emerald-50/70", edge: "border-emerald-400", chip: "bg-emerald-100 text-emerald-900" },
  ps: { row: "bg-fuchsia-50/70", edge: "border-fuchsia-400", chip: "bg-fuchsia-100 text-fuchsia-900" },
  sc: { row: "bg-cyan-50/70", edge: "border-cyan-400", chip: "bg-cyan-100 text-cyan-900" },
};
const OTHER = { row: "bg-slate-50", edge: "border-slate-300", chip: "bg-slate-100 text-slate-700" };

export const deptTint = (d) => TINTS[String(d || "").toLowerCase()] || OTHER;
