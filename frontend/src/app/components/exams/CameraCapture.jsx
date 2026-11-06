"use client";

// Take a photo of a fee challan with the computer's webcam – no scanner
// needed: hold the challan in front of the camera with the Challan Reference
// Number inside the box, and press "Take photo". The box is read closely (the
// number), the whole picture for the amount and date. Nothing is uploaded.
//
//   <CameraCapture onPhoto={(full, box) => ...} onClose={...} onFile={...} />

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Modal, { btn } from "../ui/Modal";

// the guide box, as parts of the picture
const BOX = { x: 0.08, y: 0.38, w: 0.84, h: 0.24 };

const toBlob = (canvas) => new Promise((ok) => canvas.toBlob((b) => ok(b), "image/png"));

export default function CameraCapture({ onPhoto, onClose, onFile }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [state, setState] = useState("starting"); // starting | live | failed
  const [ratio, setRatio] = useState(16 / 9);

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.onloadedmetadata = () => v.videoWidth && setRatio(v.videoWidth / v.videoHeight);
          await v.play().catch(() => {});
        }
        setState("live");
      } catch {
        if (!stopped) setState("failed");
      }
    })();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const take = async () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    const W = v.videoWidth;
    const H = v.videoHeight;
    // the whole picture (amount, date)
    const full = document.createElement("canvas");
    full.width = W;
    full.height = H;
    const f = full.getContext("2d");
    f.filter = "grayscale(1) contrast(1.35)";
    f.drawImage(v, 0, 0);
    // the box, twice as large and sharper (the reference number)
    const sx = Math.round(W * BOX.x);
    const sy = Math.round(H * BOX.y);
    const sw = Math.round(W * BOX.w);
    const sh = Math.round(H * BOX.h);
    const box = document.createElement("canvas");
    box.width = sw * 2;
    box.height = sh * 2;
    const b = box.getContext("2d");
    b.imageSmoothingQuality = "high";
    b.filter = "grayscale(1) contrast(1.6)";
    b.drawImage(v, sx, sy, sw, sh, 0, 0, sw * 2, sh * 2);
    onPhoto(await toBlob(full), await toBlob(box));
  };

  return createPortal(
    <Modal
      open
      lg
      onClose={onClose}
      title="Photo of the challan"
      subtitle="Hold the challan close, with the Challan Reference Number (CR…) inside the box, then press Take photo."
      footer={
        <>
          <button onClick={onFile} className={btn.secondary}>
            Choose a file instead
          </button>
          <button onClick={take} disabled={state !== "live"} className={btn.primary}>
            Take photo
          </button>
        </>
      }
    >
      <div className="mx-auto max-h-[62vh] overflow-hidden rounded-xl bg-slate-900" style={{ aspectRatio: ratio, maxWidth: `calc(62vh * ${ratio})` }}>
        <div className="relative h-full w-full">
          <video ref={videoRef} playsInline muted className="block h-full w-full object-cover" />
          {state === "live" && (
            <div
              className="pointer-events-none absolute rounded-lg border-[3px] border-amber-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
              style={{ left: `${BOX.x * 100}%`, top: `${BOX.y * 100}%`, width: `${BOX.w * 100}%`, height: `${BOX.h * 100}%` }}
            >
              <span className="absolute -top-6 left-0 rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-slate-900">Challan Reference Number here</span>
            </div>
          )}
          {state === "starting" && <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">Starting the camera…</p>}
          {state === "failed" && (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm leading-6 text-slate-200">
              No camera found, or the browser was not allowed to use it. Allow the camera (icon in the address bar) or choose a photo / scan file instead.
            </p>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">The photo is read on this computer and is not saved anywhere. Check the filled-in boxes before saving.</p>
    </Modal>,
    document.body
  );
}
