/**
 * Shared helper for generating MCP `inputSchema` JSON Schema objects
 * directly from the Zod validators actually used by each tool's handler.
 *
 * Historically, tool files hand-wrote `inputSchema` as a separate object
 * next to the Zod schema used for runtime parsing. The two drifted apart
 * over time (fields renamed, nested shapes changed, requirements added)
 * because nothing forced them to stay in sync — resulting in advertised
 * schemas that didn't match what the handler actually accepted, so any
 * MCP client following the documented schema would fail validation.
 *
 * Generating inputSchema from the same Zod object used to `.parse()` the
 * arguments makes drift structurally impossible: there is only one
 * source of truth per tool.
 */
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodTypeAny } from 'zod';

export const toSchema = (zodSchema: ZodTypeAny): Record<string, unknown> =>
  zodToJsonSchema(zodSchema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>;

/** Shared empty-object schema for zero-argument tools (health checks, list calls, etc). */
export const EMPTY_SCHEMA: Record<string, unknown> = { type: 'object', properties: {} };
