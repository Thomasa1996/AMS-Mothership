import type { MetadataRoute } from "next";

// Lets people add Mothership to their phone's home screen and open it full screen, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mothership: AMS Commercial Moving",
    short_name: "Mothership",
    description: "CRM, operations and sales for commercial moves",
    start_url: "/crm/accounts",
    display: "standalone",
    background_color: "#0f1b3d",
    theme_color: "#0f1b3d",
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
