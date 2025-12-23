import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Recipe {
  id: string;
  title: string;
  content: string | null;
  source_url: string | null;
  file_path: string | null;
  ingredients: string[] | null;
  instructions: string[] | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export const useRecipes = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);

  const fetchRecipes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipes((data as Recipe[]) || []);
    } catch (err) {
      console.error('Error fetching recipes:', err);
      toast({
        title: "Error",
        description: "Failed to load recipes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const addRecipe = async (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to save recipes",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from('recipes')
        .insert({ ...recipe, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      
      setRecipes(prev => [data as Recipe, ...prev]);
      toast({
        title: "Recipe Saved",
        description: `"${recipe.title}" has been added to your collection`,
      });
      return data as Recipe;
    } catch (err) {
      console.error('Error adding recipe:', err);
      toast({
        title: "Error",
        description: "Failed to save recipe",
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recipes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setRecipes(prev => prev.filter(r => r.id !== id));
      if (activeRecipe?.id === id) {
        setActiveRecipe(null);
      }
      toast({
        title: "Recipe Deleted",
        description: "Recipe has been removed",
      });
    } catch (err) {
      console.error('Error deleting recipe:', err);
      toast({
        title: "Error",
        description: "Failed to delete recipe",
        variant: "destructive",
      });
    }
  };

  const parseRecipeFromUrl = async (url: string): Promise<Partial<Recipe> | null> => {
    try {
      // First fetch the URL content
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const html = await response.text();
      
      // Extract text content from HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const textContent = doc.body?.textContent || '';
      
      // Send to AI for parsing
      const { data, error } = await supabase.functions.invoke('parse-recipe', {
        body: { content: textContent.slice(0, 15000), type: 'url' }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return {
        title: data.recipe.title,
        content: textContent.slice(0, 5000),
        source_url: url,
        ingredients: data.recipe.ingredients,
        instructions: data.recipe.instructions,
      };
    } catch (err) {
      console.error('Error parsing recipe from URL:', err);
      toast({
        title: "Error",
        description: "Failed to parse recipe from URL",
        variant: "destructive",
      });
      return null;
    }
  };

  const parseRecipeFromFile = async (file: File): Promise<Partial<Recipe> | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to upload files",
          variant: "destructive",
        });
        return null;
      }

      // Upload file to user's folder for RLS compliance
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('recipe-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get signed URL since bucket is now private
      const { data: urlData, error: urlError } = await supabase.storage
        .from('recipe-files')
        .createSignedUrl(fileName, 3600);

      if (urlError) throw urlError;

      // For images, we'll extract text using a simple approach
      let content = '';
      
      if (file.type.startsWith('image/')) {
        // For images, we'll pass the base64 to the AI
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });
        content = `[Image content - base64 encoded image of a recipe]`;
      } else if (file.type === 'application/pdf') {
        content = `[PDF content - please extract recipe from uploaded PDF at ${urlData.signedUrl}]`;
      } else {
        content = await file.text();
      }

      // Send to AI for parsing
      const { data, error } = await supabase.functions.invoke('parse-recipe', {
        body: { content: content.slice(0, 15000), type: file.type.startsWith('image/') ? 'image' : 'text' }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return {
        title: data.recipe.title,
        content: content.slice(0, 5000),
        file_path: fileName,
        ingredients: data.recipe.ingredients,
        instructions: data.recipe.instructions,
      };
    } catch (err) {
      console.error('Error parsing recipe from file:', err);
      toast({
        title: "Error",
        description: "Failed to parse recipe from file",
        variant: "destructive",
      });
      return null;
    }
  };

  const parseRecipeFromText = async (text: string): Promise<Partial<Recipe> | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('parse-recipe', {
        body: { content: text, type: 'text' }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return {
        title: data.recipe.title,
        content: text,
        ingredients: data.recipe.ingredients,
        instructions: data.recipe.instructions,
      };
    } catch (err) {
      console.error('Error parsing recipe from text:', err);
      toast({
        title: "Error",
        description: "Failed to parse recipe from text",
        variant: "destructive",
      });
      return null;
    }
  };

  return {
    recipes,
    loading,
    activeRecipe,
    setActiveRecipe,
    addRecipe,
    deleteRecipe,
    parseRecipeFromUrl,
    parseRecipeFromFile,
    parseRecipeFromText,
    refreshRecipes: fetchRecipes,
  };
};
