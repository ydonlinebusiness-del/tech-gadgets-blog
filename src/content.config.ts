import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			// Content classification
			tags: z.array(z.string()).default([]),
			category: z.string().default('Reviews'),
			// Affiliate
			affiliateDisclaimer: z.boolean().default(true),
			// Pinterest tracking
			pinterestPinned: z.boolean().default(false),
			// GEO / AI-optimization hint (optional structured data override)
			productName: z.string().optional(),
			productBrand: z.string().optional(),
			productPriceRange: z.string().optional(), // e.g. "$50-$100"
		}),
});

export const collections = { blog };
