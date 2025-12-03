import React, { useState } from 'react';
import { Recipe } from '@/hooks/useRecipes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, ChefHat, ListChecks, BookOpen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ActiveRecipeCardProps {
  recipe: Recipe;
}

export const ActiveRecipeCard: React.FC<ActiveRecipeCardProps> = ({ recipe }) => {
  const [ingredientsOpen, setIngredientsOpen] = useState(true);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Now Cooking</CardTitle>
        </div>
        <p className="font-medium text-lg text-foreground">{recipe.title}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Ingredients */}
        <Collapsible open={ingredientsOpen} onOpenChange={setIngredientsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Ingredients ({recipe.ingredients?.length || 0})
                </span>
              </div>
              {ingredientsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-32 mt-2">
              <ul className="space-y-1 text-sm pl-2">
                {recipe.ingredients?.map((ing, i) => (
                  <li key={i} className="text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    {ing}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>

        {/* Instructions */}
        <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Steps ({recipe.instructions?.length || 0})
                </span>
              </div>
              {instructionsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-40 mt-2">
              <ol className="space-y-2 text-sm pl-2">
                {recipe.instructions?.map((step, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="text-primary font-medium mr-2">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>

        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Ask Chef G-Mini for guidance on any step!
        </p>
      </CardContent>
    </Card>
  );
};
