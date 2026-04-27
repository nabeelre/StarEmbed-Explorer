import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages, the site is served from /<repo-name>/. Pass BASE_PATH
// at build time to set this. The deploy workflow does this automatically.
//   BASE_PATH=/my-repo/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || "/",
});
