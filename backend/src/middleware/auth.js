import { supabase } from '../supabase.js';

export async function verifyUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing token' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'invalid token' });

    req.user = data.user;
    next();
  } catch (e) {
    next(e);
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();
    if (error || data?.role !== 'admin') {
      return res.status(403).json({ error: 'admin only' });
    }
    next();
  } catch (e) {
    next(e);
  }
}
