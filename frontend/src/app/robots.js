export default function robots() {
  const baseUrl = "https://exam.kptmangaluru.in";

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