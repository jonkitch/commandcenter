# ⬡ Command Center

Jonathan Kitchens' personal business operations dashboard.
Password-protected. Do not share the URL publicly.

---

## Deploy to Netlify (step-by-step)

### 1. Get your environment variables ready

**Anthropic API Key**
- Go to console.anthropic.com → API Keys → Create Key
- Copy it (starts with `sk-ant-...`)

**Password Hash**
- Open any browser → press F12 → Console tab → paste this, replace `yourpassword`:
```js
const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
console.log([...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''))
```
- Copy the long hex string that appears

---

### 2. Push to GitHub

```bash
# Clone or download this folder, then:
cd command-center
git init
git add .
git commit -m "initial deploy"

# Create a new PRIVATE repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/command-center.git
git push -u origin main
```

> ⚠️ Make the GitHub repo **Private** so your code isn't public.

---

### 3. Connect to Netlify

1. Go to **app.netlify.com** → Add new site → Import an existing project
2. Choose **GitHub** → Select your `command-center` repo
3. Build settings (auto-detected from netlify.toml):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site**

---

### 4. Add environment variables

In Netlify: **Site Settings → Environment Variables → Add variable**

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (your key) |
| `VITE_APP_PASS_HASH` | (your SHA-256 hash from step 1) |

Then: **Deploys → Trigger deploy → Deploy site** to apply the new variables.

---

### 5. Connect Todoist (inside the app)

1. Go to **todoist.com → Settings → Integrations → Developer → API token**
2. Regenerate and copy your token
3. In the Command Center, click **"⚙ Setup Todoist"**
4. Paste token → Connect → Map each business to a Todoist project → Save

---

### 6. Custom domain (optional)

In Netlify: **Domain settings → Add custom domain**
Example: `hub.jonathankitchens.com`

---

## Local development

```bash
npm install
npm run dev
# Visit http://localhost:5173
```

> In local dev, `VITE_APP_PASS_HASH` won't be set, so any password works.
> Add a local `.env` file (never commit it) with your vars for full local testing.

---

## Security notes

- GitHub repo should be **Private**
- Netlify env vars are server-side only — your API key is never exposed to the browser
- Password is checked via SHA-256 hash — plaintext never stored anywhere
- Sessions expire after 12 hours automatically
- `<meta name="robots" content="noindex">` prevents search engine indexing
- The 🔒 button in the top bar manually locks the session
