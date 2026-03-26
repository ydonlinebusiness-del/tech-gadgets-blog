// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://tech-gadgets-blog.vercel.app',

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

  vite: {
    plugins: [tailwindcss()],
  },
});