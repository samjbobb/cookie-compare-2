import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { evaluate } from "mathjs";
import { traceable } from "langsmith/traceable";
import { wrapOpenAI } from "langsmith/wrappers";
import util from "util";
util.inspect.defaultOptions.depth = null;

export const openai = wrapOpenAI(new OpenAI());
const model = "gpt-4o-mini-2024-07-18";

export const analyzeRecipesForRatios = traceable(
  async (recipeTexts: string[]) => {
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

    return {
      recipes: recipesWithRatios,
      ratiosToAnalyze,
    };
  },
);

function withError<T>(schema: z.ZodType<T>) {
  return z.object({
    data: schema.optional(),
    error: z.string().optional(),
  });
}

const RecipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()),
  instructions: z.array(z.string()),
});

export async function parseRecipe(recipe: string) {
  const completion = await openai.beta.chat.completions.parse({
    model,
    messages: [
      {
        role: "developer",
        content:
          "Parse the following recipe into the requested schema. Do not add any additional information. If the recipe is not valid, return an error object.",
      },
      {
        role: "user",
        content: recipe,
      },
    ],

    response_format: zodResponseFormat(withError(RecipeSchema), "RecipeSchema"),
  });
  const out = completion.choices[0].message.parsed;
  if (out === null) {
    return { error: "Failed to parse" };
  } else if (out.error) {
    return { error: out.error };
  } else if (!out.data) {
    return { error: "Failed to parse" };
  }
  return out.data;
}

const IngredientSchema = z.object({
  quantity: z.string(),
  unit: z.string(),
  product: z.string(),
  preparation: z.string().optional(),
  notes: z.string().optional(),
  expressionConvertingToMassInGrams: z.string().optional(),
});

interface ParsedIngredient {
  originalText: string;
  error?: string;
  quantity?: string;
  unit?: string;
  product?: string;
  preparation?: string;
  notes?: string;
  expressionConvertingToMassInGrams?: string;
  inGrams?: number;
}

export async function parseIngredient(
  ingredient: string,
): Promise<ParsedIngredient> {
  const completion = await openai.beta.chat.completions.parse({
    model,
    messages: [
      {
        role: "developer",
        content: [
          "Parse the following ingredient into the requested schema. ",
          "Do not add any additional information. ",
          "If there are alternate measurements, return only the main measurement for quantity and unit. ",
          "If the measurement unit is volumetric, return the conversion to grams in 'expressionConvertingToMassInGrams'.",
          "The expression will be executed by Math.js.",
          "It is important that the units in the expression cancel out to yield grams.",
          "Do not do any arithmetic yourself.",
          "If the ingredient is not valid, return an error object.",
          "",
          "Example 1:",
          "Ingredient: `1 cup of flour`",
          "And you know the conversion for flour is 120 grams per cup.",
          "Parsed: { quantity: '1', unit: 'cup', product: 'flour', expressionConvertingToMassInGrams: '1 cup * (120 grams / 1 cup)' }",
          "",
          "Example 2:",
          "Ingredient: `1/2 cup of sugar`",
          "And you know the conversion for sugar is 50 grams per 1/4 cup.",
          "Parsed: { quantity: '1/2', unit: 'cup', product: 'sugar', expressionConvertingToMassInGrams: '1/2 cup * (50 grams / 1/4 cup)' }",
          "",
          "Example 3:",
          "Math.js can convert between units of mass.",
          "Ingredient: `1 kg of sugar`",
          "Parsed: { quantity: '1', unit: 'kg', product: 'sugar', expressionConvertingToMassInGrams: '1 kg to grams' }",
          "",
          "Example 4:",
          "For ingredients measured by count, such as eggs, write a conversion multiplying the count by the mass per count.",
          "Ingredient: `2 large eggs`",
          "And you know large eggs are 50 grams per egg.",
          "Parsed: { quantity: '2', unit: 'large', product: 'eggs', expressionConvertingToMassInGrams: '2 * 50 grams' }",
          "",
          "Example 5:",
          "Ingredient: `500g of sugar`",
          "Parsed: { quantity: '500', unit: 'g', product: 'sugar', expressionConvertingToMassInGrams: '500 grams' }",
          "",
          "Example 6:",
          "Math.js cannot handle `1 1/2` as a number. You should convert it to a decimal.",
          "Ingredient: `1 1/2 cup flour`",
          "Parsed: { quantity: '1.5', unit: 'cup', product: 'flour', expressionConvertingToMassInGrams: '1.5 cup * (120 grams / 1 cup)' }",
        ].join("\n"),
      },
      {
        role: "user",
        content: ingredient,
      },
    ],

    response_format: zodResponseFormat(
      withError(IngredientSchema),
      "RecipeSchema",
    ),
  });
  const out = completion.choices[0].message.parsed;
  if (out === null) {
    return { originalText: ingredient, error: "Failed to parse" };
  } else if (out.error) {
    return { originalText: ingredient, error: out.error };
  }
  return {
    originalText: ingredient,
    ...(out.data ?? {}),
    inGrams: out.data
      ? evaluateExpressionToGrams(out.data.expressionConvertingToMassInGrams)
      : undefined,
  };
}

