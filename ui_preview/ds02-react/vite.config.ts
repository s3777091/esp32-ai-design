import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for the DS-02 React preview.
// Uses the @/* alias so components can import from "@/lib/utils" /
// "@/components/ui/..." the way shadcn expects.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
