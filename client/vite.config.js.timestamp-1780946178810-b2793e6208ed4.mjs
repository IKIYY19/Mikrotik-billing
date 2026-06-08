// vite.config.js
import { defineConfig } from "file:///home/project/client/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/client/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///home/project/client/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["vite.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts", expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "google-fonts-static", expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } }
          }
        ]
      },
      manifest: {
        name: "MikroTik Billing",
        short_name: "MTK Billing",
        description: "MikroTik ISP Billing & Management Platform",
        theme_color: "#0a0a0f",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/vite.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
          { src: "/vite.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      "/mikrotik": { target: "http://localhost:5000", changeOrigin: true },
      "/logos": { target: "http://localhost:5000", changeOrigin: true }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0L2NsaWVudFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvcHJvamVjdC9jbGllbnQvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvcHJvamVjdC9jbGllbnQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgaW5jbHVkZUFzc2V0czogW1widml0ZS5zdmdcIl0sXG4gICAgICB3b3JrYm94OiB7XG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsc3ZnLHBuZyx3b2ZmMn1cIl0sXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdvb2dsZWFwaXNcXC5jb21cXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJDYWNoZUZpcnN0XCIsXG4gICAgICAgICAgICBvcHRpb25zOiB7IGNhY2hlTmFtZTogXCJnb29nbGUtZm9udHNcIiwgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiA0LCBtYXhBZ2VTZWNvbmRzOiAzNjUgKiAyNCAqIDYwICogNjAgfSB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb21cXC8uKi9pLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJDYWNoZUZpcnN0XCIsXG4gICAgICAgICAgICBvcHRpb25zOiB7IGNhY2hlTmFtZTogXCJnb29nbGUtZm9udHMtc3RhdGljXCIsIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogNCwgbWF4QWdlU2Vjb25kczogMzY1ICogMjQgKiA2MCAqIDYwIH0gfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6IFwiTWlrcm9UaWsgQmlsbGluZ1wiLFxuICAgICAgICBzaG9ydF9uYW1lOiBcIk1USyBCaWxsaW5nXCIsXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIk1pa3JvVGlrIElTUCBCaWxsaW5nICYgTWFuYWdlbWVudCBQbGF0Zm9ybVwiLFxuICAgICAgICB0aGVtZV9jb2xvcjogXCIjMGEwYTBmXCIsXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzBhMGEwZlwiLFxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcbiAgICAgICAgb3JpZW50YXRpb246IFwicG9ydHJhaXQtcHJpbWFyeVwiLFxuICAgICAgICBzdGFydF91cmw6IFwiL1wiLFxuICAgICAgICBzY29wZTogXCIvXCIsXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAgeyBzcmM6IFwiL3ZpdGUuc3ZnXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9zdmcreG1sXCIsIHB1cnBvc2U6IFwiYW55XCIgfSxcbiAgICAgICAgICB7IHNyYzogXCIvdml0ZS5zdmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3N2Zyt4bWxcIiwgcHVycG9zZTogXCJhbnkgbWFza2FibGVcIiB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICAgIGRldk9wdGlvbnM6IHsgZW5hYmxlZDogZmFsc2UgfSxcbiAgICB9KSxcbiAgXSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBwcm94eToge1xuICAgICAgXCIvYXBpXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NTAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcbiAgICAgIFwiL21pa3JvdGlrXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NTAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcbiAgICAgIFwiL2xvZ29zXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NTAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThPLFNBQVMsb0JBQW9CO0FBQzNRLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFFeEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLFVBQVU7QUFBQSxNQUMxQixTQUFTO0FBQUEsUUFDUCxjQUFjLENBQUMsa0NBQWtDO0FBQUEsUUFDakQsZ0JBQWdCO0FBQUEsVUFDZDtBQUFBLFlBQ0UsWUFBWTtBQUFBLFlBQ1osU0FBUztBQUFBLFlBQ1QsU0FBUyxFQUFFLFdBQVcsZ0JBQWdCLFlBQVksRUFBRSxZQUFZLEdBQUcsZUFBZSxNQUFNLEtBQUssS0FBSyxHQUFHLEVBQUU7QUFBQSxVQUN6RztBQUFBLFVBQ0E7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVMsRUFBRSxXQUFXLHVCQUF1QixZQUFZLEVBQUUsWUFBWSxHQUFHLGVBQWUsTUFBTSxLQUFLLEtBQUssR0FBRyxFQUFFO0FBQUEsVUFDaEg7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLFFBQ2IsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFVBQ0wsRUFBRSxLQUFLLGFBQWEsT0FBTyxXQUFXLE1BQU0saUJBQWlCLFNBQVMsTUFBTTtBQUFBLFVBQzVFLEVBQUUsS0FBSyxhQUFhLE9BQU8sV0FBVyxNQUFNLGlCQUFpQixTQUFTLGVBQWU7QUFBQSxRQUN2RjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFlBQVksRUFBRSxTQUFTLE1BQU07QUFBQSxJQUMvQixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLE1BQzlELGFBQWEsRUFBRSxRQUFRLHlCQUF5QixjQUFjLEtBQUs7QUFBQSxNQUNuRSxVQUFVLEVBQUUsUUFBUSx5QkFBeUIsY0FBYyxLQUFLO0FBQUEsSUFDbEU7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
