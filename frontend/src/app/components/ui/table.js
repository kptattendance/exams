// Shared look for data tables: compact header, light borders, hover rows.
//   <div className={T.wrap}><table className={T.table}>
//     <thead><tr className={T.headRow}><th className={T.th}>…</th></tr></thead>
//     <tbody className={T.body}><tr className={T.row}><td className={T.td}>…</td></tr></tbody>
//   </table></div>

export const T = {
  wrap: "overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm",
  table: "w-full min-w-[720px] text-sm",
  headRow: "border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500",
  th: "px-3 py-2.5 font-semibold",
  thNum: "w-12 px-3 py-2.5 text-right font-semibold",
  body: "divide-y divide-slate-100",
  row: "transition hover:bg-slate-50/70",
  td: "px-3 py-2.5 align-middle",
  tdNum: "px-3 py-2.5 text-right text-xs tabular-nums text-slate-400",
  // small pill: `${T.pill} bg-emerald-50 text-emerald-700`
  pill: "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
  dot: "h-1.5 w-1.5 rounded-full",
  // compact filter controls
  field: "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-slate-400",
};
