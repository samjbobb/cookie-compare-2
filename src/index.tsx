import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  analyzeRatio,
  parseIngredient,
  parseRecipe,
  suggestRatios,
} from "./llm";
import { logger } from "hono/logger";

const app = new Hono();
app.use(logger());

const routes = app.post(
  "/api/compare-recipes",
  zValidator(
    "json",
    z.object({
      recipeTexts: z.array(z.string()),
    }),
  ),
  async (c) => {
    const { recipeTexts } = c.req.valid("json");

    console.log("parsing recipes");
    const recipes = await Promise.all(
      recipeTexts.map(async (recipeText) => {
        const parsedRecipe = await parseRecipe(recipeText);
        if ("error" in parsedRecipe) {
          return parsedRecipe;
        }
        const parsedIngredients = await Promise.all(
          parsedRecipe.ingredients.map(async (ingredient) =>
            parseIngredient(ingredient),
          ),
        );
        return {
          ...parsedRecipe,
          ingredients: parsedIngredients,
        };
      }),
    );

    console.log("suggesting ratios");
    const ratiosToAnalyze = await suggestRatios(
      recipes.filter((r) => !("error" in r)),
    );

    console.log("analyzing ratios");
    const recipesWithRatios = await Promise.all(
      recipes.map(async (recipe) => {
        if ("error" in recipe) return recipe;
        const ratios = Object.fromEntries(
          await Promise.all(
            ratiosToAnalyze.map(async (ratio) => {
              return [
                ratio.name,
                await analyzeRatio(recipe.ingredients, ratio),
              ] as const;
            }),
          ),
        );
        return {
          ...recipe,
          ratios,
        };
      }),
    );

    return c.json({
      recipes: recipesWithRatios,
      ratiosToAnalyze,
    });
  },
);

export type AppType = typeof routes;

app.get("*", (c) => {
  return c.html(
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <link
          rel="stylesheet"
          href="https://cdn.simplecss.org/simple.min.css"
        />
        {import.meta.env.PROD ? (
          <script type="module" src="/static/client.js"></script>
        ) : (
          <script type="module" src="/src/client.tsx"></script>
        )}
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>,
  );
});

export default app;
