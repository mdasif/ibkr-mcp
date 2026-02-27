/**
 * Market data tools — MCP tool registration for market data operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as marketDataService from '../services/market_data_service';
import {
  MarketDataSnapshotInput, MarketDataBulkSnapshotInput,
  HistoricalDataInput, HistoricalTicksInput,
  FundamentalDataInput, MarketDepthSnapshotInput,
  MarketDataSubscribeInput, MarketDataUnsubscribeInput,
  TicksSubscribeInput,
  MarketDepthSubscribeInput,
  RealtimeBarsSubscribeInput,
} from '../schemas/market_data_schemas';

export const MARKET_DATA_TOOLS = [
  {
    name: 'market_data_snapshot',
    description: 'Get a point-in-time snapshot of market data for one contract: bid/ask/last/volume/OHLC etc. Resolves when data arrives or times out.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        genericTickList: { type: 'string', description: 'Comma-separated generic tick types (e.g., "100,101,106")' },
        fields: { type: 'array', items: { type: 'string' }, description: 'Specific fields to return' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataSnapshotInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataSnapshot(input.contract, input.fields, input.regulatorySnapshot));
    },
  },
  {
    name: 'market_data_bulk_snapshot',
    description: 'Get snapshots for multiple contracts simultaneously. Uses frozen snapshot (type 3). Returns array of results.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        contracts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              conId: { type: 'number' },
              symbol: { type: 'string' },
              secType: { type: 'string' },
              exchange: { type: 'string' },
              currency: { type: 'string' },
            },
          },
          description: 'Array of contract specifications (max 50)',
        },
        fields: { type: 'array', items: { type: 'string' } },
      },
      required: ['contracts'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataBulkSnapshotInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataBulkSnapshot(input.contracts, input.fields));
    },
  },
  {
    name: 'historical_data',
    description: 'Get OHLCV historical bars. Supports durations like "1 D", "1 W", "1 M", "1 Y". Bar sizes: "1 min", "5 mins", "1 hour", "1 day", etc.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        endDateTime: { type: 'string', description: 'End date/time (YYYYMMDD HH:mm:ss TZ or empty for now)' },
        durationStr: { type: 'string', description: 'Duration: "1 D", "5 D", "1 W", "1 M", "3 M", "1 Y"' },
        barSizeSetting: { type: 'string', description: 'Bar size: "1 min", "5 mins", "15 mins", "1 hour", "1 day"' },
        whatToShow: { type: 'string', description: 'Data type: TRADES, MIDPOINT, BID, ASK, etc.' },
        useRTH: { type: 'boolean', description: 'Regular trading hours only (default: true)' },
      },
      required: ['durationStr', 'barSizeSetting'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = HistoricalDataInput.parse(args);
      return withEnvelope(async () => marketDataService.historicalData(input.contract, input.endDateTime, input.durationStr, input.barSizeSetting, input.whatToShow, input.useRTH, input.formatDate));
    },
  },
  {
    name: 'historical_ticks',
    description: 'Get individual tick data (time & sales). Returns up to 1000 ticks for a given time range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        startDateTime: { type: 'string', description: 'Start date/time (YYYYMMDD HH:mm:ss)' },
        endDateTime: { type: 'string', description: 'End date/time (YYYYMMDD HH:mm:ss)' },
        numberOfTicks: { type: 'number', description: 'Number of ticks to return (max 1000)' },
        whatToShow: { type: 'string', description: 'TRADES, BID_ASK, or MIDPOINT' },
        useRTH: { type: 'boolean' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = HistoricalTicksInput.parse(args);
      return withEnvelope(async () => marketDataService.historicalTicks(input.contract, input.startDateTime, input.endDateTime, input.numberOfTicks, input.whatToShow, input.useRTH));
    },
  },
  {
    name: 'fundamental_data',
    description: 'Get fundamental data for a stock: financial summary, ratios, earnings, etc.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        reportType: { type: 'string', description: 'Report type: ReportSnapshot, ReportsFinSummary, ReportRatios, ReportsFinStatements, RESC' },
      },
      required: ['reportType'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = FundamentalDataInput.parse(args);
      return withEnvelope(async () => marketDataService.fundamentalData(input.contract, input.reportType));
    },
  },
  {
    name: 'market_depth_snapshot',
    description: 'Get an order book snapshot (Level 2 data). Returns the current market depth rows.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        numRows: { type: 'number', description: 'Number of depth rows (default: 5)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDepthSnapshotInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDepthSnapshot(input.contract, input.numRows));
    },
  },
  // --- Streaming tools ---
  {
    name: 'market_data_stream_subscribe',
    description: 'Subscribe to a live streaming market data feed (ticks) for a contract. Events are delivered via MCP resources.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        genericTickList: { type: 'string' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataSubscribe(input.contract, input.fields));
    },
  },
  {
    name: 'market_data_stream_unsubscribe',
    description: 'Unsubscribe from a market data stream by subscription_id.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subscription_id: { type: 'string', description: 'Subscription ID returned from subscribe call' },
      },
      required: ['subscription_id'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'tick_by_tick_stream_subscribe',
    description: 'Subscribe to tick-by-tick data (Last, AllLast, BidAsk, MidPoint) for highest resolution.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        tickType: { type: 'string', description: 'Tick type: Last, AllLast, BidAsk, MidPoint' },
        numberOfTicks: { type: 'number', description: 'Number of ticks to return (0 for unlimited)' },
        ignoreSize: { type: 'boolean' },
      },
      required: ['tickType'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = TicksSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.ticksSubscribe(input.contract, input.tickType));
    },
  },
  {
    name: 'tick_by_tick_stream_unsubscribe',
    description: 'Unsubscribe from tick-by-tick data stream.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subscription_id: { type: 'string', description: 'Subscription ID from subscribe call' },
      },
      required: ['subscription_id'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.ticksUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'market_depth_stream_subscribe',
    description: 'Subscribe to streaming market depth (Level 2) updates.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        numRows: { type: 'number' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDepthSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDepthSubscribe(input.contract, input.numRows));
    },
  },
  {
    name: 'market_depth_stream_unsubscribe',
    description: 'Unsubscribe from market depth stream.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subscription_id: { type: 'string', description: 'Subscription ID from subscribe call' },
      },
      required: ['subscription_id'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDepthUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'realtime_bars_stream_subscribe',
    description: 'Subscribe to 5-second realtime bars.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        whatToShow: { type: 'string', description: 'TRADES, MIDPOINT, BID, ASK' },
        useRTH: { type: 'boolean' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = RealtimeBarsSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.realtimeBarsSubscribe(input.contract, input.barSize, input.whatToShow, input.useRTH));
    },
  },
  {
    name: 'realtime_bars_stream_unsubscribe',
    description: 'Unsubscribe from realtime bars stream.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subscription_id: { type: 'string', description: 'Subscription ID from subscribe call' },
      },
      required: ['subscription_id'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.realtimeBarsUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'list_market_data_subscriptions',
    description: 'List all active market data streaming subscriptions.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => marketDataService.listMarketDataSubscriptions());
    },
  },
];
