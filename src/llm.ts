import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export const openai = new OpenAI();
const model = "gpt-4o-2024-08-06";

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
  quantity: z.number(),
  unit: z.string(),
  product: z.string(),
  preparation: z.string().optional(),
  notes: z.string().optional(),
});

export async function parseIngredient(ingredient: string) {
  const completion = await openai.beta.chat.completions.parse({
    model,
    messages: [
      {
        role: "developer",
        content:
          "Parse the following ingredient into the requested schema. Do not add any additional information. Convert fractions to a decimal 'quantity'. If there are alternate measurements, return only the main measurement for quantity and unit. If the ingredient is not valid, return an error object.",
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
  return { ...out.data, originalText: ingredient };
}
