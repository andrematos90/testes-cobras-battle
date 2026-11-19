import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento (npm run dev) o WebSocket é encaminhado para o servidor local na porta 3000.
export default defineConfig({ plugins: [react()], server: { proxy: { "/ws": { target: "ws://localhost:3000", ws: true } } } });
