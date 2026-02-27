/**
 * Scanner service — run scans, presets, parameters.
 */
import { EventName, type ScannerSubscription, type Instrument, type LocationCode, type ScanCode } from '@stoqey/ib';
import { getConnection } from '../connection/ib_connection';
import { AppError } from '../middleware/error_mapping';
import { SCANNER_PRESETS } from '../schemas/scanner_schemas';

export async function scannerParameters(): Promise<string> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new AppError('TIMEOUT', 'Scanner parameters request timed out'));
    }, 15000);

    const onParams = (xml: string) => {
      cleanup();
      resolve(xml);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.scannerParameters, onParams);
    };

    conn.api.on(EventName.scannerParameters, onParams);
    conn.api.reqScannerParameters();
  }));
}

export async function scannerRun(
  instrument: string,
  locationCode: string,
  scanCode: string,
  numberOfRows = 25,
  filters: Record<string, unknown> = {},
): Promise<Record<string, unknown>[]> {
  const conn = getConnection();
  conn.ensureConnected();

  return conn.enqueue(() => new Promise<Record<string, unknown>[]>((resolve, _reject) => {
    const reqId = conn.nextReqId();
    const results: Record<string, unknown>[] = [];

    const timeout = setTimeout(() => {
      cleanup();
      try { conn.api.cancelScannerSubscription(reqId); } catch { /* noop */ }
      resolve(results);
    }, 30000);

    const subscription: ScannerSubscription = {
      instrument: instrument as Instrument,
      locationCode: locationCode as LocationCode,
      scanCode: scanCode as unknown as ScanCode,
      numberOfRows,
      abovePrice: filters['abovePrice'] as number | undefined,
      belowPrice: filters['belowPrice'] as number | undefined,
      aboveVolume: filters['aboveVolume'] as number | undefined,
      averageOptionVolumeAbove: filters['averageVolumeAbove'] as number | undefined,
      marketCapAbove: filters['marketCapAbove'] as number | undefined,
      marketCapBelow: filters['marketCapBelow'] as number | undefined,
    };

    const onData = (rId: number, rank: number, contractDetails: unknown, distance: string, benchmark: string, projection: string, legsStr: string) => {
      if (rId !== reqId) return;
      const cd = contractDetails as Record<string, unknown>;
      results.push({
        rank,
        contract: cd['contract'] ?? cd,
        distance,
        benchmark,
        projection,
        legsStr,
      });
    };

    const onEnd = (rId: number) => {
      if (rId !== reqId) return;
      cleanup();
      try { conn.api.cancelScannerSubscription(reqId); } catch { /* noop */ }
      resolve(results);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      conn.api.off(EventName.scannerData, onData);
      conn.api.off(EventName.scannerDataEnd, onEnd);
    };

    conn.api.on(EventName.scannerData, onData as any);
    conn.api.on(EventName.scannerDataEnd, onEnd as any);
    conn.api.reqScannerSubscription(reqId, subscription, [], []);
  }));
}

export async function scannerCancel(scannerSubscriptionId: number): Promise<{ cancelled: boolean }> {
  const conn = getConnection();
  conn.ensureConnected();
  try {
    conn.api.cancelScannerSubscription(scannerSubscriptionId);
    return { cancelled: true };
  } catch {
    return { cancelled: false };
  }
}

export function scannerPresetsList(): Record<string, unknown>[] {
  return Object.entries(SCANNER_PRESETS).map(([name, preset]) => ({
    name,
    ...preset,
  }));
}

export async function scannerRunPreset(preset: string, numberOfRows = 25): Promise<Record<string, unknown>[]> {
  const config = SCANNER_PRESETS[preset];
  if (!config) {
    throw new AppError('VALIDATION_ERROR', `Unknown scanner preset: ${preset}`, {
      available: Object.keys(SCANNER_PRESETS),
    });
  }
  return scannerRun(config.instrument, config.locationCode, config.scanCode, numberOfRows);
}
