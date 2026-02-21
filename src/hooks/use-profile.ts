import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/types/database';

type Profile = Tables<'profiles'>;

export function useProfile() {
    const { user, supabaseUser } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!supabaseUser) {
            setProfile(null);
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            try {
                setLoading(true);
                const { data, error: err } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', supabaseUser.id)
                    .single();

                if (err) throw err;
                setProfile(data);
                setError(null);
            } catch (err) {
                setError((err as Error).message);
                setProfile(null);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [supabaseUser]);

    const updateProfile = async (updates: Partial<Profile>) => {
        if (!supabaseUser) return;

        try {
            setLoading(true);
            const { data, error: err } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', supabaseUser.id)
                .select()
                .single();

            if (err) throw err;
            setProfile(data);
            setError(null);
            return data;
        } catch (err) {
            const errorMsg = (err as Error).message;
            setError(errorMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        profile: profile || user,
        loading,
        error,
        updateProfile,
    };
}
