# Supabase Authentication Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CRAFTING COMPANION APP                       │
│                     (React + TypeScript)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌────────────────────┐
                    │   React Router     │
                    │  (Route Protection)│
                    └────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
              ┌──────────┐         ┌──────────┐
              │AuthPage  │         │Dashboard │
              │(Login)   │         │(Protected)
              └──────────┘         └──────────┘
                    │                   │
                    └─────────┬─────────┘
                              ↓
                    ┌────────────────────┐
                    │   useAuth() Hook   │
                    │  AuthContext.tsx   │
                    └────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
              ┌──────────┐         ┌──────────┐
              │useProfile│         │supabase  │
              │(Profiles)│         │Client    │
              └──────────┘         └──────────┘
                    │                   │
                    └─────────┬─────────┘
                              ↓
                ┌─────────────────────────────┐
                │  SUPABASE PROJECT           │
                │ (Cloud Authentication)      │
                └─────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ↓                   ↓
              ┌──────────┐         ┌──────────┐
              │Auth API  │         │PostgreSQL│
              │(Sessions)│         │ Database │
              └──────────┘         └──────────┘
                                         │
                                       ┌─┴──────┐
                                       ↓        ↓
                                    ┌────┐  ┌────────┐
                                    │auth│  │profiles│
                                    │users   │table   │
                                    └────┘  └────────┘
```

## Data Flow Diagram

### Signup Flow
```
User Input (Email, Password, Name)
           ↓
    AuthPage.tsx
           ↓
    useAuth.signup()
           ↓
    supabase.auth.signUp()
           ↓
  ┌────────┴────────┐
  ↓                 ↓
Success           Error
  ↓                 ↓
Create Auth     Return Error
User in DB      Message
  ↓
Trigger:
on_auth_user_created
  ↓
Auto-create
Profile Row
  ↓
Set Auth State
  ↓
Navigate to /
(Dashboard)
```

### Login Flow
```
User Input (Email, Password)
           ↓
    AuthPage.tsx
           ↓
    useAuth.login()
           ↓
    supabase.auth.signInWithPassword()
           ↓
  ┌────────┴────────┐
  ↓                 ↓
Valid            Invalid
  ↓                 ↓
Load Session    Return Error
from Auth       Message
  ↓
Fetch Profile
from profiles
table (RLS)
  ↓
Set Auth & User
State
  ↓
Navigate to /
(Dashboard)
```

### Protected Route Flow
```
User Tries to Access /dashboard
           ↓
    Dashboard Component
           ↓
    useAuth() Hook
           ↓
    Check Loading State
           ↓
  ┌──────────┴──────────┐
  ↓                     ↓
Still Loading      User Exists?
  ↓                  │     │
Show Loading    Yes  │     No
Page           ↓     ↓
           Show    Redirect
           Page    to /auth
```

## Component Hierarchy

```
App.tsx
├── AuthProvider (AuthContext.tsx)
│   │
│   └── AuthContext.Provider
│       │
│       ├── /auth → AuthPage.tsx
│       │   ├── useAuth() for signup
│       │   └── useAuth() for login
│       │
│       ├── / → Dashboard.tsx
│       │   ├── useAuth() for user info
│       │   ├── useAuth() for logout
│       │   └── [Projects]
│       │
│       ├── /project/:id → ProjectDetail.tsx
│       │   ├── useAuth() for auth check
│       │   └── useProfile() for user data
│       │
│       └── [Other Protected Routes]
│           └── useAuth() for protection
```

## Database Schema

```
┌─────────────────────────────────────────────┐
│ auth.users (Managed by Supabase)             │
├─────────────────────────────────────────────┤
│ id: UUID (PK)                               │
│ email: TEXT (UNIQUE)                        │
│ encrypted_password: TEXT                    │
│ email_confirmed_at: TIMESTAMP               │
│ created_at: TIMESTAMP                       │
│ updated_at: TIMESTAMP                       │
│ ...more auth fields                         │
└─────────────────────────────────────────────┘
              │ (1:1 relationship)
              │ (Foreign Key)
              ↓
