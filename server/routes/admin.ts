import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

// Temporary admin endpoint to run the enchantments migration.
// Protect it by requiring the service role key in the `x-admin-token` header.
router.post('/run-enchantments-migration', async (req: Request, res: Response) => {
    try {
        const token = req.headers['x-admin-token'] as string | undefined;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey || token !== serviceKey) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const sql = `
          ALTER TABLE crafting_nodes ADD COLUMN IF NOT EXISTS enchantments JSONB DEFAULT NULL;
          ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
        `;

        // Try to execute via the exec_sql RPC (may not exist)
        try {
            const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_text: sql }).single();
            if (error) {
                // Return the error so caller can see why it failed
                res.status(500).json({ error: error.message, data });
                return;
            }
            res.json({ success: true, data });
            return;
        } catch (rpcErr) {
            res.status(500).json({ error: 'RPC exec_sql failed', details: (rpcErr as Error).message });
            return;
        }
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});


export default router;