function evaluateExpressionToGrams(expression?: string) {
  if (!expression) return;
  try {
    return evaluate(expression).toNumber("g") as number;
  } catch (e) {
    console.error("Failed to evaluate expression", expression, e);
    return;
  }
}

const RatioDescriptionListSchema = z.object({
  ratios: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    }),
  ),
});

export async function suggestRatios(
  recipes: { name: string; ingredients: { originalText: string }[] }[],
) {
  const formatIngredients = (ingredients: { originalText: string }[]) =>
    ingredients.map((i) => `* ${i.originalText}`).join("\n");

  const formattedRecipes = recipes
    .map((r) => `# ${r.name}\n${formatIngredients(r.ingredients)}`)
    .join("\n\n");

  const completion = await openai.beta.chat.completions.parse({
    model,
    messages: [
      {
        role: "developer",
        content: [
          "Given the following list of recipes, suggest a list of ratios to analyze the similarities and differences between the recipes. ",
          "For example, if the recipes are for cakes, you might suggest a ratio of flour to sugar. ",
          "Provide a short name and a longer description for each ratio. ",
          "If there are no suitable ratios, return an empty array.",
        ].join("\n"),
      },
      {
        role: "user",
        content: formattedRecipes,
      },
    ],

    response_format: zodResponseFormat(
      RatioDescriptionListSchema,
      "RatioDescriptionListSchema",
    ),
  });
  const out = completion.choices[0].message.parsed;
  if (out === null) {
    return [];
  }
  return out.ratios;
}

export async function analyzeRatio(
  ingredients: ParsedIngredient[],
  ratio: { name: string; description: string },
) {
  const ingredientsList = ingredients
    .map(
      (ingredient, idx) => `Ingredient ${idx + 1}: ${ingredient.originalText}`,
    )
    .join("\n");

  const formattedRatio = `## ${ratio.name}\n${ratio.description}\n`;

  const devMessage = [
    "Given the following ratio and list of ingredients, identify which ingredients make up the numerator and which are part of the denominator. ",
    "Return the indexes of the ingredients in the numerator and denominator as arrays.",
    "Use 1-based indexing. The first ingredient is index 1.",
    "If there are no ingredients for a ratio, return an empty array.",
  ].join("\n");

  const userMessage = `# Recipe\n${ingredientsList}\n\n# Ratio\n${formattedRatio}`;

  const completion = await openai.beta.chat.completions.parse({
    model,
    messages: [
      {
        role: "developer",
        content: devMessage,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    response_format: zodResponseFormat(
      z.object({
        numeratorIngredientNumbers: z.array(z.number()),
        denominatorIngredientNumbers: z.array(z.number()),
      }),
      "RatioAnalysisSchema",
    ),
  });
  const out = completion.choices[0].message.parsed;
  if (out === null) {
    return;
  }

  // console.log("Ratio Analysis", { devMessage, userMessage, out });

  const numeratorIngredients = out.numeratorIngredientNumbers
    .map((idx) => {
      const zeroBasedIdx = idx - 1;
      if (zeroBasedIdx < 0 || zeroBasedIdx >= ingredients.length) {
        console.log("Index out of range", { zeroBasedIdx, ingredients });
        return null;
      }
      return ingredients[zeroBasedIdx];
    })
    .filter(Boolean) as ParsedIngredient[];
  const denominatorIngredients = out.denominatorIngredientNumbers
    .map((idx) => {
      const zeroBasedIdx = idx - 1;
      if (zeroBasedIdx < 0 || zeroBasedIdx >= ingredients.length) {
        console.log("Index out of range", { zeroBasedIdx, ingredients });
        return null;
      }
      return ingredients[zeroBasedIdx];
    })
    .filter(Boolean) as ParsedIngredient[];

  let ratioValue: number | null = null;
  if (numeratorIngredients.length && denominatorIngredients.length) {
    const numerator = numeratorIngredients.reduce((acc, ingredient) => {
      return acc + (ingredient.inGrams || 0);
    }, 0);
    const denominator = denominatorIngredients.reduce((acc, ingredient) => {
      return acc + (ingredient.inGrams || 0);
    }, 0);

    ratioValue = numerator / denominator;
  }

  return {
    ratioValue,
    numeratorIngredients,
    denominatorIngredients,
  };
}
