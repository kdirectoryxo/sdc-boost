# Free Privacy Policy Hosting Options

Your privacy policy is ready at `public/privacy-policy.html`. Here are several free ways to host it:

## Option 1: GitHub Pages (Recommended - Easiest)

### If you already have a GitHub repository:

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Add privacy policy"
   git push
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Choose branch: `main` (or `master`)
   - Choose folder: `/public` (or `/docs` if you move the file)
   - Click **Save**

3. **Your privacy policy will be available at:**
   ```
   https://yourusername.github.io/sdc-boost/privacy-policy.html
   ```

### If you don't have a GitHub repository:

1. Create a new repository on GitHub
2. Upload the `public/privacy-policy.html` file
3. Enable GitHub Pages as above

---

## Option 2: Netlify Drop (Easiest - No Account Needed)

1. Go to https://app.netlify.com/drop
2. Drag and drop the `public` folder (or just the `privacy-policy.html` file)
3. Netlify will give you a URL like: `https://random-name-123.netlify.app/privacy-policy.html`
4. **Note:** Free sites may go to sleep after inactivity, but you can create a free account to keep it active

---

## Option 3: Vercel (Fast & Reliable)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   cd public
   vercel
   ```

3. Follow the prompts (it's free and easy!)
4. Your privacy policy will be at: `https://your-project.vercel.app/privacy-policy.html`

---

## Option 4: Cloudflare Pages (Free & Fast)

1. Go to https://pages.cloudflare.com/
2. Sign in with your Cloudflare account (free)
3. Connect your GitHub repository OR upload files directly
4. Deploy from the `public` folder
5. Your site will be live at: `https://your-project.pages.dev/privacy-policy.html`

---

## Option 5: Simple HTML Hosting Services

### Surge.sh (Free)
```bash
npm install -g surge
cd public
surge
# Follow prompts - you'll get a URL like: https://your-name.surge.sh/privacy-policy.html
```

### Firebase Hosting (Free)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run `firebase init hosting`
3. Deploy: `firebase deploy --only hosting`
4. Your URL: `https://your-project.web.app/privacy-policy.html`

---

## Quick Setup Script (GitHub Pages)

If you want to use GitHub Pages, I can help you set it up. Just let me know if you want me to:
1. Create a `.github/workflows` file for automatic deployment
2. Move the privacy policy to a `docs` folder (GitHub Pages standard)
3. Create a simple index page

---

## Recommended Approach

**For Chrome Web Store:** I recommend **GitHub Pages** because:
- ✅ Free forever
- ✅ Reliable (no downtime)
- ✅ Easy to update (just push changes)
- ✅ Professional URL
- ✅ No account expiration issues

**Quick GitHub Pages Setup:**
1. Move `public/privacy-policy.html` to `docs/privacy-policy.html`
2. Push to GitHub
3. Enable Pages in Settings → Pages → Source: `/docs`
4. Use URL: `https://yourusername.github.io/sdc-boost/privacy-policy.html`

---

## After Hosting

Once you have your privacy policy URL, add it to your Chrome Web Store listing:
- **Privacy Policy URL:** `https://your-url.com/privacy-policy.html`

The Chrome Web Store requires this field for extensions that handle user data (even if it's just local storage).

