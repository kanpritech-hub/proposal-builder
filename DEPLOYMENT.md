# Vercel frontend deployment

The included `vercel.json` explicitly builds the Vite frontend and serves `dist`.
It fixes frontend build/output selection and enables SPA page refreshes. It does
not deploy the Express backend in `server.ts`.

1. Upload/commit `vercel.json` and the updated `package.json` alongside `index.html`.
2. In Vercel > Project Settings > Build and Deployment, select the folder that
   contains those files as **Root Directory**. If GitHub contains a nested
   `proposal-builder-main` folder, select it. If `package.json` is already at the
   repository root, leave Root Directory empty. The outer downloaded ZIP folder
   on your computer does not determine the GitHub root.
3. Use **Framework Preset: Vite**, **Build Command: npm run build:frontend**, and
   **Output Directory: dist**. The checked-in configuration supplies these values.
4. Redeploy the latest production commit. Confirm the build log reports a
   successful Vite build and that the deployment's own Visit URL opens before
   checking the project's production domain.
5. If that Visit URL opens but the production domain returns 404, check the
   domain assignment and promote the intended deployment to Production.

## Backend required for shared team data

The frontend calls `/api/*` for proposals, settings, marketing data, login and AI
parsing. `npm start` launches the existing Express server on a conventional Node
host; a Vercel static deployment does not run that start script. The SPA rewrite
deliberately excludes `/api` so missing backend routes do not return HTML as JSON.

The current backend creates and updates `data/*.json` under its working directory.
Do not move those files to Vercel's `/tmp` as a persistence workaround: temporary
function storage will not retain or reliably share your team's proposals.

Before using the Vercel deployment for saved team work, provide either:

- An existing Express backend on a Node host with persistent storage, then proxy
  `/api/*` to that backend; or
- Vercel Functions for the Express API plus a durable database, replacing the
  filesystem reads and writes.

Keep `GEMINI_API_KEY` on the backend. Do not prefix it with `VITE_` or include it
in client-side code.

References: https://vercel.com/docs/frameworks/frontend/vite and
https://vercel.com/docs/frameworks/backend/express.
