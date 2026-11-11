# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

Planned work, in rough order:

- Migrate to a Vite + React + TypeScript project with a component structure
- Add automated tests (Vitest, Playwright) and a GitHub Actions deploy
- Add Supabase sign-in and move storage from localStorage to Postgres
- Add households, invite codes, recipe merging and shared menus
- Add a recipe URL scanner as a serverless function
- Add export and import for backups

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
