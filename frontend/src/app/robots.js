export default function robots() {
  const baseUrl = "https://exams.kptmangaluru.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/dashboard/",
          "/hod/",
          "/student/",
          "/staff/",
          "/coe/",
          "/exam-officer/",
          "/faculty/",
          "/login/",
          "/auth/",
        ],
      },
    ],

    sitemap: `${baseUrl}/sitemap.xml`,
  };
}