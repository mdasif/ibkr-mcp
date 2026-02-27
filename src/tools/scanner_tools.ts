/**
 * Scanner tools — MCP tool registration for market scanner operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as scannerService from '../services/scanner_service';
import {
  ScannerRunInput, ScannerCancelInput, ScannerRunPresetInput,
} from '../schemas/scanner_schemas';

export const SCANNER_TOOLS = [
  {
    name: 'scanner_parameters',
    description: 'Get available scanner parameters: scan types, instruments, location codes, filter types. Returns XML — parse for valid values.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => scannerService.scannerParameters());
    },
  },
  {
    name: 'scanner_run',
    description: 'Run a market scanner with custom parameters. Returns matching instruments.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        scanCode: { type: 'string', description: 'Scan type code (e.g., TOP_PERC_GAIN, HOT_BY_VOLUME)' },
        instrument: { type: 'string', description: 'Instrument type (e.g., STK, FUT, OPT)' },
        locationCode: { type: 'string', description: 'Market location (e.g., STK.US, STK.US.MAJOR)' },
        numberOfRows: { type: 'number', description: 'Max rows to return (default: 25)' },
        abovePrice: { type: 'number', description: 'Minimum price filter' },
        belowPrice: { type: 'number', description: 'Maximum price filter' },
        aboveVolume: { type: 'number', description: 'Minimum volume filter' },
        marketCapAbove: { type: 'number', description: 'Minimum market cap' },
        marketCapBelow: { type: 'number', description: 'Maximum market cap' },
        averageOptionVolumeAbove: { type: 'number', description: 'Min avg option volume' },
        scannerSettingPairs: { type: 'string', description: 'Additional scanner setting pairs' },
      },
      required: ['scanCode', 'instrument', 'locationCode'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ScannerRunInput.parse(args);
      const { instrument, locationCode, scanCode, numberOfRows, ...filters } = input;
      return withEnvelope(async () => scannerService.scannerRun(instrument, locationCode, scanCode, numberOfRows, filters));
    },
  },
  {
    name: 'scanner_cancel',
    description: 'Cancel a running scanner subscription by reqId.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        reqId: { type: 'number', description: 'Scanner request ID to cancel' },
      },
      required: ['reqId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ScannerCancelInput.parse(args);
      return withEnvelope(async () => scannerService.scannerCancel(input.scannerSubscriptionId));
    },
  },
  {
    name: 'scanner_presets_list',
    description: 'List all available scanner presets with their configurations.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => scannerService.scannerPresetsList());
    },
  },
  {
    name: 'scanner_run_preset',
    description: 'Run a pre-configured scanner preset by name: top_gainers, top_losers, most_active, high_iv, unusual_volume, breakout_candidates, gap_up, gap_down.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        presetName: {
          type: 'string',
          description: 'Preset name',
          enum: ['top_gainers', 'top_losers', 'most_active', 'high_iv', 'unusual_volume', 'breakout_candidates', 'gap_up', 'gap_down'],
        },
        numberOfRows: { type: 'number', description: 'Override max rows (default varies by preset)' },
      },
      required: ['presetName'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ScannerRunPresetInput.parse(args);
      return withEnvelope(async () => scannerService.scannerRunPreset(input.preset, input.numberOfRows));
    },
  },
];
