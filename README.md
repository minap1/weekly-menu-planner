# Menu Planner + Recipe Book

A weekly meal planner and recipe book built with React. Plan breakfast, lunch,
dinner and snacks for the week, keep a library of recipes with tags and favorites,
and turn next week's menu into a shopping list.

**Live demo:** https://github.com/minap1/weekly-menu-planner

> Status: prototype (v0.1.0). See the [changelog](CHANGELOG.md) and the roadmap below.

## Features

- Plan this week and next week, with automatic rollover on Monday
- Drag and drop meals between days and slots
- Recipe Book with search, favorites, custom tags and tag filtering
- Shopping list from planned recipes, with copy and print
- Printable weekly menu
- Draft saving for unfinished recipes
- Light and dark themes
- Works on desktop and mobile

## Tech

- React 18 (loaded from a CDN, JSX compiled in the browser by Babel Standalone)
- Tailwind CSS (CDN) plus custom CSS variables for theming
- Browser localStorage for persistence
- Hosted on GitHub Pages

## Running locally

There is no build step in the prototype. Open `index.html` in a browser, or serve the
folder with any static server:

```
npx serve .
```

## Data

All data is stored in your browser's localStorage under keys beginning with
`menuPlanner`. It is private to one browser and is not synced. Clearing site data
removes it.

## Roadmap

1. Migrate to Vite, React and TypeScript with a component structure
2. Add tests (Vitest, Playwright) and a GitHub Actions deploy
3. Add Supabase accounts and move storage to Postgres with row-level security
4. Add households, invites, recipe merging and shared menus
5. Add a recipe URL scanner as a serverless function
6. Add export and import backups

## About this project

I designed the features and layout and directed the build. The prototype was
developed with AI assistance (Claude), and the changelog records how it evolved.
The larger-scope work above is being built as a regular React project.

## License

Add a license file (for example MIT) before accepting contributions.
