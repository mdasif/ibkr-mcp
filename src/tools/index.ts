/**
 * Tool registry — aggregates all tool definitions and provides a unified
 * lookup/dispatch for the MCP server.
 */
import { CONTRACT_TOOLS } from './contract_tools';
import { MARKET_DATA_TOOLS } from './market_data_tools';
import { ORDER_TOOLS } from './order_tools';
import { ACCOUNT_TOOLS } from './account_tools';
import { RISK_TOOLS } from './risk_tools';
import { NEWS_TOOLS } from './news_tools';
import { SCANNER_TOOLS } from './scanner_tools';
import { ADMIN_TOOLS } from './admin_tools';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<any>;
}

/** All registered tools. */
export const ALL_TOOLS: ToolDefinition[] = [
  ...CONTRACT_TOOLS,
  ...MARKET_DATA_TOOLS,
  ...ORDER_TOOLS,
  ...ACCOUNT_TOOLS,
  ...RISK_TOOLS,
  ...NEWS_TOOLS,
  ...SCANNER_TOOLS,
  ...ADMIN_TOOLS,
] as ToolDefinition[];

/** Map for O(1) lookup by name. */
const toolMap = new Map<string, ToolDefinition>();
for (const tool of ALL_TOOLS) {
  if (toolMap.has(tool.name)) {
    throw new Error(`Duplicate tool name: ${tool.name}`);
  }
  toolMap.set(tool.name, tool);
}

/** Lookup a tool by name. */
export function getTool(name: string): ToolDefinition | undefined {
  return toolMap.get(name);
}

/** Get tool definitions formatted for MCP tools/list response. */
export function getToolListings() {
  return ALL_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}
