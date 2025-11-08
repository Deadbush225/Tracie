import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		svelte({
			// Restore Svelte 4-compatible component API when needed by older code
			compilerOptions: {
				compatibility: {
					componentApi: 4,
				},
			},
		}),
	],
});
