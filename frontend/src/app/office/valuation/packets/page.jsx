"use client";

import PacketTracker from "../../../components/exams/PacketTracker";

// Office: every packet (room diary) and where it stands, plus the ATS lookup
export default function OfficePacketTrackerPage() {
  return <PacketTracker backHref="/office/valuation" />;
}
