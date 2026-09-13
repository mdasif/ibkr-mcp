/**
 * Scanner tools — MCP tool registration for market scanner operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as scannerService from '../services/scanner_service';
import {
  ScannerParametersInput, ScannerRunInput, ScannerCancelInput,
  ScannerPresetsListInput, ScannerRunPresetInput,
} from '../schemas/scanner_schemas';
import { toSchema } from './schema_utils';

export const SCANNER_TOOLS = [
  {
    name: 'scanner_parameters',
    description: 'Get available scanner parameters: scan types, instruments, location codes, filter types. Returns XML — parse for valid values.',
    inputSchema: toSchema(ScannerParametersInput),
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => scannerService.scannerParameters());
    },
  },
  {
    name: 'scanner_run',
    description: 'Run a market scanner with custom parameters. Returns matching instruments.',
    inputSchema: toSchema(ScannerRunInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ScannerRunInput.parse(args);
      const { instrument, locationCode, scanCode, numberOfRows, ...filters } = input;
      return withEnvelope(async () => scannerService.scannerRun(instrument, locationCode, scanCode, numberOfRows, filters));
    },
  },
  {
    name: 'scanner_cancel',
    description: 'Cancel a running scanner subscription by reqId.',
    inputSchema: toSchema(ScannerCancelInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ScannerCancelInput.parse(args);
      return withEnvelope(async () => scannerService.scannerCancel(input.scannerSubscriptionId));
    },
  },
  {
    name: 'scanner_presets_list',
    description: 'List all available scanner presets with their configurations.',
    inputSchema: toSchema(ScannerPresetsListInput),
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => scannerService.scannerPresetsList());
    },
  },
  {
    name: 'scanner_run_preset',
    description: 'Run a pre-configured scanner preset by name: top_gainers, top_losers, most_active, high_iv, unusual_volume, breakout_candidates, gap_up, gap_down.',
    inputSchema: toSchema(ScannerRunPresetInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ScannerRunPresetInput.parse(args);
      return withEnvelope(async () => scannerService.scannerRunPreset(input.preset, input.numberOfRows));
    },
  },
];
