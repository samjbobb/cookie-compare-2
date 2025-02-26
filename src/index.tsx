import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { parseIngredient, parseRecipe } from "./llm";
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

    return c.json({
      recipes,
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
