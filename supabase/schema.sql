-- Full setup: tables, RLS, the booking function, and sample data.
-- Paste into the Supabase SQL editor and run. Re-running resets the sample data.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists cities (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists routes (
  id bigint generated always as identity primary key,
  origin_city_id bigint not null references cities(id),
  dest_city_id bigint not null references cities(id),
  distance_km int,
  check (origin_city_id <> dest_city_id)
);

-- Single operator (this company). A bus is identified by its registration number.
create table if not exists buses (
  id bigint generated always as identity primary key,
  reg_no text not null unique,               -- e.g. KA-01-AB-1234
  label text,                                -- optional friendly name / fleet code
  bus_type text not null check (bus_type in ('AC_SLEEPER','AC_SEATER','NON_AC')),
  total_seats int not null,
  amenities jsonb not null default '[]',      -- e.g. ["wifi","charging","water"]
  -- seat_map: array of seat labels, e.g. ["L1","L2","U1",...]
  seat_map jsonb not null
);

create extension if not exists btree_gist;

create table if not exists schedules (
  id bigint generated always as identity primary key,
  bus_id bigint not null references buses(id),
  route_id bigint not null references routes(id),
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  fare numeric(10,2) not null check (fare >= 0),
  status text not null default 'active' check (status in ('active','cancelled')),
  check (arrival_at > departure_at),
  -- a bus cannot run two active trips whose [departure, arrival] windows overlap
  constraint schedules_no_bus_overlap exclude using gist (
    bus_id with =,
    tstzrange(departure_at, arrival_at, '[]') with &&
  ) where (status = 'active')
);
create index if not exists idx_schedules_departure on schedules(departure_at);
create index if not exists idx_schedules_route on schedules(route_id);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id bigint not null references schedules(id),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  total_amount numeric(10,2) not null default 0,
  payment_ref text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);
create index if not exists idx_bookings_user on bookings(user_id);

