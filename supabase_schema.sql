-- SQL Schema for Fiesta Leforet Coming Soon App in Supabase PostgreSQL

create table if not exists leforet_subscribers (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists leforet_reservations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text not null,
  guests integer default 2,
  table_type text default 'VIP Table',
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists leforet_settings (
  id int primary key default 1,
  title text default 'FIESTA LEFORET',
  subtitle text default 'La Celebración de Fin de Año Más Exclusiva',
  target_date text default '2026-12-19T22:00:00',
  venue_name text default 'Estancia El Forestal',
  venue_address text default 'Estancia El Forestal',
  dress_code text default 'Black Tie / Elegante Riguroso',
  bg_image_url text default 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=2000&auto=format&fit=crop',
  bg_blur integer default 4,
  bg_opacity numeric default 0.8,
  overlay_color text default 'black',
  overlay_opacity numeric default 0.65,
  accent_color text default 'gold',
  instagram_url text default 'https://instagram.com',
  tiktok_url text default 'https://tiktok.com',
  spotify_url text default 'https://spotify.com',
  whatsapp_number text default '+1234567890',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Row Level Security)
alter table leforet_subscribers enable row level security;
alter table leforet_reservations enable row level security;
alter table leforet_settings enable row level security;

-- Allow public inserts for subscribers and reservations
create policy "Allow public insert subscribers" on leforet_subscribers for insert with check (true);
create policy "Allow public select subscribers" on leforet_subscribers for select using (true);

create policy "Allow public insert reservations" on leforet_reservations for insert with check (true);
create policy "Allow public select reservations" on leforet_reservations for select using (true);

create policy "Allow public read settings" on leforet_settings for select using (true);
create policy "Allow public update settings" on leforet_settings for update using (true);
create policy "Allow public insert settings" on leforet_settings for insert with check (true);
