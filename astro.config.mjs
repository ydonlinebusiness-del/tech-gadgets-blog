// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// ← Update this to your real domain once deployed!
	site: 'https://techpickr.com',
	integrations: [
		mdx(),
		sitemap({
			// Make sure ALL pages are in the sitemap for SEO + GEO indexing
			changefreq: 'weekly',
			priority: 0.7,
			lastmod: new Date(),
		}),
	],
	// Performance: enable asset compression
	build: {
		inlineStylesheets: 'auto',
	},
});
