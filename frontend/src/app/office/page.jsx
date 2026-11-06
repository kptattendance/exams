import { redirect } from "next/navigation";

// The office has no dashboard: it starts on fee verification
export default function OfficeHome() {
  redirect("/office/fees");
}
