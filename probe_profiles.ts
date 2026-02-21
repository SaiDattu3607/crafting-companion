import { supabaseAdmin } from './server/config/supabase.js';

async function run() {
    console.log('Fetching first profile...');
    const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1).single();

    if (error) {
        console.error('Fetch failed:', error.message);
    } else {
        console.log('Profile keys:', Object.keys(data));
        console.log('Profile data:', data);
    }
    process.exit(0);
}

run();
