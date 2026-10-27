// Official college letterhead for printed documents (hall tickets, room
// diaries, mark lists…). Same layout as the college's Word letterhead:
// KPT crest on the left, Platinum Jubilee seal on the right, State emblem
// and the government / department / college lines in the middle.
//
//   <Letterhead compact />   – smaller version for half-page documents

/* eslint-disable @next/next/no-img-element */

export default function Letterhead({ compact = false, className = "" }) {
  const logo = compact ? "h-[17mm] w-auto" : "h-[24mm] w-auto";
  return (
    <div className={`flex items-center gap-2 border-b-2 border-[#d42f21] pb-1 ${className}`}>
      <img src="/lh-kpt-crest.png" alt="KPT crest" className={logo} />
      <div className="min-w-0 flex-1 text-center leading-tight">
        <img
          src="/lh-karnataka.png"
          alt="Government of Karnataka emblem"
          className={`mx-auto ${compact ? "h-[7mm]" : "h-[11mm]"} w-auto`}
        />
        <p className={`font-bold text-[#d42f21] ${compact ? "text-[8.5px]" : "text-[11px]"}`}>GOVERNMENT OF KARNATAKA</p>
        <p className={`font-bold text-[#385623] ${compact ? "text-[8.5px]" : "text-[11px]"}`}>
          DEPARTMENT OF TECHNICAL EDUCATION
        </p>
        <p className={`font-extrabold text-[#d42f21] ${compact ? "text-[12px]" : "text-[15px]"}`}>
          KARNATAKA (GOVT.) POLYTECHNIC, MANGALURU
        </p>
        <p className={`font-semibold text-[#2e74b5] ${compact ? "text-[8px]" : "text-[10.5px]"}`}>
          (First Autonomous Polytechnic in India from AICTE New Delhi)
        </p>
        <p className={`text-black ${compact ? "text-[8px]" : "text-[10px]"}`}>
          Kadri Hills, Mangaluru – 575004, Dakshina Kannada, Karnataka
        </p>
      </div>
      <img src="/lh-jubilee.png" alt="Platinum Jubilee" className={logo} />
    </div>
  );
}
