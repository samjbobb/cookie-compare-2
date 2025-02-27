import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { evaluate } from "mathjs";
import util from "util";
util.inspect.defaultOptions.depth = null;

export const openai = new OpenAI();
const model = "gpt-4o-mini-2024-07-18";

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

export async function parseIngredient(ingredient: string) {
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
    return { error: "Failed to parse" };
  } else if (out.error) {
    return { error: out.error };
  } else if (!out.data) {
    return { error: "Failed to parse" };
  }
  return {
    ...out.data,
    originalText: ingredient,
    inGrams: evaluateExpressionToGrams(
      out.data.expressionConvertingToMassInGrams,
    ),
  };
}

function evaluateExpressionToGrams(expression?: string) {
  if (!expression) return;
  try {
    return evaluate(expression).toNumber("g");
  } catch (e) {
    console.error("Failed to evaluate expression", expression, e);
    return;
  }
}
