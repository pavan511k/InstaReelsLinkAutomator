-- Supabase Storage: DM Images Bucket
-- Run this in Supabase SQL Editor

-- 1. Create the dm_images bucket (publicly accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dm_images', 'dm_images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if they exist (to allow safe re-runs)
DROP POLICY IF EXISTS "Anyone can view dm_images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dm_images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own dm_images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own dm_images" ON storage.objects;

-- 3. Set up RLS Policies for the dm_images bucket

-- Allow public read access to images
CREATE POLICY "Anyone can view dm_images"
ON storage.objects FOR SELECT
USING (bucket_id = 'dm_images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload dm_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'dm_images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to update their own images
CREATE POLICY "Users can update their own dm_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'dm_images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own dm_images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'dm_images' AND (storage.foldername(name))[1] = auth.uid()::text);
