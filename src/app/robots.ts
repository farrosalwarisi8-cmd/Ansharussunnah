import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://anshorussunnah.com").replace(/\/$/, "")

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/"],
      },
      {
        userAgent: "Googlebot-Image",
        allow: ["/", "/*.png$", "/*.jpg$", "/*.webp$", "/*.ico$", "/*.svg$"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
