"use client";

// The lines the scrutiniser changed in a question paper, like "git diff":
// removed lines in red, added lines in green, with the line before each for context.

export function ChangeList({ changes = [] }) {
  if (!changes.length) return <p className="text-sm text-slate-500">No change in the text (formatting may have changed).</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 font-mono text-[12px] leading-5">
      {changes.map((c, i) => {
        const showContext = i === 0 || changes[i - 1].after !== c.after;
        return (
          <div key={i}>
            {showContext && (
              <p className="truncate border-t border-slate-100 bg-slate-50 px-3 py-1 text-slate-500 first:border-t-0">
                {c.after ? `after: ${c.after}` : "at the beginning"}
              </p>
            )}
            <p className={`whitespace-pre-wrap px-3 py-1 ${c.op === "removed" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
              {c.op === "removed" ? "− " : "+ "}
              {c.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
