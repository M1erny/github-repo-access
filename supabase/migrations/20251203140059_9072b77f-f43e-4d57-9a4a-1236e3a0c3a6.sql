-- Create recipes table
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  source_url TEXT,
  file_path TEXT,
  ingredients TEXT[],
  instructions TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (public access for now since no auth)
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for recipes (no auth required)
CREATE POLICY "Allow public read access" ON public.recipes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.recipes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.recipes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.recipes FOR DELETE USING (true);

-- Create storage bucket for recipe files
INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-files', 'recipe-files', true);

-- Storage policies
CREATE POLICY "Allow public read recipe files" ON storage.objects FOR SELECT USING (bucket_id = 'recipe-files');
CREATE POLICY "Allow public upload recipe files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'recipe-files');
CREATE POLICY "Allow public delete recipe files" ON storage.objects FOR DELETE USING (bucket_id = 'recipe-files');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();