/**
 * Scanner schemas.
 */
import { z } from 'zod';

export const ScannerParametersInput = z.object({});

export const ScannerRunInput = z.object({
  instrument: z.string().default('STK').describe('Instrument type'),
  locationCode: z.string().default('STK.US.MAJOR').describe('Location code'),
  scanCode: z.string().describe('Scan code (e.g. TOP_PERC_GAIN)'),
  numberOfRows: z.number().default(25).describe('Number of results'),
  abovePrice: z.number().optional(),
  belowPrice: z.number().optional(),
  aboveVolume: z.number().optional(),
  averageVolumeAbove: z.number().optional(),
  marketCapAbove: z.number().optional(),
  marketCapBelow: z.number().optional(),
});

export const ScannerCancelInput = z.object({
  scannerSubscriptionId: z.number().describe('Scanner subscription ID to cancel'),
});

export const ScannerPresetsListInput = z.object({});

export const ScannerRunPresetInput = z.object({
  preset: z.enum([
    'top_gainers', 'top_losers', 'most_active', 'high_iv',
    'unusual_volume', 'breakout_candidates', 'gap_up', 'gap_down',
  ]).describe('Preset scanner name'),
  numberOfRows: z.number().default(25),
});

// Built-in scanner preset definitions
export const SCANNER_PRESETS: Record<string, { instrument: string; locationCode: string; scanCode: string; description: string }> = {
  top_gainers: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'TOP_PERC_GAIN', description: 'Top percentage gainers in US major exchanges' },
  top_losers: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'TOP_PERC_LOSE', description: 'Top percentage losers in US major exchanges' },
  most_active: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'MOST_ACTIVE', description: 'Most active by volume in US major exchanges' },
  high_iv: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'HIGH_OPT_IMP_VOLAT', description: 'Stocks with highest options implied volatility' },
  unusual_volume: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'HOT_BY_VOLUME', description: 'Unusual volume activity' },
  breakout_candidates: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'HIGH_VS_52W_HL', description: 'Stocks near 52-week highs' },
  gap_up: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'TOP_OPEN_PERC_GAIN', description: 'Stocks gapping up at open' },
  gap_down: { instrument: 'STK', locationCode: 'STK.US.MAJOR', scanCode: 'TOP_OPEN_PERC_LOSE', description: 'Stocks gapping down at open' },
};
