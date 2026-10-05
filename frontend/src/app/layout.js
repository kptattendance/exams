import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://exams.kptmangaluru.in"),

  title: {
    default: "KPT Examination Management System",
    template: "%s | KPT Examinations",
  },

  description:
    "KPT Mangaluru Examination Management System for managing students, departments, subjects, examinations, internal assessment marks, examination records and results.",

  applicationName: "KPT Examination Management System",

  keywords: [
    "KPT Examinations",
    "KPT Examination Management System",
    "KPT Mangaluru Examinations",
    "Karnataka Government Polytechnic Mangaluru",
    "KPT Mangaluru",
    "Polytechnic Examination",
    "Diploma Examination",
    "Karnataka Polytechnic Examination",
    "Examination Management System",
    "Internal Assessment",
    "IA Marks",
    "Student Examination Management",
    "Polytechnic Students",
    "Diploma Students",
    "Examination Results",
    "Student Results",
  ],

  authors: [
    {
      name: "Karnataka Government Polytechnic Mangaluru",
    },
  ],

  creator: "Karnataka Government Polytechnic Mangaluru",

  publisher: "Karnataka Government Polytechnic Mangaluru",

  category: "Education",

  alternates: {
    canonical: "https://exams.kptmangaluru.in/",
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://exams.kptmangaluru.in/",
    siteName: "KPT Examinations",
    title: "KPT Examination Management System",
    description:
      "Examination management system of Karnataka Government Polytechnic Mangaluru.",
  },

  twitter: {
    card: "summary_large_image",
    title: "KPT Examination Management System",
    description:
      "KPT Examination Management System of Karnataka Government Polytechnic Mangaluru.",
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en-IN">
        <head>
          <meta
            name="google-site-verification"
            content="O67tWHY9xLUtBxSrAxCliKSiLNqr1KiTwmd_uKb_iVA"
          />
        </head>

        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}