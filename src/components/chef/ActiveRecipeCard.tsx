import React from 'react';
import { Recipe } from '@/hooks/useRecipes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChefHat, ListChecks, BookOpen, Check } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';

interface ActiveRecipeCardProps {
  recipe: Recipe;
  currentStep: number;
  onStepChange: (step: number) => void;
}

export const ActiveRecipeCard: React.FC<ActiveRecipeCardProps> = ({ 
  recipe, 
  currentStep, 
  onStepChange 
}) => {
  const [ingredientsOpen, setIngredientsOpen] = React.useState(false);
  const [allStepsOpen, setAllStepsOpen] = React.useState(false);

  const totalSteps = recipe.instructions?.length || 0;
  const progressPercent = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;
  const currentInstruction = recipe.instructions?.[currentStep] || '';

  const goToPrevStep = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1);
    }
  };

  const goToNextStep = () => {
    if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    }
  };

  const markStepComplete = () => {
    if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1);
    }
  };

  return (
    <Card className="bg-card border-primary/30 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Now Cooking</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            Step {currentStep + 1} of {totalSteps}
          </span>
        </div>
        <p className="font-semibold text-lg text-foreground">{recipe.title}</p>
        
        {/* Progress Bar */}
        <div className="pt-2">
          <Progress value={progressPercent} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Step - Prominent Display */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-primary text-primary-foreground text-sm font-bold w-7 h-7 rounded-full flex items-center justify-center">
              {currentStep + 1}
            </span>
            <span className="text-sm font-medium text-primary">Current Step</span>
          </div>
          <p className="text-foreground leading-relaxed">{currentInstruction}</p>
          
          {/* Step Navigation */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-primary/20">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={goToPrevStep}
              disabled={currentStep === 0}
              className="text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <Button 
              variant="default" 
              size="sm" 
              onClick={markStepComplete}
              disabled={currentStep >= totalSteps - 1}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              Done, Next
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={goToNextStep}
              disabled={currentStep >= totalSteps - 1}
              className="text-muted-foreground"
            >
              Skip
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Step Dots Navigator */}
        <div className="flex justify-center gap-1.5 flex-wrap">
          {recipe.instructions?.map((_, i) => (
            <button
              key={i}
              onClick={() => onStepChange(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentStep 
                  ? 'bg-primary scale-125' 
                  : i < currentStep 
                    ? 'bg-primary/50' 
                    : 'bg-muted-foreground/30'
              }`}
              title={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Ingredients - Collapsed */}
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

        {/* All Steps - Collapsed */}
        <Collapsible open={allStepsOpen} onOpenChange={setAllStepsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  All Steps ({totalSteps})
                </span>
              </div>
              {allStepsOpen ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className="max-h-48 mt-2">
              <ol className="space-y-2 text-sm pl-2">
                {recipe.instructions?.map((step, i) => (
                  <li 
                    key={i} 
                    className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${
                      i === currentStep 
                        ? 'bg-primary/10 text-foreground' 
                        : i < currentStep 
                          ? 'text-muted-foreground/60 line-through' 
                          : 'text-muted-foreground'
                    }`}
                    onClick={() => onStepChange(i)}
                  >
                    <span className={`font-medium min-w-[1.5rem] ${
                      i === currentStep ? 'text-primary' : ''
                    }`}>
                      {i + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>

        <p className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
          Ask Chef G-Mini about the current step!
        </p>
      </CardContent>
    </Card>
  );
};
