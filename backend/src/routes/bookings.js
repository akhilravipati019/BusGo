import { Router } from 'express';
import { supabase } from '../supabase.js';
import { verifyUser } from '../middleware/auth.js';
import { buildTicketPdf } from '../lib/ticket.js';
import { isHoldExpired, effectiveStatus } from '../lib/holds.js';

const router = Router();
router.use(verifyUser);

const BOOKING_SELECT = `
  id, status, total_amount, payment_ref, contact_email, contact_phone, created_at, user_id,
  schedules (
    id, departure_at, arrival_at, fare,
    buses ( reg_no, label, bus_type ),
    routes (
      origin:cities!routes_origin_city_id_fkey ( name ),
      dest:cities!routes_dest_city_id_fkey ( name )
    )
  ),
  booking_seats ( seat_no, passenger_name, passenger_age, passenger_gender )
`;

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map((b) => ({ ...b, status: effectiveStatus(b) })));
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { schedule_id, seats, contact_email, contact_phone } = req.body;
    if (!schedule_id || !Array.isArray(seats) || seats.length === 0) {
      return res.status(400).json({ error: 'schedule_id and seats are required' });
    }
    for (const s of seats) {
      if (!s.seat_no || !s.passenger_name) {
        return res.status(400).json({ error: 'each seat needs seat_no and passenger_name' });
      }
    }
    const seatNos = seats.map((s) => s.seat_no);
    if (new Set(seatNos).size !== seatNos.length) {
      return res.status(400).json({ error: 'duplicate seat selected' });
    }
    if (seats.length > 6) {
      return res.status(400).json({ error: 'at most 6 seats per booking' });
    }

    const { data: sched, error: sErr } = await supabase
      .from('schedules')
      .select('buses ( seat_map )')
      .eq('id', schedule_id)
      .single();
    if (sErr || !sched) return res.status(404).json({ error: 'trip not found' });
    const rawMap = sched.buses?.seat_map;
    const validSeats = new Set(
      Array.isArray(rawMap)
        ? rawMap
        : (rawMap?.decks || []).flatMap((d) => d.rows.flat()).filter(Boolean)
    );
    if (!seatNos.every((n) => validSeats.has(n))) {
      return res.status(400).json({ error: 'invalid seat for this bus' });
    }

    const { data, error } = await supabase.rpc('create_booking', {
      p_user_id: req.user.id,
      p_schedule_id: schedule_id,
      p_seats: seats,
      p_contact_email: contact_email || req.user.email,
      p_contact_phone: contact_phone || null,
    });

    if (error) {
      if (String(error.message).includes('duplicate key') || error.code === '23505') {
        return res.status(409).json({ error: 'One or more seats were just taken. Please pick again.' });
      }
      if (String(error.message).includes('schedule_not_active')) {
        return res.status(400).json({ error: 'This trip is no longer available.' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/pay', async (req, res, next) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings').select('id, user_id, status, created_at').eq('id', req.params.id).single();
    if (error || !booking) return res.status(404).json({ error: 'booking not found' });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'not your booking' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'booking was cancelled' });
    if (booking.status === 'confirmed') return res.json({ ok: true, already: true });
    if (isHoldExpired(booking.status, booking.created_at)) {
      return res.status(400).json({ error: 'This seat hold has expired. Please book again.' });
    }

    const paymentRef = 'MOCK-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const { data, error: uErr } = await supabase
      .from('bookings')
      .update({ status: 'confirmed', payment_ref: paymentRef })
      .eq('id', booking.id)
      .select(BOOKING_SELECT)
      .single();
    if (uErr) throw uErr;
    res.json(data);
  } catch (e) {
    next(e);
  }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings').select('id, user_id, status').eq('id', req.params.id).single();
    if (error || !booking) return res.status(404).json({ error: 'booking not found' });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'not your booking' });
    if (booking.status === 'cancelled') return res.json({ ok: true });

    // free the seats, keep the booking row for history
    await supabase.from('booking_seats').delete().eq('booking_id', booking.id);
    const { error: uErr } = await supabase
      .from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    if (uErr) throw uErr;
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/ticket', async (req, res, next) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings').select(BOOKING_SELECT).eq('id', req.params.id).single();
    if (error || !booking) return res.status(404).json({ error: 'booking not found' });
    if (booking.user_id !== req.user.id) return res.status(403).json({ error: 'not your booking' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: 'ticket available after payment' });

    const pdf = await buildTicketPdf(booking);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${booking.id}.pdf"`);
    res.send(pdf);
  } catch (e) {
    next(e);
  }
});

export default router;
