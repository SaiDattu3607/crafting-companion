# Vercel Full-Stack Deployment Guide

I have updated your code to allow both the **Frontend** and **Backend** to run together on Vercel. You no longer need Render.

## Steps to Deploy

### 1. Commit and Push
Run these commands in your terminal to save the new configuration:
```bash
git add .
git commit -m "chore: deploy full-stack to vercel"
git push origin master
```

### 2. Configure Vercel Dashboard
Go to your project settings in the [Vercel Dashboard](https://vercel.com/dashboard):

1.  **Environment Variables**: Ensure these keys are added to your Vercel project:
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `MC_VERSION` (set to `1.20.2`)
    - `VITE_API_URL` (Set this to `/api` — Vercel will now handle routing internally!)

2.  **Redeploy**:
    - Go to the **Deployments** tab and click **Redeploy** on your latest push.

## Why this is better:
- **No CORS issues**: Since both frontend and backend are on the same domain, they talk to each other perfectly.
- **One Dashboard**: Manage everything in Vercel.
- **Cost**: Both are covered under Vercel's free/hobby tier.

Once Vercel finished building, your app should be fully functional at your `.vercel.app` URL!
