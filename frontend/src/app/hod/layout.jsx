import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://exam.kptmangaluru.in"),

  title: {
    default: "KPT Examination ERP",
    template: "%s | KPT Examination ERP",
  },

  description:
    "KPT Examination ERP for Karnataka Government Polytechnic Mangaluru. Manage students, subjects, attendance, internal assessment, examinations and academic records.",

  applicationName: "KPT Examination ERP",

  keywords: [
    "KPT Examination ERP",
    "KPT Mangaluru Examination",
    "Karnataka Government Polytechnic Mangaluru",
    "KPT Mangaluru",
    "Polytechnic Examination",
    "Diploma Examination",
    "Karnataka Polytechnic Examination",
    "Student Examination Management",
    "Internal Assessment",
    "IA Marks",
    "Student Attendance",
    "Polytechnic Students",
    "Diploma Students",
    "Examination ERP",
    "College Examination Management",
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
    canonical: "https://exam.kptmangaluru.in",
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,

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
    url: "https://exam.kptmangaluru.in",
    siteName: "KPT Examination ERP",

    title: "KPT Examination ERP",

    description:
      "Examination and academic management system of Karnataka Government Polytechnic Mangaluru.",

    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "KPT Examination ERP",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "KPT Examination ERP",
    description:
      "Examination and academic management system of Karnataka Government Polytechnic Mangaluru.",
    images: ["/og-image.jpg"],
  },

  verification: {
    google: "O67tWHY9xLUtBxSrAxCliKSiLNqr1KiTwmd_uKb_iVA",
  },
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en-IN">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}