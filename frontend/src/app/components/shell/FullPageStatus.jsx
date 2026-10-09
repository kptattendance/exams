// Full-screen "please wait" / message screen used while checking sign-in or role.

export default function FullPageStatus({ message, children, spinner = true }) {
  return (
    <div className="ruled-paper flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-xs font-bold tracking-wide text-white ring-4 ring-slate-100">
          KPT
        </span>
        {spinner && (
          <div className="mx-auto mt-6 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-1/2 animate-[kpt-load_1.1s_ease-in-out_infinite] rounded-full bg-blue-600" />
          </div>
        )}
        {message && <p className="mt-5 text-sm font-medium text-slate-700">{message}</p>}
        {children}
      </div>
      <style>{`@keyframes kpt-load{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
    </div>
  );
}
