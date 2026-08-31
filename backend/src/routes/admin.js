import { Router } from 'express';
import { supabase } from '../supabase.js';
import { verifyUser, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(verifyUser, requireAdmin);

const list = (table, select = '*', order = 'id') => async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from(table).select(select).order(order);
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
};
const create = (table) => async (req, res, next) => {
  try {
    const { data, error } = await supabase.from(table).insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) { next(e); }
};
const update = (table) => async (req, res, next) => {
  try {
    const { data, error } = await supabase.from(table).update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { next(e); }
};
const remove = (table) => async (req, res, next) => {
  try {
    const { error } = await supabase.from(table).delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { next(e); }
};

router.get('/cities', list('cities', '*', 'name'));
router.post('/cities', create('cities'));
router.delete('/cities/:id', remove('cities'));

router.get('/routes', list('routes',
  'id, distance_km, origin:cities!routes_origin_city_id_fkey(id,name), dest:cities!routes_dest_city_id_fkey(id,name)'));
router.post('/routes', create('routes'));
router.delete('/routes/:id', remove('routes'));

router.get('/buses', list('buses'));
router.post('/buses', create('buses'));
router.put('/buses/:id', update('buses'));
router.delete('/buses/:id', remove('buses'));

router.get('/schedules', async (req, res, next) => {
  try {
    let q = supabase
      .from('schedules')
      .select('id, bus_id, route_id, departure_at, arrival_at, fare, status, buses(reg_no,label,bus_type,total_seats), routes(origin:cities!routes_origin_city_id_fkey(name),dest:cities!routes_dest_city_id_fkey(name))')
      .order('departure_at');
    if (req.query.bus_id) q = q.eq('bus_id', Number(req.query.bus_id));
    if (req.query.route_id) q = q.eq('route_id', Number(req.query.route_id));
    if (req.query.date) {
      q = q.gte('departure_at', new Date(`${req.query.date}T00:00:00`).toISOString())
           .lte('departure_at', new Date(`${req.query.date}T23:59:59`).toISOString());
    }
    const { data, error } = await q;
    if (error) throw error;

    const withSold = await Promise.all((data || []).map(async (s) => {
      const { count } = await supabase
        .from('booking_seats').select('id', { count: 'exact', head: true }).eq('schedule_id', s.id);
      return { ...s, seats_sold: count || 0 };
    }));
    res.json(withSold);
  } catch (e) { next(e); }
});
function scheduleError(error, res) {
  if (error?.code === '23P01' || String(error?.message).includes('schedules_no_bus_overlap')) {
    return res.status(409).json({ error: 'That bus already has an active trip overlapping this time window.' });
  }
  if (error?.code === '23514' || String(error?.message).includes('schedules_time_order')) {
    return res.status(400).json({ error: 'Arrival must be after departure.' });
  }
  return null;
}

router.post('/schedules', async (req, res, next) => {
  try {
    const dep = new Date(req.body.departure_at);
    const arr = new Date(req.body.arrival_at);
    if (isNaN(dep) || isNaN(arr)) return res.status(400).json({ error: 'Invalid departure/arrival time.' });
    if (dep.getTime() < Date.now()) return res.status(400).json({ error: `Departure is in the past (${dep.toLocaleString()}). Check the date.` });
    if (arr <= dep) return res.status(400).json({ error: 'Arrival must be after departure.' });

    const { data, error } = await supabase.from('schedules').insert(req.body).select().single();
    if (error) return scheduleError(error, res) || next(error);
    res.status(201).json(data);
  } catch (e) { next(e); }
});
router.put('/schedules/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase.from('schedules').update(req.body).eq('id', req.params.id).select().single();
    if (error) return scheduleError(error, res) || next(error);
    res.json(data);
  } catch (e) { next(e); }
});
router.delete('/schedules/:id', remove('schedules'));

router.get('/bookings', async (req, res, next) => {
  try {
    let q = supabase
      .from('bookings')
      .select('id, status, total_amount, payment_ref, contact_email, contact_phone, created_at, schedule_id, schedules(bus_id, departure_at, buses(reg_no,label), routes(origin:cities!routes_origin_city_id_fkey(name), dest:cities!routes_dest_city_id_fkey(name))), booking_seats(seat_no,passenger_name,passenger_age,passenger_gender)')
      .order('created_at', { ascending: false });
    if (req.query.schedule_id) q = q.eq('schedule_id', Number(req.query.schedule_id));
    const { data, error } = await q;
    if (error) throw error;

    let rows = data || [];
    if (req.query.bus_id) {
      rows = rows.filter((b) => b.schedules?.bus_id === Number(req.query.bus_id));
    }
    if (req.query.date) {
      rows = rows.filter((b) => b.schedules?.departure_at?.slice(0, 10) === req.query.date);
    }
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/buses/:id/overview', async (req, res, next) => {
  try {
    const { data: bus, error } = await supabase.from('buses').select('*').eq('id', req.params.id).single();
    if (error) throw error;

    const { data: schedules, error: sErr } = await supabase
      .from('schedules')
      .select('id, departure_at, arrival_at, fare, status, routes(origin:cities!routes_origin_city_id_fkey(name), dest:cities!routes_dest_city_id_fkey(name))')
      .eq('bus_id', req.params.id)
      .order('departure_at');
    if (sErr) throw sErr;

    const withLoad = await Promise.all((schedules || []).map(async (s) => {
      const { count } = await supabase
        .from('booking_seats').select('id', { count: 'exact', head: true }).eq('schedule_id', s.id);
      return { ...s, seats_sold: count || 0, seats_total: bus.total_seats };
    }));

    res.json({ bus, schedules: withLoad });
  } catch (e) { next(e); }
});

export default router;
