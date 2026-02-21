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
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
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

  const { data: membership, error } = await supabaseForUser(req.accessToken!)
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: 'Failed to verify membership' });
    return;
  }

  if (!membership) {
    res.status(403).json({ error: 'You are not a member of this project' });
    return;
  }

  next();
}