create table if not exists booking_seats (
  id bigint generated always as identity primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  schedule_id bigint not null references schedules(id),
  seat_no text not null,
  passenger_name text not null,
  passenger_age int,
  passenger_gender text check (passenger_gender in ('M','F','O')),
  unique (schedule_id, seat_no)   -- hard guard against double booking
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- atomic seat lock. called only from the Express server.
create or replace function create_booking(
  p_user_id uuid,
  p_schedule_id bigint,
  p_seats jsonb,
  p_contact_email text,
  p_contact_phone text
) returns bookings language plpgsql security definer set search_path = public as $$
declare
  v_fare numeric(10,2);
  v_status text;
  v_booking bookings;
  v_seat jsonb;
begin
  select fare, status into v_fare, v_status from schedules where id = p_schedule_id for update;
  if v_fare is null then raise exception 'schedule_not_found'; end if;
  if v_status <> 'active' then raise exception 'schedule_not_active'; end if;
  if jsonb_array_length(p_seats) = 0 then raise exception 'no_seats'; end if;

  -- expire stale pending bookings for this schedule so their seats free up
  delete from bookings
   where schedule_id = p_schedule_id
     and status = 'pending'
     and created_at < now() - interval '10 minutes';

  insert into bookings (user_id, schedule_id, status, total_amount, contact_email, contact_phone)
  values (p_user_id, p_schedule_id, 'pending',
          v_fare * jsonb_array_length(p_seats), p_contact_email, p_contact_phone)
  returning * into v_booking;

  for v_seat in select * from jsonb_array_elements(p_seats) loop
    insert into booking_seats (booking_id, schedule_id, seat_no, passenger_name, passenger_age, passenger_gender)
    values (
      v_booking.id, p_schedule_id,
      v_seat->>'seat_no',
      v_seat->>'passenger_name',
      nullif(v_seat->>'passenger_age','')::int,
      v_seat->>'passenger_gender'
    );
  end loop;  -- unique(schedule_id, seat_no) violation here -> whole tx rolls back

  return v_booking;
end;
$$;

alter table profiles      enable row level security;
alter table cities        enable row level security;
alter table routes        enable row level security;
alter table buses         enable row level security;
alter table schedules     enable row level security;
alter table bookings      enable row level security;
alter table booking_seats enable row level security;

drop policy if exists "profiles self read"   on profiles;
drop policy if exists "profiles self update" on profiles;
drop policy if exists "cities read"    on cities;
drop policy if exists "routes read"    on routes;
drop policy if exists "buses read"     on buses;
drop policy if exists "schedules read" on schedules;
drop policy if exists "bookings self read"      on bookings;
drop policy if exists "booking_seats self read" on booking_seats;

-- profiles: user manages own row
create policy "profiles self read"   on profiles for select using (auth.uid() = id);
create policy "profiles self update" on profiles for update using (auth.uid() = id);

-- public catalog: anyone (incl. anon) can read; writes only via service_role (bypasses RLS)
create policy "cities read"    on cities    for select using (true);
create policy "routes read"    on routes    for select using (true);
create policy "buses read"     on buses     for select using (true);
create policy "schedules read" on schedules for select using (true);

-- bookings: user reads own; all writes go through the server (service_role)
create policy "bookings self read"       on bookings      for select using (auth.uid() = user_id);
create policy "booking_seats self read"  on booking_seats for select
  using (exists (select 1 from bookings b where b.id = booking_seats.booking_id and b.user_id = auth.uid()));


-- sample data (safe to re-run; wipes the catalog and bookings first)
truncate booking_seats, bookings, schedules, buses, routes, cities restart identity cascade;

insert into cities (name) values
  ('Bengaluru'), ('Chennai'), ('Hyderabad'), ('Mumbai'), ('Pune'), ('Goa');

-- routes (origin -> dest)
insert into routes (origin_city_id, dest_city_id, distance_km) values
  (1, 2, 350),   -- Bengaluru -> Chennai
  (1, 3, 570),   -- Bengaluru -> Hyderabad
  (4, 5, 150),   -- Mumbai -> Pune
  (4, 6, 590),   -- Mumbai -> Goa
  (1, 6, 560);   -- Bengaluru -> Goa

-- buses (this company's fleet, identified by registration number)
insert into buses (reg_no, label, bus_type, total_seats, amenities, seat_map) values
  ('KA-01-AB-1234', 'Fleet 01', 'AC_SLEEPER', 30, '["wifi","charging","blanket","water"]',
   '["L1","L2","L3","L4","L5","L6","L7","L8","L9","L10","L11","L12","L13","L14","L15","U1","U2","U3","U4","U5","U6","U7","U8","U9","U10","U11","U12","U13","U14","U15"]'),
  ('KA-05-CD-5678', 'Fleet 02', 'AC_SEATER',  36, '["wifi","charging","water"]',
   '["1A","1B","1C","1D","2A","2B","2C","2D","3A","3B","3C","3D","4A","4B","4C","4D","5A","5B","5C","5D","6A","6B","6C","6D","7A","7B","7C","7D","8A","8B","8C","8D","9A","9B","9C","9D"]'),
  ('KA-09-EF-9012', 'Fleet 03', 'NON_AC',     40, '["charging"]',
   '["1A","1B","1C","1D","2A","2B","2C","2D","3A","3B","3C","3D","4A","4B","4C","4D","5A","5B","5C","5D","6A","6B","6C","6D","7A","7B","7C","7D","8A","8B","8C","8D","9A","9B","9C","9D","10A","10B","10C","10D"]');

-- schedules: non-overlapping per bus, relative to the day it is run
insert into schedules (bus_id, route_id, departure_at, arrival_at, fare, status)
select bus_id, route_id, d, a, fare, 'active'
from (values
  (1, 1, date_trunc('day', now()) + interval '1 day 21 hour', date_trunc('day', now()) + interval '2 day 5 hour',  899.00),
  (1, 5, date_trunc('day', now()) + interval '3 day 21 hour', date_trunc('day', now()) + interval '4 day 6 hour', 1199.00),
  (2, 1, date_trunc('day', now()) + interval '1 day 8 hour',  date_trunc('day', now()) + interval '1 day 16 hour', 649.00),
  (2, 2, date_trunc('day', now()) + interval '2 day 9 hour',  date_trunc('day', now()) + interval '2 day 21 hour', 1099.00),
  (3, 3, date_trunc('day', now()) + interval '1 day 7 hour',  date_trunc('day', now()) + interval '1 day 11 hour', 399.00),
  (3, 4, date_trunc('day', now()) + interval '3 day 18 hour', date_trunc('day', now()) + interval '4 day 6 hour', 999.00)
) as s(bus_id, route_id, d, a, fare);
