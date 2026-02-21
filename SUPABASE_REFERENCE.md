# Supabase Project Reference Card

## 🔗 Quick Links

**Supabase Dashboard**: https://app.supabase.com/projects/daoiveathxspclosqdqi

### Access Credentials
- **Project ID**: `daoiveathxspclosqdqi`
- **Project URL**: `https://daoiveathxspclosqdqi.supabase.co`
- **Organization**: SaiDattu3607's Org (mhurcrwzpktkqpldmeay)
- **Region**: us-east-1
- **Status**: ✅ Active and Healthy

### API Keys
```
Publishable Key (Recommended):
sb_publishable_RXw-0itD6R4LyM8sxCR6mQ_6nBlskiR

Anon Key (Legacy - Still Valid):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb2l2ZWF0aHhzcGNsb3NxZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjM1MzQsImV4cCI6MjA4NzIzOTUzNH0.8S6SmAHSMvQPr0jVtHIBO7ijX_oJbe8GmmHXgM7fXlI
```

⚠️ **Security**: Never share the Service Role Key (admin key)

---

## 📊 Database Schema

### Tables
- ✅ `profiles` - User profile data
  - `id` (UUID) - Primary key, references auth.users
  - `email` (Text)
  - `full_name` (Text)
  - `avatar_url` (Text)
  - `bio` (Text)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)

### Authentication
- ✅ Email/Password provider enabled
- ✅ Auto profile creation on signup
- ✅ User session management

---

## 🔒 Row Level Security (RLS)

### Policies Configured
| Table | Policy | Type | Condition |
|-------|--------|------|-----------|
| profiles | Public viewable | SELECT | true (all) |
| profiles | User insert own | INSERT | auth.uid() = id |
| profiles | User update own | UPDATE | auth.uid() = id |

### Verify RLS Status
In Supabase Dashboard:
1. Go to **SQL Editor**
2. Run: `SELECT * FROM pg_stat_user_tables WHERE relname = 'profiles';`
3. Should show `rls_enabled = true`

---

## 🚀 Development

### Install Supabase CLI (Optional but Recommended)
```bash
npm install -g @supabase/cli
supabase login
# Push local migrations to Supabase
supabase db push
```

### Local Development Setup
```bash
npm install
npm run dev
# App runs on http://localhost:5173
```

### Environment Variables
Create `.env.local`:
```env
VITE_SUPABASE_URL=https://daoiveathxspclosqdqi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📱 Frontend Integration

### useAuth Hook
```typescript
const { user, loading, login, signup, logout, supabaseUser } = useAuth();
```

### useProfile Hook
```typescript
const { profile, loading, error, updateProfile } = useProfile();
```

### Direct Supabase Client
```typescript
import { supabase } from '@/lib/supabase';
```

---

## 🛠️ Common Dashboard Tasks

### Reset Database
1. Supabase Dashboard → **Table Editor**
2. Select table → **Delete** (clears data)
3. Or use SQL to truncate: `TRUNCATE profiles;`

### View Logs
1. **Logs** → Select service (Auth, PostGRES, API)
2. Filter by time range
3. Check for errors or suspicious activity

### Manage Users
1. **Authentication** → **Users**
2. View all signup users
3. Delete test accounts
4. Check email confirmation status

### Monitor Usage
1. **Reports** → View authentication metrics
2. Track signups, active users, sessions

---

## 🔐 Security Checklist

- ✅ RLS enabled on profiles table
- ✅ ForeignKey to auth.users
- ✅ .env.local in .gitignore
- ✅ Service role key NOT in frontend code
- ⚠️ TODO: Enable email verification (optional)
- ⚠️ TODO: Set up custom domain (if using production)
- ⚠️ TODO: Configure OAuth providers (if adding social login)

---

## 📞 Support & Resources

**Documentation**
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Database Docs](https://supabase.com/docs/guides/database)
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)

**Community**
- [Discord Community](https://discord.supabase.io)
- [GitHub Discussions](https://github.com/supabase/supabase/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)

**Project Files**
- `src/contexts/AuthContext.tsx` - Authentication logic
- `src/lib/supabase.ts` - Supabase client
- `src/hooks/use-profile.ts` - Profile operations
- `src/types/database.ts` - TypeScript definitions
- `SUPABASE_SETUP.md` - Full documentation
- `SUPABASE_QUICK_START.ts` - Code examples

---

## 💾 Backup & Export

### Export User Data
```bash
# Via Supabase CLI
supabase db pull

# Or use SQL to export profiles
SELECT * FROM profiles;
```

### Database Backup
- Supabase automatically backs up daily
- Check **Settings** → **Backups** for restore options

---

## 🎯 Next Steps

1. **Test Auth UI**
   - Run `npm run dev`
   - Try signup/login flows
   - Verify profile creation

2. **Add More Features**
   - User profile editing
   - Avatar upload
   - Bio/bio editing
   - Follow system

3. **Enable Optional Features**
   - Email verification
   - OAuth providers (GitHub, Google)
   - Real-time subscriptions
   - Storage for file uploads

4. **Production Deployment**
   - Custom domain
   - HTTPS (automatic)
   - Environment secrets
   - Rate limiting
   - Monitoring

---

**Project Created**: February 21, 2026  
**Last Updated**: February 21, 2026  
**Status**: ✅ Ready for Development
