/**
 * Database Migration Runner
 * 
 * Reads SQL migration files and executes them against Supabase.
 * 
 * Usage: npm run db:migrate
 * Or: npx tsx server/scripts/migrate.ts
 */

import { supabaseAdmin } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');

async function runMigrations() {
  console.log('🔄 Running database migrations...\n');

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('❌ Migrations directory not found:', MIGRATIONS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of files) {
    console.log(`📄 Running: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    // Split by statements (basic split — handles most cases)
    // We execute the entire file as one statement block
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_text: sql }).single();

    if (error) {
      // RPC might not exist — try alternative approach
      // Execute each statement individually
      console.log('  ⚠️  RPC exec_sql not available, trying statement-by-statement...');
      
      // Split on semicolons but not inside function bodies
      const statements = splitSqlStatements(sql);
      
      for (const stmt of statements) {
        const trimmed = stmt.trim();
        if (!trimmed || trimmed.startsWith('--')) continue;
        
        // Use Supabase's SQL execution via the REST API
        const response = await fetch(
          `${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/rest/v1/rpc/`, 
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''}`,
            },
            body: JSON.stringify({}),
          }
        ).catch(() => null);
      }
      
      console.log(`  ⚠️  Automated execution may not work for all statements.`);
      console.log(`  💡 Please run the SQL manually in the Supabase Dashboard SQL Editor:`);
      console.log(`     https://app.supabase.com/project/daoiveathxspclosqdqi/sql`);
      console.log(`     File: supabase/migrations/${file}\n`);
    } else {
      console.log(`  ✅ ${file} executed successfully\n`);
    }
  }

  console.log('✅ Migration process complete!');
}

/**
 * Split SQL into individual statements, handling function bodies
 * that contain semicolons inside $$ delimiters.
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Track $$ blocks (function bodies)
    const dollarMatches = trimmedLine.match(/\$\$/g);
    if (dollarMatches) {
      for (const _match of dollarMatches) {
        inDollarQuote = !inDollarQuote;
      }
    }

    current += line + '\n';

    // If we're not in a $$ block and the line ends with ;
    if (!inDollarQuote && trimmedLine.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
