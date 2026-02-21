# Supabase Authentication Setup Guide

## Overview
Your CraftChain application is now fully integrated with **Supabase** for user authentication and database management. This guide explains the setup and how to use it.

## Project Details
- **Project Name**: crafting-companion
- **Project ID**: daoiveathxspclosqdqi
- **Region**: us-east-1
- **URL**: https://daoiveathxspclosqdqi.supabase.co

## What's Included

### 1. **Database Schema**
A `profiles` table has been created with:
- `id` (UUID, Primary Key) - References auth.users
- `email` (Text, Unique) - User's email
- `full_name` (Text) - User's full name
- `avatar_url` (Text) - Profile picture URL
- `bio` (Text) - User biography
- `created_at` (Timestamp) - Account creation date
- `updated_at` (Timestamp) - Last update date

**Row Level Security (RLS)** is enabled with the following policies:
- ✅ Public profiles are viewable by everyone
- ✅ Users can insert their own profile on signup
- ✅ Users can update their own profile

### 2. **Authentication Features**
- Email/Password authentication
- Automatic profile creation on signup
- Session management
- Secure logout

### 3. **Updated Components**

#### AuthContext (`src/contexts/AuthContext.tsx`)
- Uses Supabase authentication instead of localStorage
- Exports `User` interface with Supabase-compatible fields
- Provides `useAuth()` hook with:
  - `user` - Current user profile
  - `supabaseUser` - Supabase User object
  - `loading` - Loading state
  - `login(email, password)` - Async login
  - `signup(email, password, fullName)` - Async signup
  - `logout()` - Async logout

#### AuthPage (`src/pages/AuthPage.tsx`)
- Updated to use async auth functions
- Replaced username with fullName field
- Added loading states
- Improved error handling

#### Dashboard (`src/pages/Dashboard.tsx`)
- Updated to use `user.full_name` and `user.email`
- Logout now properly awaits async function

### 4. **Environment Variables**
Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://daoiveathxspclosqdqi.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhb2l2ZWF0aHhzcGNsb3NxZHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjM1MzQsImV4cCI6MjA4NzIzOTUzNH0.8S6SmAHSMvQPr0jVtHIBO7ijX_oJbe8GmmHXgM7fXlI
```

**⚠️ Important**: The `.env.local` file is already created. Never commit this file to version control. Use `.env.example` for reference.

## Usage

### Signup
```typescript
const { signup } = useAuth();
const result = await signup(email, password, fullName);
if (result === true) {
  // Successfully signed up
} else {
  // result is error message
}
```

### Login
```typescript
const { login } = useAuth();
const result = await login(email, password);
if (result === true) {
  // Successfully logged in
} else {
  // result is error message
}
```

### Logout
```typescript
const { logout } = useAuth();
await logout();
```

### Access Current User
```typescript
const { user, loading } = useAuth();

if (loading) return <div>Loading...</div>;
if (!user) return <div>Not authenticated</div>;

console.log(user.email);
console.log(user.full_name);
console.log(user.avatar_url);
```

## Advanced Features

### Update User Profile
```typescript
import { supabase } from '@/lib/supabase';

const { data, error } = await supabase
  .from('profiles')
  .update({
    full_name: 'New Name',
    bio: 'New bio',
    avatar_url: 'https://...',
  })
  .eq('id', user.id)
  .select()
  .single();
```

### Use Supabase Client Directly
```typescript
import { supabase } from '@/lib/supabase';

// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Reset password
const { error } = await supabase.auth.resetPasswordForEmail('user@example.com');

// Change password
const { error } = await supabase.auth.updateUser({
  password: 'new-password'
});
```

## Next Steps

### 1. **Enable Email Confirmations** (Optional)
Go to Supabase Dashboard → Authentication → Providers → Email
Enable "Confirm email" to require users to verify their email address.

### 2. **Add OAuth Providers** (Optional)
Supabase supports GitHub, Google, Discord, and more:
- Go to Dashboard → Authentication → Providers
- Configure your preferred provider
- Add OAuth support to your app:
```typescript
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'github'
})
```

### 3. **Add More Database Tables**
Create project-related tables:
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
```

### 4. **Real-time Subscriptions** (Optional)
Subscribe to real-time changes:
```typescript
const subscription = supabase
  .from('profiles')
  .on('*', payload => {
    console.log('Change received!', payload)
  })
  .subscribe()
```

## Security Best Practices

1. **Never expose the service role key** - Only use the anon key in the client
2. **Keep .env.local in .gitignore** - Don't commit secrets
3. **Use RLS policies** - Restrict database access by user
4. **Enable HTTPS only** - Required for production
5. **Monitor logs** - Check Supabase Dashboard → Logs for suspicious activity

## Troubleshooting

### "Missing Supabase environment variables"
- Ensure `.env.local` exists with correct VITE_ prefix
- Restart your dev server after creating `.env.local`

### "User not found" or signup errors
- Check that Supabase project is active
- Verify email format is correct
- Check password meets requirements (8+ characters)

### Profile not syncing
- Check that RLS policies are properly configured
- Verify the trigger `on_auth_user_created` exists
- Check Supabase logs for errors

### Session timeout
- Sessions are managed automatically by Supabase
- Use `onAuthStateChange` to listen for auth changes
- Re-authenticate if needed

## Support
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase Discord Community](https://discord.supabase.io)

## Additional Resources
- **Database Types**: See `src/types/database.ts` for TypeScript definitions
- **Supabase Client**: See `src/lib/supabase.ts` for initialization
- **Auth Hook**: See `src/hooks/use-auth.ts` (can be created for shared logic)
