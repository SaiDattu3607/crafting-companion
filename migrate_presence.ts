import { supabaseAdmin } from './server/config/supabase.js';

async function run() {
    const sql = `
    ALTER TABLE crafting_nodes ADD COLUMN IF NOT EXISTS enchantments JSONB DEFAULT NULL;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
  `;

    console.log('Running migration...');
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_text: sql });

    if (error) {
        console.error('Migration failed:', error.message);
    } else {
        console.log('Migration successful!', data);
    }
    process.exit(error ? 1 : 0);
}

run();
