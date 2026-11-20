/**
 * Utility functions for schema validation, response cleaning, and JSON extraction.
 */

import { z, ZodSchema } from 'zod';
import { AISchemaValidationError } from '../errors/ai-errors.js';

/**
 * Strips code fences, markdown tags, and leading/trailing whitespace from AI text output.
 */
export function cleanJsonResponseText(rawText: string): string {
  let cleaned = rawText.trim();

  // Strip ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    const lines = cleaned.split('\n');
    // Remove opening fence
    if (lines[0].startsWith('```')) {
      lines.shift();
    }
    // Remove closing fence
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith('```')) {
      lines.pop();
    }
    cleaned = lines.join('\n').trim();
  }

  return cleaned;
}

/**
 * Parses and validates raw model text output against a Zod schema.
 * Throws AISchemaValidationError if parsing or validation fails.
 */
export function validateStructuredOutput<T>(rawText: string, schema: ZodSchema<T>): T {
  const cleaned = cleanJsonResponseText(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (jsonErr: any) {
    throw new AISchemaValidationError(
      `Failed to parse model output as valid JSON: ${jsonErr.message}`,
      [{ message: jsonErr.message, rawTextSnippet: cleaned.slice(0, 200) }],
      rawText
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AISchemaValidationError(
      `Model output failed schema validation: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      result.error.issues,
      parsed
    );
  }

  return result.data;
}

/**
 * Converts a standard Zod Object Schema into an OpenAPI/Gemini-compatible JSON Schema.
 * Used for strict responseSchema enforcement in Gemini generateContent config.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Simple, robust mapper for common Zod types into Gemini responseSchema format
  if (schema instanceof z.ZodString) {
    return { type: 'STRING', description: schema.description };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'NUMBER', description: schema.description };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'BOOLEAN', description: schema.description };
  }
  if (schema instanceof z.ZodEnum) {
    return {
      type: 'STRING',
      enum: schema._def.values,
      description: schema.description,
    };
  }
  if (schema instanceof z.ZodArray) {
    return {
      type: 'ARRAY',
      items: zodToJsonSchema(schema.element),
      description: schema.description,
    };
  }
  if (schema instanceof z.ZodOptional) {
    return zodToJsonSchema(schema.unwrap());
  }
  if (schema instanceof z.ZodRecord) {
    return {
      type: 'OBJECT',
      description: schema.description,
    };
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    return {
      type: 'OBJECT',
      properties,
      required: required.length > 0 ? required : undefined,
      description: schema.description,
    };
  }

  return { type: 'STRING', description: schema.description };
}
