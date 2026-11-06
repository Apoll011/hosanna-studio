import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  return {
    plugins: [
      preact(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        workbox: {
          maximumFileSizeToCacheInBytes: 4194304,
          cleanupOutdatedCaches: true,
          // Default navigateFallback is index.html — without a denylist, opening
          // /robots.txt or /sitemap.xml in the browser loads the SPA, then the
          // router redirects to /onboarding (looks like a "redirect to home").
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/robots\.txt$/, /^\/sitemap\.xml$/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,xml,txt}"],
        },
        includeAssets: [
          "favicon.png",
          "apple-touch-icon.png",
          "apple-touch-icon-180x180.png",
          "apple-touch-icon-167x167.png",
          "apple-touch-icon-152x152.png",
          "hosanna_favicon.svg",
          "robots.txt",
          "sitemap.xml",
        ],
        devOptions: {
          enabled: false,
        },
        manifest: {
          name: "Hosanna Studio",
          short_name: "Hosanna",
          description:
            "Planeie e organize os seus serviços de culto, músicas e setlists de forma simples, rápida e eficiente.",
          theme_color: "#007AFF",
          background_color: "#ffffff",
          display: "standalone",
          icons: [
            {
              src: "apple-touch-icon-180x180.png",
              sizes: "180x180",
              type: "image/png",
            },
            {
              src: "apple-touch-icon-167x167.png",
              sizes: "167x167",
              type: "image/png",
            },
            {
              src: "apple-touch-icon-152x152.png",
              sizes: "152x152",
              type: "image/png",
            },
            {
              src: "apple-touch-icon.png",
              sizes: "192x192",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react-dom/client": "preact/compat",
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    define: {
      APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
