/**
 * structured-parser.ts — AI Structured Output Parser (织梦机 v2 / W03)
 *
 * Single layer through which all AI structured outputs pass.
 * Validates JSON against schema, auto-repairs missing fields with defaults,
 * strips illegal fields, and falls back to plain text when schema recovery
 * is impossible.
 *
 * NEVER throws for recoverable issues — always returns status-tagged output.
 *
 * [v2.1.1-AI] Added convenience parsers for ChapterPacket, WritingContract, TianDiRen.
 */

import type { ParseInput, ParseOutput, ParserStatus } from '../../contracts/ai-parser.contract';
import {
  CHAPTER_PACKET_SCHEMA,
  WRITING_CONTRACT_SCHEMA,
  TIAN_DI_REN_SCHEMA,
} from '../../contracts/ai-parser.contract';

/**
 * ParseResult extends ParseOutput with a status field for discrimination.
 */
export interface ParseResult extends ParseOutput {
  status: ParserStatus;
}

/**
 * Extract the default value for a schema property based on its type.
 */
function getDefaultForType(fieldDef: Record<string, unknown>): unknown {
  if (fieldDef.default !== undefined) return fieldDef.default;

  const type = fieldDef.type as string | undefined;
  switch (type) {
    case 'string':  return '';
    case 'number':  return 0;
    case 'integer': return 0;
    case 'boolean': return false;
    case 'array':   return [];
    case 'object':  return {};
    default:        return null;
  }
}

/**
 * Parse and validate structured AI output against a JSON schema.
 *
 * @param input - ParseInput with rawContent, schema (JSON string), and strict flag
 * @returns ParseResult with status-tagged data, errors, and repair logs
 */
export function parseStructuredOutput(input: ParseInput): ParseResult {
  const { rawContent, schema: schemaString, strict } = input;

  // --- Phase 1: Parse the schema ---
  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(schemaString) as Record<string, unknown>;
  } catch {
    // Schema itself is invalid JSON → catastrophic failure
    return {
      status: 'failed',
      data: {},
      validationErrors: ['Schema is not valid JSON'],
      repairLog: [],
      fallbackText: rawContent,
    };
  }

  // Validate that schema has a properties object
  const schemaProperties = (schema.properties as Record<string, unknown>) ?? {};
  if (typeof schemaProperties !== 'object' || schemaProperties === null) {
    return {
      status: 'failed',
      data: {},
      validationErrors: ['Schema properties is not an object'],
      repairLog: [],
      fallbackText: rawContent,
    };
  }

  // --- Phase 2: Parse the raw content ---
  let parsed: Record<string, unknown>;
  try {
    const parsedRaw = JSON.parse(rawContent);
    if (typeof parsedRaw !== 'object' || parsedRaw === null || Array.isArray(parsedRaw)) {
      return {
        status: 'fallback',
        data: {},
        validationErrors: ['Raw content is not a JSON object'],
        repairLog: [],
        fallbackText: rawContent,
      };
    }
    parsed = parsedRaw as Record<string, unknown>;
  } catch {
    // Malformed JSON → fallback
    return {
      status: 'fallback',
      data: {},
      validationErrors: ['Raw content is not valid JSON'],
      repairLog: [],
      fallbackText: rawContent,
    };
  }

  // --- Phase 3: Validate and repair ---
  const requiredFields = (schema.required as string[]) ?? [];
  const validationErrors: string[] = [];
  const repairLog: string[] = [];
  const result: Record<string, unknown> = {};
  let needsRepair = false;

  // Process each field defined in the schema
  for (const [key, fieldDef] of Object.entries(schemaProperties)) {
    const def = fieldDef as Record<string, unknown>;
    const value = parsed[key];
    const isRequired = requiredFields.includes(key);

    if (value === undefined) {
      if (isRequired) {
        // Required field missing — in strict mode this is a fallback
        if (strict) {
          return {
            status: 'fallback',
            data: {},
            validationErrors: [`Missing required field '${key}'`],
            repairLog: [],
            fallbackText: rawContent,
          };
        }
        // Fill with default
        result[key] = getDefaultForType(def);
        repairLog.push(`Missing required field '${key}' filled with default`);
        needsRepair = true;
      } else if (def.default !== undefined) {
        // Optional field with explicit default
        result[key] = def.default;
        repairLog.push(`Missing optional field '${key}' filled with default`);
        needsRepair = true;
      }
      // Optional field without default: leave it out of result
    } else {
      result[key] = value;
    }
  }

  // Strip illegal fields (extra fields not in schema)
  for (const key of Object.keys(parsed)) {
    if (!(key in schemaProperties)) {
      validationErrors.push(`Illegal field '${key}' stripped`);
      needsRepair = true;
    }
  }

  // Check for strict mode with validation errors
  if (strict && validationErrors.length > 0) {
    return {
      status: 'fallback',
      data: {},
      validationErrors,
      repairLog: [],
      fallbackText: rawContent,
    };
  }

  // --- Phase 4: Determine final status ---
  let status: ParserStatus;
  if (needsRepair) {
    // validationErrors present means extra fields were stripped or other issues;
    // repairLog means missing fields were filled.
    // Either way the output was altered from raw input.
    status = 'repaired';
  } else {
    status = 'valid';
  }

  return {
    status,
    data: result,
    validationErrors,
    repairLog,
  };
}

// ===== v2.1.1-AI: Convenience Parsers =====

/**
 * Parse AI output as a ChapterPacket.
 * Validates against the ChapterPacket JSON schema.
 */
export function parseChapterPacket(
  rawContent: string,
  strict: boolean = false,
): ParseResult {
  return parseStructuredOutput({
    rawContent,
    schema: CHAPTER_PACKET_SCHEMA,
    strict,
  });
}

/**
 * Parse AI output as a WritingContract.
 * Validates against the WritingContract JSON schema.
 */
export function parseWritingContract(
  rawContent: string,
  strict: boolean = false,
): ParseResult {
  return parseStructuredOutput({
    rawContent,
    schema: WRITING_CONTRACT_SCHEMA,
    strict,
  });
}

/**
 * Parse AI output as TianDiRen (Heaven/Earth/Human) layers.
 * Validates against the TianDiRen JSON schema.
 */
export function parseTianDiRen(
  rawContent: string,
  strict: boolean = false,
): ParseResult {
  return parseStructuredOutput({
    rawContent,
    schema: TIAN_DI_REN_SCHEMA,
    strict,
  });
}

/**
 * Get a human-readable error message for a ParseResult.
 * Returns Chinese error messages for user-facing display.
 */
export function getParseErrorMessage(result: ParseResult): string {
  switch (result.status) {
    case 'valid':
      return '';
    case 'repaired':
      return `AI 返回的 JSON 已自动修复：${result.repairLog.join('；')}`;
    case 'fallback':
      return 'AI 返回的 JSON 无法解析，已使用原文模式展示。';
    case 'failed':
      return `AI 返回的 JSON 解析失败：${result.validationErrors.join('；')}`;
    default:
      return '未知解析状态。';
  }
}

/**
 * Check if a ParseResult represents parseable data (valid or repaired).
 */
export function isParseable(result: ParseResult): boolean {
  return result.status === 'valid' || result.status === 'repaired';
}
