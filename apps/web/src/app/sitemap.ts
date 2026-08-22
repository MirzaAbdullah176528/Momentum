import type { MetadataRoute } from "next";

const BASE_URL = "https://momentum-by-abdullah-hassan.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/login", "/signup"].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: "2026-08-22"
  }));
}
