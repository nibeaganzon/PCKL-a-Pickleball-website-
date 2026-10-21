alter table public.courts
  add column court_type text not null default 'Outdoor',
  add column status text not null default 'Available',
  add constraint courts_court_type_check check (court_type in ('Indoor', 'Outdoor')),
  add constraint courts_status_check check (status in ('Available', 'Booked', 'Maintenance'));

update public.courts
set court_type = case
  when name in ('Court 01', 'Court 02', 'Court 05', 'Court 07', 'Court 10',
                'Court 12', 'Court 14', 'Court 16', 'Court 18', 'Court 20')
    then 'Indoor'
  else 'Outdoor'
end,
status = case name
  when 'Court 02' then 'Booked'
  when 'Court 05' then 'Maintenance'
  when 'Court 08' then 'Booked'
  else 'Available'
end
where name ~ '^Court (0[1-9]|1[0-9]|20)$';

insert into public.courts (name, description, court_type, status, price, images)
select
  'Court ' || lpad(court_number::text, 2, '0'),
  case
    when court_number in (1, 2, 5, 7, 10, 12, 14, 16, 18, 20)
      then 'Indoor court with weather-protected play.'
    else 'Outdoor court for your next pickleball session.'
  end,
  case
    when court_number in (1, 2, 5, 7, 10, 12, 14, 16, 18, 20)
      then 'Indoor'
    else 'Outdoor'
  end,
  case court_number
    when 2 then 'Booked'
    when 5 then 'Maintenance'
    when 8 then 'Booked'
    else 'Available'
  end,
  case
    when court_number in (1, 2, 5, 7, 10, 12, 14, 16, 18, 20) then 300
    else 250
  end,
  array[
    case
      when court_number in (1, 2, 5, 7, 10, 12, 14, 16, 18, 20)
        then 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85'
      else 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=900&q=85'
    end
  ]
from generate_series(1, 20) as court_numbers(court_number)
where not exists (
  select 1
  from public.courts existing
  where lower(existing.name) = lower('Court ' || lpad(court_number::text, 2, '0'))
);

insert into public.equipments (name, quantity, description, images, price)
select
  'Pickleball Paddle',
  20,
  'A paddle for practice sessions, casual rallies, and competitive games.',
  array['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=900&q=85'],
  50
where not exists (
  select 1 from public.equipments where lower(name) = lower('Pickleball Paddle')
);

insert into public.equipments (name, quantity, description, images, price)
select
  'Pickleball Ball',
  20,
  'Rent pickleball balls for your session and return them after playing.',
  array['https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=900&q=85'],
  10
where not exists (
  select 1 from public.equipments where lower(name) = lower('Pickleball Ball')
);
