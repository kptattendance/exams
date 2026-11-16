"use client";

// Admin → Settings → Signatures of the COE and the Principal.
// Printed on hall tickets only (and the COE's on the practical examiners'
// office orders). Stored privately – never in the code or a public link.

import { useCallback, useEffect, useState } from "react";

import { btn } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "../exams/shared";

const WHO = ["coe", "principal", "coeSeal"];

export default function SignatureSettings() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [info, setInfo] = useState(null);
  const [names, setNames] = useState({});
  const [files, setFiles] = useState({});
  const [previews, setPreviews] = useState({});
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const d = (await api("get", "/signatures")).data.data;
      setInfo(d);
      setNames(Object.fromEntries(WHO.map((w) => [w, d[w]?.name || ""])));
      const p = {};
      for (const w of WHO) {
        if (!d[w]?.uploaded) continue;
        try {
          const r = await api("get", `/signatures/${w}/image`, undefined, { responseType: "blob" });
          p[w] = URL.createObjectURL(r.data);
        } catch {
          // preview not available
        }
      }
      setPreviews((old) => {
        Object.values(old).forEach((u) => URL.revokeObjectURL(u));
        return p;
      });
    } catch (e) {
      toast.error(errMsg(e, "Could not load the signatures."));
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pick = (w, file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) return toast.error("Choose a PNG or JPG image.");
    if (file.size > 1024 * 1024) return toast.error("The image must be smaller than 1 MB.");
    setFiles((f) => ({ ...f, [w]: file }));
  };

  const save = async (w) => {
    const fd = new FormData();
    fd.append("name", names[w] || "");
    if (files[w]) fd.append("image", files[w]);
    setBusy(w);
    try {
      const r = await api("put", `/signatures/${w}`, fd);
      toast.success(r.data.message);
      setFiles((f) => ({ ...f, [w]: null }));
      await load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the signature."));
    }
    setBusy("");
  };

  const remove = async (w) => {
    const ok = await confirm({
      title: `Remove the ${info[w].title}'s signature?`,
      message: "Hall tickets printed after this will have the line without a signature.",
      confirmText: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(w);
    try {
      const r = await api("delete", `/signatures/${w}`);
      toast.success(r.data.message);
      await load();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove the signature."));
    }
    setBusy("");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 sm:px-6 lg:px-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="font-semibold text-slate-950">Signatures</p>
        <p className="mt-1 text-sm text-slate-500">
          Printed above the COE and Principal lines on hall tickets. Kept private: only signed-in staff who print can load them.
          Use a scan on a white background (PNG or JPG, under 1 MB). Grade cards and certificates are signed by hand. The “with
          seal” image is printed on the practical examiners’ office orders.
        </p>
        {info === null ? (
          <div className="mt-4 h-32 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {WHO.map((w) => (
              <div key={w} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-900">{info[w].title}</p>
                <div className="mt-2 flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
                  {files[w] ? (
                    <span className="text-xs text-slate-600">New: {files[w].name}</span>
                  ) : previews[w] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previews[w]} alt="" className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">No signature uploaded</span>
                  )}
                </div>
                <label className={`mt-3 block text-xs font-semibold text-slate-600 ${w === "coeSeal" ? "hidden" : ""}`}>
                  Name
                  <input
                    value={names[w] || ""}
                    onChange={(e) => setNames((n) => ({ ...n, [w]: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal"
                    placeholder="Full name"
                  />
                </label>
                <label className={`${btn.small} mt-3 inline-flex cursor-pointer`}>
                  {info[w].uploaded ? "Replace image" : "Choose image"}
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pick(w, e.target.files?.[0])} />
                </label>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => save(w)} disabled={busy === w} className={btn.primary}>
                    {busy === w ? "Saving…" : "Save"}
                  </button>
                  {info[w].uploaded && (
                    <button onClick={() => remove(w)} disabled={busy === w} className={btn.small}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
