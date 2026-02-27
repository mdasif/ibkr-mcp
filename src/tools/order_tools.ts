/**
 * Order tools — MCP tool registration for order management operations.
 */
import { withEnvelope } from '../middleware/error_mapping';
import * as ordersService from '../services/orders_service';
import {
  OrderPlaceInput, OrderModifyInput, OrderCancelInput,
  OrdersOpenListInput, ExecutionsListInput, OrderPreviewInput,
  ExerciseOptionsInput, BracketOrderInput, OCOOrderInput,
  OrderStatusStreamUnsubscribeInput,
} from '../schemas/order_schemas';

export const ORDER_TOOLS = [
  {
    name: 'order_place',
    description: 'Place a new order. Requires: side, quantity, order type, and a qualified contract. Enforces all guardrails (read-only check, max qty, max notional, allowed order types, symbol allowlist/denylist).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Contract ID (from contract_qualify)' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string', description: 'Exchange (default: SMART)' },
        currency: { type: 'string', description: 'Currency (default: USD)' },
        side: { type: 'string', description: 'BUY or SELL', enum: ['BUY', 'SELL'] },
        quantity: { type: 'number', description: 'Order quantity' },
        orderType: { type: 'string', description: 'LMT, MKT, STP, STP_LMT, MOC, LOC, MIT, TRAIL, etc.' },
        limitPrice: { type: 'number', description: 'Limit price (required for LMT, STP_LMT)' },
        auxPrice: { type: 'number', description: 'Aux/stop price (for STP, STP_LMT, TRAIL)' },
        tif: { type: 'string', description: 'Time in force: DAY, GTC, IOC, FOK, OPG, DTC' },
        outsideRth: { type: 'boolean', description: 'Allow outside regular trading hours' },
        account: { type: 'string', description: 'Account ID (for FA accounts)' },
        transmit: { type: 'boolean', description: 'Transmit immediately (default: true). Set false to create without sending.' },
        goodAfterTime: { type: 'string' },
        goodTillDate: { type: 'string' },
        ocaGroup: { type: 'string' },
        ocaType: { type: 'number' },
        parentId: { type: 'number' },
        trailingPercent: { type: 'number' },
        trailStopPrice: { type: 'number' },
        algoStrategy: { type: 'string' },
        algoParams: { type: 'object' },
      },
      required: ['side', 'quantity', 'orderType'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OrderPlaceInput.parse(args);
      return withEnvelope(async () => ordersService.orderPlace(input));
    },
  },
  {
    name: 'order_modify',
    description: 'Modify an existing open order. Requires the same fields as order_place plus the orderId to modify.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        orderId: { type: 'number', description: 'Order ID to modify' },
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        quantity: { type: 'number' },
        orderType: { type: 'string' },
        limitPrice: { type: 'number' },
        auxPrice: { type: 'number' },
        tif: { type: 'string' },
        outsideRth: { type: 'boolean' },
        transmit: { type: 'boolean' },
      },
      required: ['orderId', 'side', 'quantity', 'orderType'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OrderModifyInput.parse(args);
      return withEnvelope(async () => ordersService.orderModify(input));
    },
  },
  {
    name: 'order_cancel',
    description: 'Cancel an open order by orderId.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        orderId: { type: 'number', description: 'Order ID to cancel' },
        manualOrderCancelTime: { type: 'string', description: 'Optional manual cancel time' },
      },
      required: ['orderId'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OrderCancelInput.parse(args);
      return withEnvelope(async () => ordersService.orderCancel(input.orderId, input.manualCancelOrderTime));
    },
  },
  {
    name: 'orders_cancel_all',
    description: 'Cancel ALL open orders via global cancel. Use with extreme caution.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => ordersService.requestGlobalCancel());
    },
  },
  {
    name: 'orders_open_list',
    description: 'List all open/pending orders with their current status.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        account: { type: 'string', description: 'Filter by account ID' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OrdersOpenListInput.parse(args);
      return withEnvelope(async () => ordersService.ordersOpenList(input.account));
    },
  },
  {
    name: 'orders_completed_list',
    description: 'List completed (filled, cancelled) orders.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => ordersService.ordersCompletedList());
    },
  },
  {
    name: 'executions_list',
    description: 'List execution reports (fills) with optional filter by symbol, side, time, etc.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'number' },
        acctCode: { type: 'string', description: 'Account code filter' },
        time: { type: 'string', description: 'Filter by time (YYYYMMDD HH:mm:ss)' },
        symbol: { type: 'string', description: 'Filter by symbol' },
        secType: { type: 'string', description: 'Filter by security type' },
        exchange: { type: 'string', description: 'Filter by exchange' },
        side: { type: 'string', description: 'Filter by side (BUY/SELL)' },
      },
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ExecutionsListInput.parse(args);
      return withEnvelope(async () => ordersService.executionsList(input));
    },
  },
  {
    name: 'order_preview',
    description: 'Preview/what-if an order: see estimated commission, margin impact, equity with loan before actually sending.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        quantity: { type: 'number' },
        orderType: { type: 'string' },
        limitPrice: { type: 'number' },
        auxPrice: { type: 'number' },
        tif: { type: 'string' },
      },
      required: ['side', 'quantity', 'orderType'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OrderPreviewInput.parse(args);
      return withEnvelope(async () => ordersService.orderWhatIf(input));
    },
  },
  {
    name: 'exercise_options',
    description: 'Exercise or lapse an option contract.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number', description: 'Option contract ID' },
        exerciseAction: { type: 'number', description: '1 = exercise, 2 = lapse' },
        exerciseQuantity: { type: 'number', description: 'Number of contracts' },
        account: { type: 'string', description: 'Account ID' },
        override: { type: 'boolean', description: 'Override system precautions' },
      },
      required: ['conId', 'exerciseAction', 'exerciseQuantity', 'account'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = ExerciseOptionsInput.parse(args);
      return withEnvelope(async () => ordersService.exerciseOptions(input.contract, input.exerciseAction, input.exerciseQuantity, input.account, input.override));
    },
  },
  {
    name: 'bracket_order',
    description: 'Place a bracket order: parent + take-profit + stop-loss. All three orders are linked and submitted together.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        quantity: { type: 'number' },
        entryOrderType: { type: 'string', description: 'Entry order type (LMT, MKT)' },
        entryLimitPrice: { type: 'number', description: 'Entry limit price' },
        takeProfitPrice: { type: 'number', description: 'Take profit limit price' },
        stopLossPrice: { type: 'number', description: 'Stop loss price' },
        tif: { type: 'string' },
        outsideRth: { type: 'boolean' },
        account: { type: 'string' },
        transmit: { type: 'boolean' },
      },
      required: ['side', 'quantity', 'entryOrderType', 'takeProfitPrice', 'stopLossPrice'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = BracketOrderInput.parse(args);
      return withEnvelope(async () => ordersService.orderPlace(input as any));
    },
  },
  {
    name: 'oco_order',
    description: 'Place a One-Cancels-Other (OCO) order group. When one order fills, the other is cancelled.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conId: { type: 'number' },
        symbol: { type: 'string' },
        secType: { type: 'string' },
        exchange: { type: 'string' },
        currency: { type: 'string' },
        side: { type: 'string', enum: ['BUY', 'SELL'] },
        quantity: { type: 'number' },
        ocaGroup: { type: 'string', description: 'OCA group name' },
        order1Type: { type: 'string', description: 'First order type' },
        order1Price: { type: 'number', description: 'First order price' },
        order2Type: { type: 'string', description: 'Second order type' },
        order2Price: { type: 'number', description: 'Second order price' },
        tif: { type: 'string' },
        account: { type: 'string' },
      },
      required: ['side', 'quantity', 'ocaGroup', 'order1Type', 'order1Price', 'order2Type', 'order2Price'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OCOOrderInput.parse(args);
      return withEnvelope(async () => ordersService.orderPlace(input as any));
    },
  },
  {
    name: 'order_status_stream_subscribe',
    description: 'Subscribe to live order status updates. Events are delivered via MCP notifications.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
    handler: async (_args: Record<string, unknown>) => {
      return withEnvelope(async () => ordersService.orderStatusStreamSubscribe());
    },
  },
  {
    name: 'order_status_stream_unsubscribe',
    description: 'Unsubscribe from order status updates.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subscription_id: { type: 'string', description: 'Subscription ID from subscribe call' },
      },
      required: ['subscription_id'],
    },
    handler: async (args: Record<string, unknown>) => {
      const input = OrderStatusStreamUnsubscribeInput.parse(args);
      return withEnvelope(async () => ordersService.orderStatusStreamUnsubscribe(input.subscription_id));
    },
  },
];
