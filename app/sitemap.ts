import type { MetadataRoute } from "next";

const site = "https://sidimohamedselhami-portfolio.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${site}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${site}/profil`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site}/mentions-legales`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
