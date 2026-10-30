"use client";

import BridgeCourses from "../../components/exams/BridgeCourses";

// Bridge courses are managed by the Admin (no longer in the COE menu)
export default function AdminBridgeCoursesPage() {
  return <BridgeCourses canManage />;
}
