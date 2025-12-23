-- Add user_id column to recipes table for ownership
ALTER TABLE public.recipes ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read access" ON public.recipes;
DROP POLICY IF EXISTS "Allow public insert access" ON public.recipes;
DROP POLICY IF EXISTS "Allow public update access" ON public.recipes;
DROP POLICY IF EXISTS "Allow public delete access" ON public.recipes;

-- Create owner-based policies
CREATE POLICY "Users can read own recipes" ON public.recipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipes" ON public.recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes" ON public.recipes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes" ON public.recipes
  FOR DELETE USING (auth.uid() = user_id);

-- Make storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'recipe-files';

-- Drop existing storage policies
DROP POLICY IF EXISTS "Allow public read recipe files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public upload recipe files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete recipe files" ON storage.objects;

-- Create authenticated storage policies (folder-based ownership)
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'recipe-files' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'recipe-files' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'recipe-files' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );