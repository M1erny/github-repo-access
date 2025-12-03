import React, { useState } from 'react';
import { Recipe } from '@/hooks/useRecipes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, Link, FileImage, Plus, Trash2, BookOpen, X } from 'lucide-react';
import { AddRecipeDialog } from './AddRecipeDialog';

interface RecipePanelProps {
  recipes: Recipe[];
  activeRecipe: Recipe | null;
  onSelectRecipe: (recipe: Recipe | null) => void;
  onDeleteRecipe: (id: string) => void;
  onAddRecipe: (recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>) => Promise<any>;
  onParseUrl: (url: string) => Promise<Partial<Recipe> | null>;
  onParseFile: (file: File) => Promise<Partial<Recipe> | null>;
  loading: boolean;
}

export const RecipePanel: React.FC<RecipePanelProps> = ({
  recipes,
  activeRecipe,
  onSelectRecipe,
  onDeleteRecipe,
  onAddRecipe,
  onParseUrl,
  onParseFile,
  loading,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Recipes</h2>
        </div>
        <Button
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="gap-1"
        >
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      {/* Active Recipe Display */}
      {activeRecipe && (
        <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-primary uppercase tracking-wide">
              Now Cooking
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectRecipe(null)}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <h3 className="font-medium text-foreground truncate">{activeRecipe.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {activeRecipe.ingredients?.length || 0} ingredients • {activeRecipe.instructions?.length || 0} steps
          </p>
        </div>
      )}

      {/* Recipe List */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading recipes...
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-8">
            <ChefHat className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No recipes yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add a recipe URL or upload a photo
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  activeRecipe?.id === recipe.id
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-muted/50 border-transparent hover:border-border hover:bg-muted'
                }`}
                onClick={() => onSelectRecipe(recipe)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {recipe.source_url && <Link className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                      {recipe.file_path && <FileImage className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                      <h3 className="font-medium text-sm truncate">{recipe.title}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {recipe.ingredients?.length || 0} ingredients
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRecipe(recipe.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <AddRecipeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onAddRecipe={onAddRecipe}
        onParseUrl={onParseUrl}
        onParseFile={onParseFile}
      />
    </div>
  );
};
