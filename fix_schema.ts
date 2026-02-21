import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log('Using URL:', url);
    const sql = `
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
  `;

    console.log('Running migration...');
    // Since we might not have exec_sql, let's try to just update a profile
    // and see if the column exists by catching the error.
    const { error: testError } = await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).limit(1);

    if (testError && testError.message.includes('column "last_active_at" of relation "profiles" does not exist')) {
        console.log('Column missing! Attempting to create it via exec_sql...');
        const { error: rpcError } = await supabase.rpc('exec_sql', { sql_text: sql });
        if (rpcError) {
            console.error('RPC failed:', rpcError.message);
            console.error('Please run this SQL in Supabase Dashboard:');
            console.log(sql);
        } else {
            console.log('Migration successful!');
        }
    } else if (testError) {
        console.error('Test update failed for other reason:', testError.message);
    } else {
        console.log('Column already exists and is working!');
    }
}

run();
