import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hogar",
    short_name: "Hogar",
    description: "Gastos del hogar para dos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#1f6f5b",
    lang: "es",
  };
}
