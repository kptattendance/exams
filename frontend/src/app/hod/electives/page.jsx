"use client";

import Electives from "../../components/exams/Electives";

// HOD sees only his own department (the server enforces it too)
export default function HodElectivesPage() {
  return <Electives fixedDepartment />;
}
