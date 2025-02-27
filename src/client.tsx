import { hc, InferResponseType } from "hono/client";
import type { AppType } from ".";
import { useState } from "hono/jsx";
import { render } from "hono/jsx/dom";

const client = hc<AppType>("/");

type ComparisonResponse = InferResponseType<
  (typeof client.api)["compare-recipes"]["$post"]
>;
type RecipeResult = NonNullable<ComparisonResponse>["recipes"][number];
type IngredientResult = NonNullable<
  Extract<RecipeResult, { ingredients: any }>
>["ingredients"][number];

type ParsedIngredientProps = {
  ingredient: IngredientResult;
  showConversion?: boolean;
};

function ParsedIngredient({
  ingredient,
  showConversion,
}: ParsedIngredientProps) {
  const [showOriginal, setShowOriginal] = useState(true);

  if ("error" in ingredient) {
    return <div class="error">{ingredient.error}</div>;
  }

  const toggleView = () => setShowOriginal(!showOriginal);

  if (showOriginal) {
    return (
      <div class="ingredient" onClick={toggleView}>
        {ingredient.originalText}
        {showConversion && ingredient.inGrams && (
          <span class="notes"> ({ingredient.inGrams.toFixed(0)}g)</span>
        )}
      </div>
    );
  }

  return (
    <div class="ingredient parsed" onClick={toggleView}>
      {ingredient.quantity && (
        <span class="quantity">{ingredient.quantity}</span>
      )}
      {ingredient.unit && <span class="unit">{ingredient.unit}</span>}
      {ingredient.product && <span class="product">{ingredient.product}</span>}
      {ingredient.preparation && (
        <span class="prep">{ingredient.preparation}</span>
      )}
      {ingredient.notes && <span class="notes">{ingredient.notes}</span>}
      {ingredient.expressionConvertingToMassInGrams && ingredient.inGrams && (
        <span class="notes">
          {ingredient.expressionConvertingToMassInGrams} ={" "}
          {ingredient.inGrams.toFixed(0)}g
        </span>
      )}
      {"error" in ingredient && <span class="error">{ingredient.error}</span>}
    </div>
  );
}

type RatioAnalysisTableProps = {
  ratios: NonNullable<ComparisonResponse>["ratiosToAnalyze"];
  recipes: NonNullable<ComparisonResponse>["recipes"];
};