┌─────────────────────────────────────────────┐
│ public.profiles (Your Data)                 │
├─────────────────────────────────────────────┤
│ id: UUID (PK, FK → auth.users.id)           │
│ email: TEXT (UNIQUE)                        │
│ full_name: TEXT                             │
│ avatar_url: TEXT                            │
│ bio: TEXT                                   │
│ created_at: TIMESTAMP                       │
│ updated_at: TIMESTAMP                       │
└─────────────────────────────────────────────┘
        ↑
        │ (Auto-populated by trigger)
        │
    on_auth_user_created
    (Database Trigger)
```

## RLS Policy Matrix

```
┌─────────────────────────────────────────────────────────┐
│         Table: profiles (Row Level Security)             │
├──────────────┬──────────┬──────────┬──────────┬─────────┤
│ User Type    │ SELECT   │ INSERT   │ UPDATE   │ DELETE  │
├──────────────┼──────────┼──────────┼──────────┼─────────┤
│ Anonymous    │ Allow *  │ Deny     │ Deny     │ Deny    │
│ Logged In    │ Allow *  │ Own only │ Own only │ Own     │
│ Own Row      │ ✓        │ ✓        │ ✓        │ -       │
│ Other Row    │ ✓        │ -        │ -        │ -       │
└──────────────┴──────────┴──────────┴──────────┴─────────┘

* = Anyone can VIEW all profiles
Own = Only the user who owns that profile can modify it
```

## State Management Flow

```
┌────────────────────────────────────────┐
│        AuthContext State                │
├────────────────────────────────────────┤
│ user: User | null                       │
│ supabaseUser: SupabaseUser | null       │
│ loading: boolean                        │
├────────────────────────────────────────┤
│           Functions                     │
├────────────────────────────────────────┤
│ login(email, password)                  │
│ signup(email, password, fullName)       │
│ logout()                                │
├────────────────────────────────────────┤
│       Event Listeners                   │
├────────────────────────────────────────┤
│ onAuthStateChange (listen for changes) │
│ getSession (check current session)      │
└────────────────────────────────────────┘
         ↓ (Provides to all children)
    useAuth() Hook
         ↓ (Available in any component)
    Any child component
```

## Error Handling Flow

```
User Action (Signup/Login)
           ↓
    Call Auth Function
           ↓
    Send to Supabase
           ↓
  ┌────────┴────────┐
  ↓                 ↓
Success           Error
  ↓                 ↓
  │          Supabase API
  │          Returns Error
  │                 ↓
  │          Error Message
  │          (String)
  │                 ↓
  │          Return to Component
  │                 ↓
  │          Display in UI
  │
  ↓
Update Local State
  ↓
Re-render UI
  ↓
Navigate or Show Error
```

## Environment Configuration

```
.env.local (Local Development)
├── VITE_SUPABASE_URL
│   └── Points to: https://daoiveathxspclosqdqi.supabase.co
│
└── VITE_SUPABASE_ANON_KEY
    └── Your public API key (restricted by RLS)

.env.example (Version Control Safe)
├── VITE_SUPABASE_URL=https://your-project.supabase.co
└── VITE_SUPABASE_ANON_KEY=your-anon-key-here

⚠️ Never commit .env.local
✅ Only .env.example goes to git
```

## Security Layers

```
Layer 1: Client-Side
├── TypeScript type checking
├── Route guards (useAuth)
└── Form validation

Layer 2: Supabase Auth API
├── Password hashing
├── Session tokens (JWT)
├── Email verification (optional)
└── Rate limiting

Layer 3: Database (PostGRES)
├── Row Level Security (RLS) policies
├── Foreign key constraints
├── Encryption at rest
└── Encryption in transit (HTTPS)

Layer 4: Access Control
├── Public read profiles (SELECT)
├── Private write profiles (INSERT/UPDATE)
└── User isolation (Users can only modify their own data)
```

## Deployment Checklist

```
Pre-Deployment
├── ✅ Authentication working locally
├── ✅ Profiles table syncing
├── ✅ .env.local not in git
├── ✅ npm run build successful
└── ✅ Tests passing

Deployment
├── Set environment variables on host
├── Deploy to Vercel/Netlify/etc
├── Test auth on live site
└── Monitor Supabase logs

Post-Deployment
├── Enable email verification (optional)
├── Configure OAuth providers (optional)
├── Set up SSL/HTTPS (automatic)
├── Monitor user signups
└── Check for errors in Supabase logs
```

This diagram shows how all the pieces fit together! 🧩
