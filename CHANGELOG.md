# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

Planned work, in rough order:

- Migrate to a Vite + React + TypeScript project with a component structure
  (removes in-browser Babel and the Tailwind CDN, and allows a strict
  Content Security Policy)
- Add automated tests (Vitest, Playwright) and a GitHub Actions deploy for the
  Worker and the site
- Add rate limiting to the Worker and Firebase App Check
- Add export and import for backups
- Add accounts and households as an alternative to room codes

## [0.2.0] - 2026-11-11

Adds a recipe URL scanner, local Fred Meyer price estimates and live sync.
The app is still a single `index.html` on GitHub Pages. A small Cloudflare Worker
(`worker/`) holds the pieces that need a secret or can't run in the browser.

### Added

- Recipe URL scanner: paste a link and tap Scan to fill in the recipe name,
  ingredients and prep notes. The Worker reads the page's structured recipe data,
  splits quantities from ingredient names, and numbers the steps
- Scanned recipes keep their source link, shown at the bottom of the recipe view
- Fred Meyer price estimates in the recipe view, under Prep notes: enter a ZIP
  code once, choose a store, and each ingredient is matched to a product
  - Uses the Kroger Developer API through the Worker, so the client secret never
    reaches the browser
  - Picks the cheapest match per unit (using sale prices) from the top search
    results, since the Kroger API has no sort-by-price option
  - Prorates cost by the amount a recipe uses when units match, and counts a
    whole package otherwise (marked with *)
  - Prices are cached for 24 hours per store and ingredient, so they refresh daily
- Live sync with Firebase (Firestore and anonymous sign-in):
  - Start sharing to get a 12-character room code, or join with a code
  - Changes appear on every connected device within a moment
  - Joining keeps the shared menus and adds recipes and combos that only the
    joining device has, and saves a backup copy in the browser first
  - Firestore security rules block listing and deleting rooms and cap document size
- Shopping day bookmark on This Week: the shopping list now covers meals from the
  bookmarked day onward plus all of Next Week, and is also available from This Week
- Combos: group several dishes into one block that can be added to a menu
- Copy and paste for meals between slots and days
- Cooked history on each recipe, counted automatically once a meal's day has passed
- Quantities display as fractions (1/3 cup), while saved values stay decimal so
  the shopping list can add them correctly

### Changed

- All popups are capped at 90% of the screen height and scroll when their content
  is long; long words and links wrap instead of stretching the popup
- The How to Use guide is reorganized into four sections and covers the new features
- Scanned quantities are rounded to two decimal places (for example 1/3 becomes 0.33)

### Known limitations

- Sync uses last-write-wins for the whole planner, so two people editing at the
  same instant can overwrite each other
- Anyone with a room code can view and edit that planner
- Price estimates depend on search matching and unit conversion, so they can be
  off, and vague ingredients may match the wrong product
- The scanner only works on pages that publish structured recipe data
- The Worker is public and has no rate limiting yet

## [0.1.0] - 2026-11-10

First public prototype: a single-file React app hosted on GitHub Pages.

### Added

- Four tabs: This Week, Next Week, Add Recipe and Recipe Book
- Weekly planner (Monday to Sunday) with Breakfast, Lunch, Dinner and Snacks slots
- Automatic rollover: next week's menu becomes this week's on Monday
- Drag and drop to move meals between days and slots (mouse and touch)
- Add-meal popup with a searchable recipe field that also accepts custom meals
- Meal edit popup with a link to the meal's recipe and a full recipe view popup
- One-click meal removal with a trash icon, the Delete key, and a timed undo
- Shopping list built from next week's recipes, with check-off, copy and print
- Printable view of This Week's Menu
- Recipe Book with square cards, search (name, ingredient or tag), view, edit,
  delete with confirmation, and a new recipe tile
- Favorite stars, with favorites listed first
- Custom tags with rounded pills, tag suggestions and a tag filter popup
- Add Recipe form with ingredients, quantities and prep notes
- Automatic draft saving so unfinished recipes are not lost
- Editable household names in the header
- Light and dark themes with a toggle in the tab bar
- Data persistence in the browser with localStorage
- Collapsible How to Use guide

### Changed

- Weekly grid lays out days as columns and fills the screen so the whole week fits
  on typical displays, with sideways scrolling on narrow screens
- Palette set to a sage background (#cad4ba) with muted borders (#7f8475)
- Header made compact to give the menu more room

### Fixed

- Meals can now be dragged on both weekly tabs (the move handler was not connected)
- Removed a stray scrollbar from the tab bar

### Known limitations

- Data lives in one browser only; there is no sync or backup yet
- The recipe URL scanner is a placeholder and does not fetch pages
- Printing relies on the browser's print dialog
- Phones in portrait scroll sideways to see all seven days
