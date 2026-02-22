# Railway Deployment Guide (Recommended)

Since Vercel has a 250MB limit for serverless functions, it is struggling with the size of your Minecraft data dependencies. **Railway.app** is a better alternative for this project because it runs your server as a standard container without those strict size limits.

## Steps to Deploy on Railway

### 1. Push any remaining changes
Ensure your latest code (including the `vercel.json` I added, which won't hurt) is on GitHub:
```bash
git add .
git commit -m "chore: prepare for railway"
git push origin main
```

### 2. Connect GitHub to Railway
1.  Go to [Railway.app](https://railway.app) and log in with GitHub.
2.  Click **New Project** -> **Deploy from GitHub repo**.
3.  Select your `crafting-companion` repository.

### 3. Railway will detect two services!
Railway is smart. It will likely see both your `package.json` and offer to start the project. 

### 4. Set Environment Variables
In the Railway dashboard, for your project, go to **Variables** and add:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MC_VERSION` (set to `1.20.2`)
- `PORT` (set to `3001` - Railway will use this)

### 5. Deployment Logic
Railway will run `npm run build` (which builds your Vite frontend) and then `npm run start` (which I moved to point to your backend).

## Why Railway is "Proper" for you:
1.  **No 250MB Limit**: It will easily handle the Minecraft data files.
2.  **Vite + Express**: It can serve your frontend static files directly from the Express server, meaning you only need **one** URL for everything.
3.  **Automatic SSL**: You get a `xxx.up.railway.app` URL immediately.

**Once deployed, your frontend and backend will live on the same Railway URL!**
