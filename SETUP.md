# Quorum — Setup Guide

Complete step-by-step instructions to go from zero to a working Teams meeting extension.

---

## Prerequisites

- A Microsoft 365 account with Teams (work/school or developer tenant)
- A [Vercel](https://vercel.com) account (free tier works)
- A [Supabase](https://supabase.com) account (free tier works)
- An [Azure portal](https://portal.azure.com) account (same Microsoft account as Teams)

---

## Step 1 — Create Azure AD App Registration

Azure gives your app a unique identity that Teams trusts.

1. Go to [portal.azure.com](https://portal.azure.com) and sign in.
2. Search for **"App registrations"** in the top bar and open it.
3. Click **"New registration"**.
4. Fill in:
   - **Name:** `Quorum`
   - **Supported account types:** `Accounts in any organizational directory (Any Azure AD directory - Multitenant)`
   - **Redirect URI:** leave blank for now
5. Click **Register**.
6. On the overview page, copy the **Application (client) ID** — this is your `YOUR_AZURE_AD_APP_ID`.
7. You do **not** need a client secret for this app (no server-side auth flow).

---

## Step 2 — Create Supabase Project and Run Schema

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **"New project"**, choose your organization, give it a name (e.g. `quorum`), set a strong database password, and pick a region close to your users.
3. Wait for the project to provision (~1 minute).
4. In the left sidebar, click **"SQL Editor"**.
5. Click **"New query"** and paste the following schema, then click **Run**:

```sql
CREATE TABLE votes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id text NOT NULL,
  user_id    text NOT NULL,
  vote_type  text NOT NULL CHECK (vote_type IN ('end', 'remove')),
  nominee_id text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (meeting_id, user_id, vote_type)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read" ON votes FOR SELECT TO anon USING (true);
```

6. In the left sidebar, go to **Project Settings > API**.
7. Copy these two values — you will need them shortly:
   - **Project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`) — this is `SUPABASE_URL`
   - **anon / public** key — this is `SUPABASE_ANON_KEY`
   - **service_role** key — this is `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server-side only)

8. To enable Realtime for the `votes` table:
   - Go to **Database > Replication** in the sidebar.
   - Under "Source", find the `votes` table and toggle it **on**.

---

## Step 3 — Deploy to Vercel

1. Push this repository to GitHub (or connect it directly from your local machine).
2. Go to [vercel.com](https://vercel.com), click **"Add New Project"**, and import your repo.
3. Leave all build settings at their defaults (no build step needed).
4. Under **"Environment Variables"**, add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Your Supabase Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |

   > The `SUPABASE_ANON_KEY` is public and goes in `app/index.html` (Step 4), not here.

5. Click **Deploy**. Once done, note your deployment URL — e.g. `https://quorum-abc123.vercel.app`.
   This is `YOUR_VERCEL_URL` and `YOUR_VERCEL_DOMAIN` (without `https://`).

---

## Step 4 — Fill in Client Constants

Open `/app/index.html` and find this block near the bottom:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Replace both placeholder strings with your actual values from Step 2.

Commit and push — Vercel will redeploy automatically.

---

## Step 5 — Update manifest.json

Open `/manifest/manifest.json` and replace all placeholder values:

| Placeholder | Replace with |
|---|---|
| `YOUR_AZURE_AD_APP_ID` | The Application (client) ID from Step 1 |
| `YOUR_VERCEL_URL` | Your full Vercel URL, e.g. `https://quorum-abc123.vercel.app` |
| `YOUR_VERCEL_DOMAIN` | Just the domain, e.g. `quorum-abc123.vercel.app` |

---

## Step 6 — Create App Icons

Teams requires two icon files inside the `manifest/` folder:

| File | Size | Purpose |
|---|---|---|
| `color.png` | 192 × 192 px | Full-color app icon |
| `outline.png` | 32 × 32 px | White outline on transparent background |

**Quick option — use an online tool:**
1. Go to [canva.com](https://canva.com) or any image editor.
2. Create a 192×192 image with a purple (#6264A7) background and a white scale/gavel emoji or "Q" lettermark.
3. Export as `color.png` and save to `manifest/color.png`.
4. Create a 32×32 white icon on a transparent background, export as `manifest/outline.png`.

**Requirements:**
- Both must be PNG format.
- `color.png` should have a colored (non-transparent) background.
- `outline.png` must use only white pixels on a transparent background.

---

## Step 7 — Create the App Package ZIP

Teams requires a `.zip` containing exactly three files at the root level (no subfolder):

```
manifest.json
color.png
outline.png
```

On macOS/Linux:
```bash
cd /path/to/teams/manifest
zip quorum.zip manifest.json color.png outline.png
```

On Windows (PowerShell):
```powershell
Compress-Archive -Path manifest\manifest.json, manifest\color.png, manifest\outline.png -DestinationPath quorum.zip
```

---

## Step 8 — Upload to Teams Developer Portal

1. Go to [dev.teams.microsoft.com](https://dev.teams.microsoft.com) and sign in.
2. Click **"Apps"** in the left sidebar, then **"Import app"**.
3. Upload your `quorum.zip`.
4. Review the app details — confirm icons, descriptions, and URLs look correct.
5. Click **"Publish to org"** (to publish to your organization) or proceed to sideloading for testing (Step 9).

---

## Step 9 — Sideload for Testing

Sideloading lets you test the app in Teams without publishing it org-wide.

**Enable sideloading (admin required — skip if already enabled):**
1. Go to [admin.teams.microsoft.com](https://admin.teams.microsoft.com).
2. Navigate to **Teams apps > Setup policies > Global**.
3. Toggle **"Upload custom apps"** to **On** and save.
4. Wait up to 24 hours for the policy to propagate (often faster).

**Sideload the app:**
1. Open Microsoft Teams (desktop or web).
2. Go to **Apps** (left sidebar) > **"Manage your apps"** > **"Upload an app"**.
3. Choose **"Upload a custom app"** and select your `quorum.zip`.
4. The app will appear in your apps list.

**Add Quorum to a meeting:**
1. Schedule a new Teams meeting or open an existing one.
2. In the meeting, click the **"+"** (Add apps) icon in the meeting toolbar.
3. Search for **Quorum** and add it.
4. The Quorum side panel will appear for all participants when they open it.

---

## Troubleshooting

**Panel shows "Connecting to Quorum…" indefinitely**
- Check browser console for errors.
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly in `app/index.html`.
- Confirm you deployed after filling in the constants.

**API votes not persisting**
- Check Vercel Function logs in the Vercel dashboard under your project > Deployments > Functions.
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set as Vercel environment variables.

**Realtime votes not updating for other participants**
- Confirm the `votes` table has Replication enabled in Supabase (Step 2, item 8).
- Check that the Supabase project region and anon key match what's in `app/index.html`.

**Manifest upload fails validation**
- Ensure `YOUR_AZURE_AD_APP_ID` is a valid GUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
- Confirm both icon files exist and are the correct dimensions.
- Validate your manifest at [dev.teams.microsoft.com/validation](https://dev.teams.microsoft.com/validation).

**"App not found" when adding to meeting**
- It can take a few minutes after upload for the app to appear in search.
- Try searching by exact name "Quorum".
- Make sure sideloading is enabled for your tenant.
