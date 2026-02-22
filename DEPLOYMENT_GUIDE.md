# Render Deployment Guide

I have already prepared your code for deployment by adding the necessary scripts and a `render.yaml` blueprint. Since this involves your Render and GitHub accounts, you will need to perform a few final steps.

## Option 1: Assistant-Assisted (Browser)
If you want me to help you through the browser, follow these steps:
1. **Push your changes**: Run `git push origin master` (or your main branch) in your terminal.
2. **Open Render**: Tell me to "Open Render dashboard in the browser".
3. **Setup**: I will guide you through connecting your repo. *Note: You will need to log in yourself when the browser opens.*

## Option 2: Manual Setup (Recommended)
Follow these steps to deploy using the blueprint I created:

1. **Commit and Push**:
   ```bash
   git add .
   git commit -m "chore: prepare for render deployment"
   git push origin master
   ```

2. **Login to Render**: Go to [dashboard.render.com](https://dashboard.render.com).

3. **Deploy with Blueprint**:
   - Click **New** -> **Blueprint**.
   - Connect your GitHub repository.
   - Render will automatically detect the `render.yaml` file I created.
   - Click **Approve**.

4. **Add Environment Variables**:
   In the Render dashboard, go to your new Web Service's **Environment** tab and ensure these keys from your `.env.local` are added:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MC_VERSION` (set to `1.20.2`)

5. **Update Frontend**:
   Once deployed, Render will provide a URL (e.g., `https://craftchain-api.onrender.com`). You will need to tell me that URL so I can update your frontend to point to the live backend.
