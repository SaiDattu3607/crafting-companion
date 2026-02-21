import { supabaseAdmin } from './server/config/supabase.js';

async function run() {
    const { data, error } = await supabaseAdmin.from('profiles').select('*').limit(1).single();
    if (error) {
        console.log('ERROR:' + error.message);
    } else {
        const hasCol = 'last_active_at' in data;
        console.log('COLUMN_STATUS:' + (hasCol ? 'FOUND' : 'MISSING'));
        console.log('KEYS:' + Object.keys(data).join(','));
    }
    process.exit(0);
}

run();
