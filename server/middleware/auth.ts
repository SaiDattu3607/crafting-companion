import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, supabaseForUser } from '../config/supabase.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      accessToken?: string;
    }
  }
}

/**
 * Middleware: verifies the JWT from the Authorization header
 * and attaches the user ID to the request.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Retry getUser up to 3 times for transient SSL errors
    let user: any = null;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
        break;
      }
      lastErr = error;
      if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
    }

    if (!user) {
      console.warn('[Auth] Token verification failed after retries:', lastErr?.message?.substring(0, 200));
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.userId = user.id;
    req.accessToken = token;

    // Background: Update "last_active_at" for presence tracking
    // We use the user's specific client to ensure RLS is handled correctly
    supabaseForUser(token)
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) console.error('[Presence] Error updating last_active_at:', error.message);
      });

    next();
  } catch (err) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware: checks that the user is a member of the project
 * specified in req.params.projectId
 */
export async function projectMemberGuard(req: Request, res: Response, next: NextFunction) {
  const projectId = req.params.projectId || req.body?.projectId;
  const userId = req.userId;

  if (!projectId || !userId) {
    res.status(400).json({ error: 'Missing projectId or not authenticated' });
    return;
  }

  // Retry up to 3 times in case of transient Supabase/Cloudflare SSL errors
  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data: membership, error } = await supabaseForUser(req.accessToken!)
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error) {
      if (!membership) {
        res.status(403).json({ error: 'You are not a member of this project' });
        return;
      }
      next();
      return;
    }

    lastError = error;
    console.warn(`[MemberGuard] Attempt ${attempt}/3 failed:`, error.message?.substring(0, 200));
    if (attempt < 3) await new Promise(r => setTimeout(r, 500 * attempt));
  }

  console.error('[MemberGuard] All retries failed:', lastError?.message?.substring(0, 300));
  res.status(500).json({ error: 'Failed to verify membership' });
  return;
}
