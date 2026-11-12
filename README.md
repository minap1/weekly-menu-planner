# Menu Planner + Recipe Book

A weekly meal planner and recipe book built with React. Plan breakfast, lunch,
dinner and snacks, keep a library of recipes, import recipes from a link, estimate
what a recipe costs at your local Fred Meyer, and share the planner live with
another person.

**Live demo:** https://minap1.github.io/weekly-menu-planner/

> Status: prototype (v0.2.0). See the [changelog](CHANGELOG.md) and the roadmap below.

## Features

- Plan this week and next week, with automatic rollover on Monday
- Drag and drop meals between days and slots; copy and paste meals
- Recipe Book with search, favorites, custom tags, tag filtering and cooked history
- Combos that group several dishes into one block
- **Recipe scanner:** paste a recipe link to fill in the name, ingredients and
  prep notes; the source link is kept with the recipe
- **Price estimates:** pick your Fred Meyer store by ZIP code and see an estimated
  cost per recipe, using the cheapest matching product per unit
- **Live sync:** share one planner between devices with a private room code
- **Shopping list:** built from a bookmarked shopping day onward plus all of Next
  Week, with check-off, copy and print
- Quantities shown as fractions
- Printable weekly menu, draft saving, light and dark themes
- Works on desktop and mobile

## Architecture

```
GitHub Pages (index.html, React 18 + Tailwind from CDNs)
   |-- Cloudflare Worker (worker/)      scanner and price lookups
   |       |-- recipe pages             reads schema.org Recipe data
   |       |-- Kroger Developer API     product search and store locator
   |       '-- Workers KV               24-hour price cache
   '-- Firebase                         live sync
           |-- Anonymous Auth
           '-- Firestore                one document per room code
```

The page stays a single static file. Anything that needs a secret or would be
blocked by browser CORS rules goes through the Worker. `localStorage` is still the
offline copy of the planner.

## Tech

- React 18 (CDN, JSX compiled in the browser by Babel Standalone)
- Tailwind CSS (CDN) plus custom CSS variables for theming
- Cloudflare Workers and KV (free tier) for the scanner and price proxy
- Kroger Developer API (Products and Locations) for local Fred Meyer prices
- Firebase Auth (anonymous) and Firestore (free tier) for sync
- Hosted on GitHub Pages

## Running locally

Open `index.html` in a browser, or serve the folder:

```
npx serve -l 8000 .
```

The scanner, prices and sync are optional. Without configuration the app runs
entirely in the browser.

## Setup for the optional features

### Scanner and prices (Cloudflare Worker)

1. Create a Kroger developer app (Production, `product.compact` scope) for a client
   ID and secret.
2. From the `worker/` folder:
   ```
   npx wrangler kv namespace create CACHE      # paste the id into wrangler.toml
   npx wrangler secret put KROGER_ID
   npx wrangler secret put KROGER_SECRET
   npx wrangler deploy
   ```
3. Set `ALLOWED_ORIGINS` in `wrangler.toml` to your site's origin.
4. Set `WORKER_URL` near the top of the script in `index.html` to the deployed URL.

### Live sync (Firebase)

1. Create a Firebase project and add a Web app. Paste its config object into
   `FIREBASE_CONFIG` in `index.html`. The web API key is not a secret.
2. Enable Anonymous sign-in and create a Firestore database in production mode.
3. Publish these security rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rooms/{room} {
         allow get: if request.auth != null;
         allow create, update: if request.auth != null
           && room.size() == 12
           && request.resource.data.keys().hasOnly(['data','by','updatedAt'])
           && request.resource.data.data is string
           && request.resource.data.data.size() < 900000;
         allow list, delete: if false;
       }
     }
   }
   ```
4. In Google Cloud Console, restrict the browser API key to your site's HTTP referrer.

Never commit the Kroger secret, Cloudflare tokens or any Firebase service account key.

## Data and privacy

- The planner is stored in your browser's `localStorage` under keys beginning with
  `menuPlanner`. Clearing site data removes it.
- If you turn on sync, the whole planner is also stored in Firestore under your
  room code. Anyone with the code can view and edit it, so share it privately.
- Your chosen store is saved in your browser only. ZIP codes are sent to the Worker
  to find stores and are not stored.
- Price and scan requests go through the Worker, which caches prices for 24 hours.

## Known limitations

- Sync is last-write-wins for the whole planner
- Price estimates depend on product search matching and unit conversion
- The scanner needs pages that publish structured recipe data
- The Worker has no rate limiting yet

## Roadmap

1. Migrate to Vite, React and TypeScript with a component structure
2. Add tests (Vitest, Playwright) and a GitHub Actions deploy
3. Add Worker rate limiting and Firebase App Check
4. Add export and import backups
5. Add accounts and households as an alternative to room codes

## About this project

I designed the features and layout and directed the build. The prototype was
developed with AI assistance (Claude), and the changelog records how it evolved.
The larger-scope work above is planned as a regular React project.

## License

Add a license file (for example MIT) before accepting contributions.
