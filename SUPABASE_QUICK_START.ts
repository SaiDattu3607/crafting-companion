#!/usr/bin/env node

/**
 * QUICK START GUIDE - Supabase Authentication
 * 
 * This file documents the authentication flow and common operations.
 * For detailed docs, see SUPABASE_SETUP.md
 */

// ============================================================================
// 1. BASIC AUTHENTICATION
// ============================================================================

import { useAuth } from '@/contexts/AuthContext';

function AuthExample() {
    const { user, loading, login, signup, logout } = useAuth();

    // Check if user is logged in
    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <div>Please log in </div>;
    }

    return (
        <div>
        <h1>Welcome, { user.full_name || user.email }! </h1>
        < button onClick = {() => logout()
}> Log out </button>
    </div>
  );
}

// ============================================================================
// 2. LOGIN EXAMPLE
// ============================================================================

async function handleLogin() {
    const { login } = useAuth();

    const result = await login('user@example.com', 'password123');

    if (result === true) {
        console.log('Login successful!');
        // redirects automatically in AuthPage
    } else {
        console.error('Login failed:', result);
    }
}

// ============================================================================
// 3. SIGNUP EXAMPLE
// ============================================================================

async function handleSignup() {
    const { signup } = useAuth();

    const result = await signup(
        'newuser@example.com',
        'password123',
        'John Doe' // fullName instead of username
    );

    if (result === true) {
        console.log('Signup successful!');
        // redirects automatically in AuthPage
    } else {
        console.error('Signup failed:', result);
    }
}

// ============================================================================
// 4. ACCESSING USER DATA
// ============================================================================

function UserInfoExample() {
    const { user } = useAuth();

    return (
        <div>
        <p>Email: { user?.email } </p>
            < p > Name: { user?.full_name } </p>
                < img src = { user?.avatar_url } alt = "Avatar" />
                    </div>
  );
}

// ============================================================================
// 5. UPDATE USER PROFILE
// ============================================================================

import { useProfile } from '@/hooks/use-profile';

function UpdateProfileExample() {
    const { profile, updateProfile } = useProfile();

    const handleUpdate = async () => {
        try {
            await updateProfile({
                full_name: 'New Name',
                bio: 'New bio',
                avatar_url: 'https://example.com/avatar.jpg',
            });
            console.log('Profile updated!');
        } catch (error) {
            console.error('Update failed:', error);
        }
    };

    return (
        <div>
        <p>Current name: { profile?.full_name } </p>
            < button onClick = { handleUpdate } > Update Profile </button>
                </div>
  );
}

// ============================================================================
// 6. DIRECT SUPABASE QUERIES
// ============================================================================

import { supabase } from '@/lib/supabase';

async function directSupabaseExample() {
    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    console.log('Current session:', session?.user);

    // Get all profiles (public read access due to RLS)
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(10);

    if (error) {
        console.error('Failed to fetch profiles:', error);
    } else {
        console.log('Profiles:', profiles);
    }

    // Update current user's password
    const { error: pwError } = await supabase.auth.updateUser({
        password: 'new-password'
    });

    // Reset password
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        'user@example.com'
    );
}

// ============================================================================
// 7. LISTEN FOR AUTH STATE CHANGES
// ============================================================================

import { useEffect } from 'react';

function AuthStateListenerExample() {
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log('Auth event:', event);
                console.log('Session:', session);

                if (event === 'SIGNED_IN') {
                    console.log('User logged in');
                } else if (event === 'SIGNED_OUT') {
                    console.log('User logged out');
                }
            }
        );

        return () => subscription?.unsubscribe();
    }, []);
}

// ============================================================================
// 8. ROUTE PROTECTION
// ============================================================================

function ProtectedRoute() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        navigate('/auth');
        return null;
    }

    return <div>This content is only visible to logged -in users </div>;
}

// ============================================================================
// 9. ENVIRONMENT VARIABLES
// ============================================================================

/*
 * Required environment variables in .env.local:
 * 
 * VITE_SUPABASE_URL=https://daoiveathxspclosqdqi.supabase.co
 * VITE_SUPABASE_ANON_KEY=your-anon-key-here
 * 
 * Note: VITE_ prefix is required for Vite to expose them to the client
 */

// ============================================================================
// 10. ERROR HANDLING
// ============================================================================

async function errorHandlingExample() {
    try {
        const { signup } = useAuth();

        const result = await signup('invalid-email', 'short', 'Name');

        if (result !== true) {
            // result is an error message string
            switch (result) {
                case 'Email already registered':
                    console.error('This email is already in use');
                    break;
                case 'User not found':
                    console.error('Invalid credentials');
                    break;
                default:
                    console.error('Error:', result);
            }
        }
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

// ============================================================================
// COMMON RLS POLICY ERRORS
// ============================================================================

/*
 * "new row violates row level security policy"
 * → User is trying to insert data they don't own
 * 
 * "permission denied for schema public"
 * → User doesn't have permission for the operation
 * 
 * "JWT expired"
 * → Session has expired, user needs to re-login
 * 
 * Solution: Check RLS policies in Supabase Dashboard → Table Editor
 */

// ============================================================================
// USEFUL LINKS
// ============================================================================

/*
 * Supabase Dashboard: https://app.supabase.com
 * Project: crafting-companion (daoiveathxspclosqdqi)
 * 
 * Authentication Docs: https://supabase.com/docs/guides/auth
 * Database Docs: https://supabase.com/docs/guides/database
 * Realtime Docs: https://supabase.com/docs/guides/realtime
 * 
 * TypeScript Definitions: src/types/database.ts
 * Auth Context: src/contexts/AuthContext.tsx
 * Profile Hook: src/hooks/use-profile.ts
 */

export { };
