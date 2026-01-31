# 🚀 Deployment Guide

This guide will help you deploy the Agent Builder app to the cloud.

## Quick Deploy Options

| Platform | Difficulty | Free Tier | Best For |
|----------|------------|-----------|----------|
| **Render** | Easy ⭐ | ✅ Yes | Recommended for this project |
| Vercel | Easy | ✅ Yes | Frontend only |
| Railway | Easy | ✅ Limited | Full-stack |
| AWS | Hard | ⚠️ Limited | Enterprise |

---

## 🎯 Deploy to Render (Recommended)

### Step 1: Prepare Your Repository

1. **Commit all changes to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Make sure your `.env` is NOT committed** (it's in `.gitignore`)

### Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Authorize Render to access your repository

### Step 3: Deploy the App

#### Option A: Automatic (Blueprint)
1. Click **New** → **Blueprint**
2. Select your repository
3. Render will detect `render.yaml` and configure automatically

#### Option B: Manual Setup
1. Click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `agent-builder`
   - **Region:** Singapore (or nearest to you)
   - **Branch:** `main`
   - **Root Directory:** (leave empty)
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`

### Step 4: Add Environment Variables

In Render dashboard, go to **Environment** tab and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | Your Gemini API key |
| `SUPABASE_URL` | Your Supabase URL |
| `SUPABASE_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `VITE_SUPABASE_URL` | Same as SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Same as SUPABASE_KEY |

Optional (for file storage):
- `SUPABASE_STORAGE_ENDPOINT`
- `SUPABASE_STORAGE_BUCKET`
- `SUPABASE_STORAGE_ACCESS_KEY`
- `SUPABASE_STORAGE_SECRET_KEY`

### Step 5: Deploy!

1. Click **Create Web Service**
2. Wait for build to complete (5-10 minutes)
3. Your app will be live at: `https://agent-builder-xxxx.onrender.com`

---

## 🔧 Troubleshooting

### Build Fails
- Check the build logs in Render dashboard
- Make sure all dependencies are in `package.json`
- Verify Node version compatibility

### App Crashes on Start
- Check environment variables are set correctly
- View logs: Dashboard → Logs tab
- Ensure `npm start` works locally first

### API Calls Fail
- Verify all API keys are set
- Check CORS is properly configured
- Look for errors in the Logs tab

---

## 📝 Important Notes

1. **Free Tier Limitations:**
   - App sleeps after 15 minutes of inactivity
   - First request after sleep takes ~30 seconds (cold start)
   - Limited to 750 hours/month

2. **Your Supabase is Already Cloud-Based!**
   - No need to deploy the database
   - Just copy the same keys you use locally

3. **API Keys:**
   - Never commit `.env` files
   - Add keys directly in Render dashboard

---

## 🔄 Auto-Deploy

Render automatically redeploys when you push to `main`:
```bash
git add .
git commit -m "Fix something"
git push
# Render auto-deploys!
```

---

## 📊 Monitoring

- **Logs:** Dashboard → Your Service → Logs
- **Metrics:** Dashboard → Your Service → Metrics
- **Health Check:** `https://your-app.onrender.com/api/health`
