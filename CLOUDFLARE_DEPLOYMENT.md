# Cloudflare Deployment

These commands must be run from the project folder:

```powershell
cd "C:\Users\Dell\Documents\New project\GymAssistAi"
npm install
npm run cf:build
npm run preview
```

When the preview looks good, deploy with:

```powershell
npm run cf:deploy
```

Do not paste these TypeScript lines into PowerShell:

```ts
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig();
```

They belong in `open-next.config.ts`, which is already created in this project.

Before deploying, add the production environment variables and secrets in Cloudflare Workers:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `SESSION_SECRET`

If Cloudflare asks you to log in, run:

```powershell
npx wrangler login
```

For local Cloudflare preview, create a `.dev.vars` file beside `package.json`.
Wrangler reads this file when running `npm run preview`.
