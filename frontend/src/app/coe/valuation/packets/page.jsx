"use client";

import PacketTracker from "../../../components/exams/PacketTracker";

// COE: every packet (room diary) and where it stands, plus the ATS lookup
export default function CoePacketTrackerPage() {
  return <PacketTracker backHref="/coe/valuation" canLookup />;
}
