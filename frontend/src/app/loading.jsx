// Shown by Next.js while a page is opening (first visit, slow network)
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500" role="status">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-slate-700" />
      <p className="text-sm font-semibold">Loading… please wait</p>
    </div>
  );
}