function RatioAnalysisTable({ ratios, recipes }: RatioAnalysisTableProps) {
  return (
    <div class="ratio-analysis">
      <h3>Ratio Analysis</h3>
      <div class="ratio-table-container">
        <table class="ratio-table">
          <thead>
            <tr>
              <th>Recipe</th>
              {ratios.map((ratio) => (
                <th key={ratio.name}>{ratio.name}</th>
              ))}
            </tr>
            <tr>
              <td></td>
              {ratios.map((ratio) => (
                <td key={ratio.name} style={{ fontSize: "0.8em" }}>{ratio.description}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {recipes.map(
              (recipe, recipeIndex) =>
                !("error" in recipe) && (
                  <tr key={recipeIndex}>
                    <td>{recipe.name}</td>
                    {ratios.map((ratio) => {
                      const ratioResult = recipe.ratios[ratio.name];
                      return (
                        <td key={ratio.name} class="ratio-cell">
                          {ratioResult?.ratioValue !== undefined &&
                          ratioResult.ratioValue !== null ? (
                            <div
                              class="ratio-value"
                              onMouseEnter={(e) => {
                                // @ts-ignore
                                const details = e.currentTarget.querySelector(
                                  ".ratio-details",
                                ) as HTMLElement;
                                if (details) {
                                  const rect =
                                    // @ts-ignore
                                    e.currentTarget.getBoundingClientRect();
                                  const spaceBelow =
                                    window.innerHeight - rect.bottom;
                                  const spaceRight =
                                    window.innerWidth - rect.right;

                                  // Position the details box
                                  details.style.top =
                                    spaceBelow > 300
                                      ? `${rect.bottom + 10}px`
                                      : `${rect.top - 10}px`;
                                  details.style.left =
                                    spaceRight > 400
                                      ? `${rect.right + 10}px`
                                      : `${rect.left - 310}px`;
                                  details.style.transform =
                                    spaceBelow > 300
                                      ? "none"
                                      : "translateY(-100%)";
                                }
                              }}
                            >
                              {ratioResult.ratioValue.toFixed(2)}
                              <div class="ratio-details">
                                <strong>Numerator:</strong>
                                <ul>
                                  {ratioResult.numeratorIngredients.map(
                                    (ing, i) => (
                                      <li key={i}>
                                        <ParsedIngredient
                                          ingredient={ing}
                                          showConversion={true}
                                        />
                                      </li>
                                    ),
                                  )}
                                </ul>
                                <strong>Denominator:</strong>
                                <ul>
                                  {ratioResult.denominatorIngredients.map(
                                    (ing, i) => (
                                      <li key={i}>
                                        <ParsedIngredient
                                          ingredient={ing}
                                          showConversion={true}
                                        />
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            </div>
                          ) : (
                            <span class="no-ratio">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ParsedRecipeProps = {
  recipe: RecipeResult;
};

function ParsedRecipe({ recipe }: ParsedRecipeProps) {
  if ("error" in recipe) {
    return <div class="error">{recipe.error}</div>;
  }

  return (
    <div class="recipe-result">
      <h3>{recipe.name}</h3>

      <h4>Ingredients:</h4>
      <ul>
        {recipe.ingredients.map((ing, i) => (
          <li key={i}>
            <ParsedIngredient ingredient={ing} />
          </li>
        ))}
      </ul>

      <h4>Directions:</h4>
      <ol>
        {recipe.instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

const SAMPLE_RECIPES = [
  `Classic Chocolate Chip Cookies
2 1/4 cups all-purpose flour
1 cup butter, softened
3/4 cup granulated sugar
3/4 cup packed brown sugar
1 teaspoon vanilla extract
2 large eggs
2 cups semi-sweet chocolate chips
1 teaspoon baking soda
1/2 teaspoon salt

Preheat oven to 375°F
Cream together butter and sugars
Beat in eggs and vanilla
Mix in dry ingredients
Stir in chocolate chips
Drop by rounded tablespoons onto ungreased baking sheets
Bake 9 to 11 minutes until golden brown`,

  `Oatmeal Raisin Cookies
1 1/2 cups all-purpose flour
1 cup butter, softened
3/4 cup brown sugar
1/2 cup white sugar
2 eggs
1 teaspoon vanilla extract
2 1/2 cups old-fashioned oats
1 cup raisins
1 teaspoon baking soda
1 teaspoon ground cinnamon
1/2 teaspoon salt

Preheat oven to 350°F
Cream butter and sugars until smooth
Beat in eggs and vanilla
Mix in flour, baking soda, cinnamon, and salt
Stir in oats and raisins
Drop rounded tablespoons onto baking sheets
Bake 10-12 minutes until golden brown`,

  `Snickerdoodle Cookies
2 3/4 cups all-purpose flour
1 cup butter, softened
1 1/2 cups sugar
2 eggs
2 teaspoons cream of tartar
1 teaspoon baking soda
1/4 teaspoon salt
2 tablespoons sugar (for rolling)
2 teaspoons ground cinnamon (for rolling)

Preheat oven to 375°F
Cream butter and sugar until light and fluffy
Beat in eggs one at a time
Mix in flour, cream of tartar, baking soda, and salt
Shape dough into 1-inch balls
Roll in cinnamon-sugar mixture
Bake 10-12 minutes until edges are lightly browned`,

  `Peanut Butter Cookies
1 3/4 cups all-purpose flour
1 cup peanut butter
1/2 cup butter, softened
1/2 cup granulated sugar
1/2 cup packed brown sugar
1 egg
1 teaspoon vanilla extract
1 teaspoon baking soda
1/4 teaspoon salt

Preheat oven to 350°F
Cream peanut butter, butter, and sugars
Beat in egg and vanilla
Mix in flour, baking soda, and salt
Shape into 1-inch balls
Press with fork to make crisscross pattern
Bake 10-12 minutes until edges are lightly browned`,
];

function App() {
  const [recipeTexts, setRecipeTexts] = useState<string[]>(["", ""]);
  const [comparisonResult, setComparisonResult] =
    useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  const handleRecipeChange = (index: number, value: string) => {
    const newRecipes = [...recipeTexts];
    newRecipes[index] = value;
    setRecipeTexts(newRecipes);
  };

  const addRecipe = () => {
    setRecipeTexts([...recipeTexts, ""]);
  };

  const compareRecipes = async () => {
    setIsLoading(true);
    try {
      const response = await client.api["compare-recipes"].$post({
        json: { recipeTexts },
      });
      const data = await response.json();
      setComparisonResult(data);
    } catch (error) {
      console.error('Error comparing recipes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="container">
      <h1>Recipe Ratio Comparison</h1>

      <div class="recipe-inputs">
        {recipeTexts.map((text, index) => (
          <div key={index} class="recipe-input">
            <h3>Recipe {index + 1}</h3>
            <textarea
              value={text}
              onInput={(e) =>
                handleRecipeChange(
                  index,
                  (e.target as HTMLTextAreaElement).value,
                )
              }
              rows={10}
              cols={50}
              placeholder={`Paste your recipe here...\nExample:\nChocolate Chip Cookies\n2 cups flour\n1 cup sugar\n2 cups chocolate chips\nMix ingredients\nBake at 350F`}
            />
            <button
              onClick={() => {
                const randomRecipe =
                  SAMPLE_RECIPES[
                    Math.floor(Math.random() * SAMPLE_RECIPES.length)
                  ];
                handleRecipeChange(index, randomRecipe);
              }}
              class="random-recipe-btn"
            >
              Fill with Random Recipe
            </button>
          </div>
        ))}
      </div>

      <div class="actions">
        <button onClick={addRecipe} disabled={isLoading}>Add Another Recipe</button>
        <button onClick={compareRecipes} disabled={isLoading}>
          {isLoading ? 'Comparing...' : 'Save and Compare'}
        </button>
      </div>
      {isLoading && (
        <div class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-text">Analyzing recipes...</div>
        </div>
      )}

      {comparisonResult && (
        <div class="comparison-results">
          <h2>Comparison Results</h2>
          {comparisonResult.ratiosToAnalyze &&
            comparisonResult.recipes.some((r) => !("error" in r)) && (
              <RatioAnalysisTable
                ratios={comparisonResult.ratiosToAnalyze}
                recipes={comparisonResult.recipes}
              />
            )}
          {comparisonResult.recipes.map((recipe, index) => (
            <ParsedRecipe key={index} recipe={recipe} />
          ))}
        </div>
      )}

      <style>{`
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .recipe-inputs { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
        .recipe-input { flex: 1; min-width: 300px; }    
        .actions { margin-bottom: 30px; }
        .actions button { margin-right: 10px; }
        .recipe-result { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .error { color: red; padding: 8px; background: #fff0f0; border-radius: 4px; }
        .ingredient { cursor: pointer; padding: 4px 8px; border-radius: 4px; }
        .ingredient:hover { background: #f0f0f0; }
        .ingredient.parsed { display: flex; gap: 8px; }
        .ingredient.parsed span { padding: 2px 6px; border-radius: 4px; }
        .ingredient.parsed .quantity { background: #e3f2fd; }
        .ingredient.parsed .unit { background: #e8f5e9; }
        .ingredient.parsed .product { background: #fff3e0; }
        .ingredient.parsed .prep { background: #f3e5f5; }
        .ingredient.parsed .notes { background: #fce4ec; }
        textarea { width: 100%; margin-bottom: 10px; }
        .ratio-analysis { margin: 20px 0; position: relative; }
        .ratio-table-container { 
          overflow-x: auto; 
          margin-bottom: 20px; /* Space for potential overflow of ratio details */
        }

        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loading-text {
          margin-top: 20px;
          font-size: 18px;
          color: #333;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .ratio-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 10px 0; 
        }
        .ratio-table th, .ratio-table td { 
          border: 1px solid #ddd; 
          padding: 8px; 
          text-align: left;
        }
        .ratio-table th { 
          background: #f5f5f5;
        }
        .ratio-cell { 
          position: static; /* Changed from relative to allow details to position relative to table container */
        }
        .ratio-value { 
          cursor: pointer; 
          position: relative; /* Make this relative so we can position the tooltip relative to the value */
          display: inline-block; /* Ensure the value doesn't take full width */
        }
        .ratio-value:hover .ratio-details { 
          display: block; 
          opacity: 1;
          visibility: visible;
        }
        .ratio-details { 
          display: block;
          visibility: hidden;
          opacity: 0;
          position: fixed; /* Fixed positioning relative to viewport */
          background: white;
          border: 1px solid #ddd;
          padding: 10px;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          z-index: 1000;
          min-width: 300px;
          max-width: 400px;
          max-height: 80vh; /* Maximum height relative to viewport */
          overflow-y: auto; /* Allow scrolling if content is too tall */
          transition: opacity 0.2s ease-in-out, visibility 0.2s ease-in-out;
        }
        .no-ratio { color: #999; }
        .random-recipe-btn { 
          display: block;
          margin-bottom: 20px;
          padding: 8px 16px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .random-recipe-btn:hover {
          background-color: #45a049;
        }
        `}</style>
    </div>
  );
}

const root = document.getElementById("root")!;
render(<App />, root);
