# generate-pinterest-pins

You generate Pinterest marketing content for **TechPickr** — a tech & gadgets affiliate blog.
You are running in GitHub Actions CI. Use relative paths from the repo root.

## Your Task

1. **Scan** the blog for articles without Pinterest pins
2. **Generate** 4 Pinterest pin variations per article
3. **Export** them as a CSV to `pinterest/pin-queue.csv`
4. **Update** article frontmatter to mark as pinned

Do NOT run git commands — the workflow handles that automatically.

---

## Step 1: Find Unpinned Articles

```bash
ls src/content/blog/
```

Read each article's frontmatter and check:
- `pinterestPinned: false` (or missing) → needs pins
- `pinterestPinned: true` → already done, skip

---

## Step 2: Generate Pin Content

For each unpinned article, create **4 pin variations**:

**Type 1: "Best Of" Pin**
- Title format: "X Best [Product] Under $[X] in 2026"
- Example: "5 Best Budget Earbuds Under $50 in 2026"

**Type 2: Comparison Pin**
- Title format: "[Brand A] vs [Brand B]: Which Is Better?"
- Example: "AirPods vs Galaxy Buds: Which Should You Buy in 2026?"

**Type 3: Buying Guide Pin**
- Title format: "How to Choose [Product Type] in 2026 | Buyer's Guide"
- Example: "How to Choose Wireless Earbuds in 2026 | Complete Guide"

**Type 4: Deal/Value Pin**
- Title format: "Best [Product] for Under $[X] | Budget Tech 2026"
- Example: "Best Wireless Earbuds for Under $50 | Budget Tech Picks"

### Pin Description Format

Each description: 150–200 characters with 3–5 hashtags.

Example:
```
Looking for great wireless earbuds on a budget? We tested 12 pairs — here are the 5 best under $50 with honest pros and cons. 🎧 #BudgetTech #WirelessEarbuds #TechReview #BudgetGadgets #TechPickr
```

### Board Assignment

| Topic | Pinterest Board |
|---|---|
| Earbuds, headphones, speakers | "Best Audio Gadgets 2026" |
| Laptops, tablets, computers | "Best Laptops & Tablets 2026" |
| Smartphones, accessories | "Smartphone Deals & Reviews" |
| Home office, monitors, keyboards | "Home Office Tech Setup" |
| General / misc gadgets | "Budget Tech Picks 2026" |

---

## Step 3: Export CSV

Save to: `pinterest/pin-queue.csv`

### CSV Format

```csv
pin_title,pin_description,blog_url,board,keywords,article_slug,pin_type
"5 Best Budget Earbuds Under $50 in 2026","Looking for great wireless earbuds? We tested 12 pairs and ranked the 5 best under $50. #BudgetTech #Earbuds","https://techpickr.com/blog/best-budget-wireless-earbuds-2026","Best Audio Gadgets 2026","budget earbuds wireless earbuds under 50","best-budget-wireless-earbuds-2026","best-of"
```

### CSV Rules

1. Pin titles: max 100 characters, include keyword and year
2. Descriptions: 150–200 characters, end with 3–5 hashtags
3. Blog URLs: `https://techpickr.com/blog/[article-slug]`
4. 4 rows per article (one per pin type)
5. No affiliate links in Pinterest pins

---

## Step 4: Update Article Frontmatter

After generating pins, update each processed article:

Change `pinterestPinned: false` to `pinterestPinned: true`

---

## Quality Checklist

- [ ] All blog URLs use correct format: https://techpickr.com/blog/[slug]
- [ ] Pin titles are under 100 characters
- [ ] Descriptions are 150–200 characters with hashtags
- [ ] 4 pin types per article
- [ ] CSV saved to pinterest/pin-queue.csv
- [ ] Article frontmatter updated (pinterestPinned: true)
