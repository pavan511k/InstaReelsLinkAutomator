-- ============================================================
-- Storage bucket: dm_images
-- Stores user-uploaded images for Button Template DM slides.
-- Public read, authenticated write scoped to the user's folder.
--
-- Each file is stored as:
--   dm_images/{user_id}/{postId}_{prefix}_{slideIndex}_{timestamp}.{ext}
-- ============================================================

-- Create the bucket (publicly readable)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dm_images', 'dm_images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Anyone can view dm_images"                   ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload dm_images"    ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own dm_images"        ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own dm_images"        ON storage.objects;

-- Public read
CREATE POLICY "Anyone can view dm_images"
ON storage.objects FOR SELECT
USING (bucket_id = 'dm_images');

-- Authenticated upload — users can only write inside their own sub-folder
CREATE POLICY "Authenticated users can upload dm_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'dm_images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Update own images
CREATE POLICY "Users can update their own dm_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'dm_images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete own images
CREATE POLICY "Users can delete their own dm_images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'dm_images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
