export default function sitemap() {
  const baseUrl = "https://exams.kptmangaluru.in";

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}