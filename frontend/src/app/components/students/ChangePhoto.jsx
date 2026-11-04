"use client";

// "Change photo" for one student (Admin, Principal, COE, Office, HOD, Evening
// Principal). Only the photo changes; the old photo is removed from
// Cloudinary by the server.

import { useEffect, useState } from "react";

import Modal, { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "../exams/shared";

const MAX_MB = 5;

export default function ChangePhotoButton({ student, onChanged, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"}
      >
        Change photo
      </button>
      {open && <PhotoModal student={student} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </>
  );
}

function PhotoModal({ student, onClose, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);

  // the preview's temporary address is freed when it changes or the window closes
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Choose a photo (JPG or PNG).");
    if (f.size > MAX_MB * 1024 * 1024) return toast.error(`The photo is larger than ${MAX_MB} MB. Choose a smaller one.`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await api("put", `/students/${student._id}/photo`, fd);
      toast.success(r.data.message || "Photo changed.");
      onChanged?.(r.data.data);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, "Could not change the photo."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Change photo"
      subtitle={`${student.name || ""}${student.registerNumber ? ` · ${student.registerNumber}` : ""}`}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !file} className={btn.primary}>
            {busy ? "Saving…" : "Save photo"}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-6">
        <figure className="text-center">
          {student.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.imageUrl} alt="" className="h-36 w-28 rounded-xl border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-36 w-28 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">No photo</div>
          )}
          <figcaption className="mt-1 text-xs text-slate-500">Now</figcaption>
        </figure>
        <span className="text-2xl text-slate-300">→</span>
        <figure className="text-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-36 w-28 rounded-xl border-2 border-emerald-400 object-cover" />
          ) : (
            <div className="flex h-36 w-28 items-center justify-center rounded-xl border border-dashed border-slate-300 px-2 text-center text-xs text-slate-400">Choose the new photo</div>
          )}
          <figcaption className="mt-1 text-xs text-slate-500">New</figcaption>
        </figure>
      </div>
      <label className="mt-5 flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
        <input type="file" accept="image/*" onChange={pick} className="hidden" />
        {file ? "Choose another photo" : "Choose photo"}
      </label>
      <p className="mt-2 text-center text-xs text-slate-500">
        Passport-size photo, JPG or PNG, up to {MAX_MB} MB. Only the photo changes; the old photo is deleted. The hall ticket shows the new photo.
      </p>
    </Modal>
  );
}
