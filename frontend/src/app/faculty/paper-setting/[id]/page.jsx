"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

import { useConfirm, useToast } from "../../../components/ui/Feedback";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_PAPER_MB || 4);

const fmt = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

function timeLeft(deadline) {
  const ms = new Date(deadline) - new Date();
  if (ms <= 0) return "Deadline passed";
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  return d > 0 ? `${d} day${d > 1 ? "s" : ""} ${h} hr left` : `${h} hr ${Math.floor((ms % 36e5) / 6e4)} min left`;
}

export default function PaperUploadPage() {
  const { id } = useParams();
  const { getToken } = useAuth();

  const [paper, setPaper] = useState(null);
  const [preview, setPreview] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const toast = useToast();
  const confirmDialog = useConfirm();

  const auth = useCallback(async () => ({ Authorization: `Bearer ${await getToken()}` }), [getToken]);

  const loadPreview = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/paper-setting/my/${id}/preview`, { headers: await auth() });
      setPreview(res.data?.preview || null);
      setWarnings(res.data?.preview?.warnings || []);
    } catch {
      setPreview(null);
    }
  }, [id, auth]);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/paper-setting/my/${id}`, { headers: await auth() });
        const p = res.data?.data;
        setPaper(p);
        if (p?.currentFile && ["UPLOADED", "RETURNED"].includes(p.status)) loadPreview();
      } catch (e) {
        setError(e.response?.data?.error || "Could not load this request.");
      }
    })();
  }, [id, auth, loadPreview]);

  const pick = (f) => {
    setError("");
    if (!f) return;
    if (!/\.docx$/i.test(f.name)) return setError("Please choose a Word file ending in .docx (not .doc or .pdf).");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`File is larger than ${MAX_MB} MB. In Word use File > Compress Pictures.`);
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await axios.post(`${API_URL}/api/paper-setting/my/${id}/upload`, body, {
        headers: await auth(),
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
      });
      setPaper(res.data.data);
      setPreview(res.data.preview);
      setWarnings(res.data.warnings || []);
      setFile(null);
      setConfirmed(false);
      toast.success("Paper uploaded. Check the preview below before you submit.");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e.response?.data?.error || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const ok = await confirmDialog({
      title: "Submit your final paper?",
      message: "After final submission you cannot change or view this paper again. The COE office receives it encrypted.",
      confirmText: "Final submit",
    });
    if (!ok) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await axios.post(
        `${API_URL}/api/paper-setting/my/${id}/submit`,
        { confirm: true },
        { headers: await auth() }
      );
      setPaper(res.data.data);
      setPreview(null);
      toast.success("Paper submitted. Thank you!");
    } catch (e) {
      setError(e.response?.data?.error || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !paper) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error} <Link href="/faculty" className="ml-2 font-semibold underline">Back</Link>
      </div>
    );
  }
  if (!paper) return <p className="text-sm text-slate-500">Loading…</p>;

  const editable = ["ASSIGNED", "UPLOADED", "RETURNED"].includes(paper.status) && !paper.isPastDeadline;
  const canSubmit = ["UPLOADED", "RETURNED"].includes(paper.status) && paper.currentFile && !paper.isPastDeadline;

  return (
    <div className="space-y-5">
      <Link href="/faculty" className="text-sm font-medium text-slate-500 hover:text-slate-800">← All requests</Link>

      {/* SUBJECT CARD */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
              {paper.examSession} · {paper.paperType} paper
            </p>
            <h1 className="mt-1 text-xl font-bold text-slate-950">
              {paper.subject?.code} – {paper.subject?.name}
            </h1>
            <p className="text-sm text-slate-500">Semester {paper.subject?.semester} · {paper.subject?.department}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-slate-500">Last date</p>
            <p className="text-sm font-semibold text-slate-900">{fmt(paper.deadline)}</p>
            {paper.status !== "SUBMITTED" && (
              <p className={`text-xs font-semibold ${paper.isPastDeadline ? "text-red-600" : "text-orange-600"}`}>
                {timeLeft(paper.deadline)}
              </p>
            )}
          </div>
        </div>
        {paper.instructions && (
          <div className="mt-4 whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold">Instructions: </span>
            {paper.instructions}
          </div>
        )}
      </div>

      {paper.status === "RETURNED" && paper.returnRemarks && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
          <p className="font-semibold">Returned by COE for correction</p>
          <p className="mt-1 whitespace-pre-line">{paper.returnRemarks}</p>
          <p className="mt-2 text-xs">Correct your Word file, upload it again and submit.</p>
        </div>
      )}

      {/* SUBMITTED */}
      {paper.status === "SUBMITTED" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="text-lg font-bold text-emerald-800">Paper submitted ✔</p>
          <p className="mt-1 text-sm text-emerald-700">
            Received on {fmt(paper.submittedAt)} · {paper.currentFile?.originalName} ({kb(paper.currentFile?.size || 0)})
          </p>
          <p className="mt-3 text-xs text-emerald-700">
            The paper is now locked and stored encrypted. Please delete any copies from your computer, pen drive,
            email and WhatsApp.
          </p>
        </div>
      )}

      {paper.isPastDeadline && paper.status !== "SUBMITTED" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          The deadline has passed. Please contact the COE office to extend it.
        </div>
      )}

      {/* UPLOAD */}
      {editable && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            {paper.currentFile ? "Replace the uploaded file" : "Upload question paper"}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Word document (.docx) only, max {MAX_MB} MB. The file is encrypted before it is stored.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-800">
              {file ? file.name : "Drop your .docx here or click to choose"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{file ? kb(file.size) : "Microsoft Word file"}</p>
            <input
              ref={inputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>

          {uploading && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button
              disabled={!file || uploading}
              onClick={upload}
              className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? `Uploading… ${progress}%` : "Upload"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* PREVIEW + SUBMIT */}
      {paper.currentFile && paper.status !== "SUBMITTED" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Check your uploaded paper</h2>
              <p className="text-xs text-slate-500">
                {paper.currentFile.originalName} · {kb(paper.currentFile.size)} · uploaded {fmt(paper.currentFile.uploadedAt)}
              </p>
            </div>
            {preview && (
              <p className="text-xs text-slate-500">
                {preview.wordCount} words · {preview.imageCount} images
              </p>
            )}
          </div>

          {warnings.length > 0 && (
            <ul className="mx-5 mt-4 list-disc rounded-xl bg-orange-50 py-3 pl-8 pr-4 text-sm text-orange-800">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}

          <p className="px-5 pt-4 text-xs text-slate-400">
            Preview shows the text, tables and pictures. Page layout and Word equations may look different here –
            the original Word file is what the COE receives.
          </p>

          {/* Server already sanitises this HTML (no scripts, no links) */}
          <div
            className="qp-preview m-5 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 p-5 text-sm leading-relaxed text-slate-800 select-none"
            dangerouslySetInnerHTML={{ __html: preview?.html || "<p>Loading preview…</p>" }}
          />

          {canSubmit && (
            <div className="border-t border-slate-100 px-5 py-4">
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-slate-900"
                />
                I confirm this is my final question paper, it follows the syllabus and instructions, and I will not
                share it with anyone.
              </label>
              <div className="mt-4 flex justify-end">
                <button
                  disabled={!confirmed || submitting}
                  onClick={submit}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Final submit"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
