import { Router } from 'express';
import { supabase } from '../supabase.js';
import { seatIsLive } from '../lib/holds.js';

const router = Router();

// so a date search matches the operator's local calendar day, not the UTC day
const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MINUTES ?? 330);

router.get('/search', async (req, res, next) => {
  try {
    const { origin, dest, date } = req.query;
    if (!origin || !dest || !date) {
      return res.status(400).json({ error: 'origin, dest and date are required' });
    }

    const off = TZ_OFFSET_MIN * 60_000;
    const dayStart = new Date(new Date(`${date}T00:00:00.000Z`).getTime() - off);
    const dayEnd = new Date(new Date(`${date}T23:59:59.999Z`).getTime() - off);
    const lowerBound = new Date(Math.max(dayStart.getTime(), Date.now()));

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        id, departure_at, arrival_at, fare, status,
        buses ( id, reg_no, label, bus_type, total_seats, amenities, seat_map ),
        routes ( id, distance_km,
          origin:cities!routes_origin_city_id_fkey ( name ),
          dest:cities!routes_dest_city_id_fkey ( name ) )
      `)
      .eq('status', 'active')
      .gte('departure_at', lowerBound.toISOString())
      .lte('departure_at', dayEnd.toISOString())
      .order('departure_at');
    if (error) throw error;

    const filtered = (data || []).filter(
      (s) =>
        s.routes?.origin?.name?.toLowerCase() === String(origin).toLowerCase() &&
        s.routes?.dest?.name?.toLowerCase() === String(dest).toLowerCase()
    );

    const withCounts = await Promise.all(
      filtered.map(async (s) => {
        const { data: seats } = await supabase
          .from('booking_seats')
          .select('id, bookings ( status, created_at )')
          .eq('schedule_id', s.id);
        const held = (seats || []).filter((row) => seatIsLive(row.bookings)).length;
        return { ...s, seats_left: (s.buses?.total_seats || 0) - held };
      })
    );

    res.json(withCounts);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/seats', async (req, res, next) => {
  try {
    const { data: schedule, error } = await supabase
      .from('schedules')
      .select('id, fare, departure_at, arrival_at, buses ( reg_no, label, bus_type, amenities, seat_map ), routes ( origin:cities!routes_origin_city_id_fkey ( name ), dest:cities!routes_dest_city_id_fkey ( name ) )')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;

    const { data: taken, error: tErr } = await supabase
      .from('booking_seats')
      .select('seat_no, bookings ( status, created_at )')
      .eq('schedule_id', req.params.id);
    if (tErr) throw tErr;

    res.json({
      schedule,
      seat_map: schedule.buses?.seat_map || [],
      taken: (taken || []).filter((t) => seatIsLive(t.bookings)).map((t) => t.seat_no),
    });
  } catch (e) {
    next(e);
  }
});

export default router;
