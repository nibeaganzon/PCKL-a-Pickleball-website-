-- Local development seed file
-- Automatically run by `supabase db reset`

-- 1. Create pgcrypto extension if needed for crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Seed initial admin user: nbhganzon@addu.edu.ph (Password: password123)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '2752d2fd-bed7-4837-a58b-dfe1a9967d7f',
  'authenticated',
  'authenticated',
  'nbhganzon@addu.edu.ph',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Nicole Beatriz Ganzon"}',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE
  SET email = 'nbhganzon@addu.edu.ph',
      raw_user_meta_data = '{"full_name":"Nicole Beatriz Ganzon"}',
      encrypted_password = extensions.crypt('password123', extensions.gen_salt('bf')),
      email_confirmed_at = now();

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '2752d2fd-bed7-4837-a58b-dfe1a9967d7f',
  '2752d2fd-bed7-4837-a58b-dfe1a9967d7f',
  '{"sub":"2752d2fd-bed7-4837-a58b-dfe1a9967d7f","email":"nbhganzon@addu.edu.ph"}',
  'email',
  'nbhganzon@addu.edu.ph',
  now(),
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- 3. Register into admin_members
INSERT INTO public.admin_members (user_id)
VALUES ('2752d2fd-bed7-4837-a58b-dfe1a9967d7f')
ON CONFLICT (user_id) DO NOTHING;
