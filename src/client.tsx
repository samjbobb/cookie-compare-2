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
};

function ParsedIngredient({ ingredient }: ParsedIngredientProps) {
  const [showOriginal, setShowOriginal] = useState(true);

  if ("error" in ingredient) {
    return <div class="error">{ingredient.error}</div>;
  }

  const toggleView = () => setShowOriginal(!showOriginal);

  if (showOriginal) {
    return (
      <div class="ingredient" onClick={toggleView}>
        {ingredient.originalText}
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
      {ingredient.expressionConvertingToMassInGrams && (
        <span class="notes">
          {ingredient.expressionConvertingToMassInGrams}
        </span>
      )}
      {ingredient.inGrams && (
        <span class="notes">In grams: {ingredient.inGrams}</span>
      )}
      {"error" in ingredient && <span class="error">{ingredient.error}</span>}
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

  const handleRecipeChange = (index: number, value: string) => {
    const newRecipes = [...recipeTexts];
    newRecipes[index] = value;
    setRecipeTexts(newRecipes);
  };

  const addRecipe = () => {
    setRecipeTexts([...recipeTexts, ""]);
  };

  const compareRecipes = async () => {
    const response = await client.api["compare-recipes"].$post({
      json: { recipeTexts },
    });
    const data = await response.json();
    setComparisonResult(data);
  };

  return (
    <div class="container">
      <h1>Cookie Recipe Comparison</h1>

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
        <button onClick={addRecipe}>Add Another Recipe</button>
        <button onClick={compareRecipes}>Save and Compare</button>
      </div>

      {comparisonResult && (
        <div class="comparison-results">
          <h2>Comparison Results</h2>
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
