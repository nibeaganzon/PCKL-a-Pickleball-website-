-- Storage bucket for court and equipment inventory images
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory', 'inventory', true)
ON CONFLICT (id) DO UPDATE SET public = true;
