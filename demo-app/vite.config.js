import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		cssCodeSplit: false, // Ensure CSS is bundled together for consistency
	},
	css: {
		devSourcemap: true // Help with debugging CSS issues
	}
});
