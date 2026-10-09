export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-slate-800">
      <h1 className="text-2xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">
        KPT Examination Management System, Karnataka Government Polytechnic, Mangaluru
      </p>

      <h2 className="mt-6 font-semibold">What we collect</h2>
      <p className="mt-2">
        Names, email addresses, department details and examination records of students
        and staff of the institution, used only for conducting examinations.
      </p>

      <h2 className="mt-6 font-semibold">Google Drive</h2>
      <p className="mt-2">
        The system uses Google Drive only to store encrypted examination documents in a
        folder created by the system itself. It cannot see or access any other files in
        the Google account.
      </p>

      <h2 className="mt-6 font-semibold">Sharing</h2>
      <p className="mt-2">
        Data is not sold or shared with third parties. Access is limited to authorised
        examination staff of the institution.
      </p>

      <h2 className="mt-6 font-semibold">Contact</h2>
      <p className="mt-2">Office of the Controller of Examinations, KPT Mangaluru.</p>
    </main>
  );
}