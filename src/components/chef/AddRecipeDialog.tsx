import React, { useState, useRef } from 'react';
import { Recipe } from '@/hooks/useRecipes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link, Upload, Loader2, Check, FileImage, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddRecipe: (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => Promise<unknown>;
  onParseUrl: (url: string) => Promise<Partial<Recipe> | null>;
  onParseFile: (file: File) => Promise<Partial<Recipe> | null>;
  onParseText: (text: string) => Promise<Partial<Recipe> | null>;
}

export const AddRecipeDialog: React.FC<AddRecipeDialogProps> = ({
  open,
  onOpenChange,
  onAddRecipe,
  onParseUrl,
  onParseFile,
  onParseText,
}) => {
  const [url, setUrl] = useState('');
  const [recipeText, setRecipeText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedRecipe, setParsedRecipe] = useState<Partial<Recipe> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParseUrl = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setParsedRecipe(null);

    const recipe = await onParseUrl(url);
    if (recipe) {
      setParsedRecipe(recipe);
      toast({
        title: "Recipe Found",
        description: `Found: "${recipe.title}"`,
      });
    }
    setIsLoading(false);
  };

  const handleParseText = async () => {
    if (!recipeText.trim()) {
      toast({
        title: "Error",
        description: "Please enter recipe text",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setParsedRecipe(null);

    const recipe = await onParseText(recipeText);
    if (recipe) {
      setParsedRecipe(recipe);
      toast({
        title: "Recipe Found",
        description: `Found: "${recipe.title}"`,
      });
    }
    setIsLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setParsedRecipe(null);

    const recipe = await onParseFile(file);
    if (recipe) {
      setParsedRecipe(recipe);
      toast({
        title: "Recipe Found",
        description: `Found: "${recipe.title}"`,
      });
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!parsedRecipe?.title) {
      toast({
        title: "Error",
        description: "No recipe to save",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const result = await onAddRecipe({
      title: parsedRecipe.title,
      content: parsedRecipe.content || null,
      source_url: parsedRecipe.source_url || null,
      file_path: parsedRecipe.file_path || null,
      ingredients: parsedRecipe.ingredients || null,
      instructions: parsedRecipe.instructions || null,
    });

    if (result) {
      onOpenChange(false);
      setUrl('');
      setRecipeText('');
      setParsedRecipe(null);
    }
    setIsLoading(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setUrl('');
    setRecipeText('');
    setParsedRecipe(null);
    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Recipe</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="text" className="gap-2">
              <FileText className="w-4 h-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <Link className="w-4 h-4" />
              URL
            </TabsTrigger>
            <TabsTrigger value="file" className="gap-2">
              <FileImage className="w-4 h-4" />
              File
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4 mt-4">
            <Textarea
              placeholder="Paste or type your recipe here...

Example:
Spaghetti Carbonara

Ingredients:
- 400g spaghetti
- 200g pancetta
- 4 egg yolks
- 100g parmesan

Instructions:
1. Cook pasta in salted water
2. Fry pancetta until crispy
3. Mix eggs with cheese
4. Combine all together"
              value={recipeText}
              onChange={(e) => setRecipeText(e.target.value)}
              disabled={isLoading}
              className="min-h-[200px] text-sm"
            />
            <Button onClick={handleParseText} disabled={isLoading || !recipeText.trim()} className="w-full">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Parse Recipe
            </Button>
            <p className="text-xs text-muted-foreground">
              Paste any recipe text and Chef G-Mini will extract the ingredients and steps.
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input
                placeholder="Paste recipe URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
              <Button onClick={handleParseUrl} disabled={isLoading || !url.trim()}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Parse'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a link to any recipe page and Chef G-Mini will extract the ingredients and steps.
            </p>
          </TabsContent>

          <TabsContent value="file" className="space-y-4 mt-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,.pdf,.txt"
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full h-24 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Click to upload image or PDF</span>
                </div>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Upload a screenshot, photo, or PDF of a recipe.
            </p>
          </TabsContent>
        </Tabs>

        {/* Parsed Recipe Preview */}
        {parsedRecipe && (
          <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Check className="w-4 h-4" />
              <span className="font-medium">Recipe Found</span>
            </div>
            <h3 className="font-semibold">{parsedRecipe.title}</h3>
            <div className="text-sm text-muted-foreground">
              <p>{parsedRecipe.ingredients?.length || 0} ingredients</p>
              <p>{parsedRecipe.instructions?.length || 0} steps</p>
            </div>
            <Button onClick={handleSave} disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Save Recipe
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
