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
import { toSchema, EMPTY_SCHEMA } from './schema_utils';

export const MARKET_DATA_TOOLS = [
  {
    name: 'market_data_snapshot',
    description: 'Get a point-in-time snapshot of market data for one contract: bid/ask/last/volume/OHLC etc. Resolves when data arrives or times out.',
    inputSchema: toSchema(MarketDataSnapshotInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataSnapshotInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataSnapshot(input.contract, input.fields, input.regulatorySnapshot));
    },
  },
  {
    name: 'market_data_bulk_snapshot',
    description: 'Get snapshots for multiple contracts simultaneously. Uses frozen snapshot (type 3). Returns array of results.',
    inputSchema: toSchema(MarketDataBulkSnapshotInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataBulkSnapshotInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataBulkSnapshot(input.contracts, input.fields));
    },
  },
  {
    name: 'historical_data',
    description: 'Get OHLCV historical bars. Supports durations like "1 D", "1 W", "1 M", "1 Y". Bar sizes: "1 min", "5 mins", "1 hour", "1 day", etc.',
    inputSchema: toSchema(HistoricalDataInput),
    handler: async (args: Record<string, unknown>) => {
      const input = HistoricalDataInput.parse(args);
      return withEnvelope(async () => marketDataService.historicalData(input.contract, input.endDateTime, input.durationStr, input.barSizeSetting, input.whatToShow, input.useRTH, input.formatDate));
    },
  },
  {
    name: 'historical_ticks',
    description: 'Get individual tick data (time & sales). Returns up to 1000 ticks for a given time range.',
    inputSchema: toSchema(HistoricalTicksInput),
    handler: async (args: Record<string, unknown>) => {
      const input = HistoricalTicksInput.parse(args);
      return withEnvelope(async () => marketDataService.historicalTicks(input.contract, input.startDateTime, input.endDateTime, input.numberOfTicks, input.whatToShow, input.useRTH));
    },
  },
  {
    name: 'fundamental_data',
    description: 'Get fundamental data for a stock: financial summary, ratios, earnings, etc.',
    inputSchema: toSchema(FundamentalDataInput),
    handler: async (args: Record<string, unknown>) => {
      const input = FundamentalDataInput.parse(args);
      return withEnvelope(async () => marketDataService.fundamentalData(input.contract, input.reportType));
    },
  },
  {
    name: 'market_depth_snapshot',
    description: 'Get an order book snapshot (Level 2 data). Returns the current market depth rows.',
    inputSchema: toSchema(MarketDepthSnapshotInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDepthSnapshotInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDepthSnapshot(input.contract, input.numRows));
    },
  },
  // --- Streaming tools ---
  {
    name: 'market_data_stream_subscribe',
    description: 'Subscribe to a live streaming market data feed (ticks) for a contract. Events are delivered via MCP resources.',
    inputSchema: toSchema(MarketDataSubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataSubscribe(input.contract, input.fields));
    },
  },
  {
    name: 'market_data_stream_unsubscribe',
    description: 'Unsubscribe from a market data stream by subscription_id.',
    inputSchema: toSchema(MarketDataUnsubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDataUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'tick_by_tick_stream_subscribe',
    description: 'Subscribe to tick-by-tick data (Last, AllLast, BidAsk, MidPoint) for highest resolution.',
    inputSchema: toSchema(TicksSubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = TicksSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.ticksSubscribe(input.contract, input.tickType));
    },
  },
  {
    name: 'tick_by_tick_stream_unsubscribe',
    description: 'Unsubscribe from tick-by-tick data stream.',
    inputSchema: toSchema(MarketDataUnsubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.ticksUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'market_depth_stream_subscribe',
    description: 'Subscribe to streaming market depth (Level 2) updates.',
    inputSchema: toSchema(MarketDepthSubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDepthSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDepthSubscribe(input.contract, input.numRows));
    },
  },
  {
    name: 'market_depth_stream_unsubscribe',
    description: 'Unsubscribe from market depth stream.',
    inputSchema: toSchema(MarketDataUnsubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.marketDepthUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'realtime_bars_stream_subscribe',
    description: 'Subscribe to 5-second realtime bars.',
    inputSchema: toSchema(RealtimeBarsSubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = RealtimeBarsSubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.realtimeBarsSubscribe(input.contract, input.barSize, input.whatToShow, input.useRTH));
    },
  },
  {
    name: 'realtime_bars_stream_unsubscribe',
    description: 'Unsubscribe from realtime bars stream.',
    inputSchema: toSchema(MarketDataUnsubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = MarketDataUnsubscribeInput.parse(args);
      return withEnvelope(async () => marketDataService.realtimeBarsUnsubscribe(input.subscription_id));
    },
  },
  {
    name: 'list_market_data_subscriptions',
    description: 'List all active market data streaming subscriptions.',
    inputSchema: EMPTY_SCHEMA,
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => marketDataService.listMarketDataSubscriptions());
    },
  },
];
