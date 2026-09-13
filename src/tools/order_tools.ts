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
import { toSchema } from './schema_utils';

export const ORDER_TOOLS = [
  {
    name: 'order_place',
    description: 'Place a new order. Requires: contract (qualified, use contract_qualify first), side, quantity, and orderType.',
    inputSchema: toSchema(OrderPlaceInput),
    handler: async (args: Record<string, unknown>) => {
      const input = OrderPlaceInput.parse(args);
      return withEnvelope(async () => ordersService.orderPlace(input));
    },
  },
  {
    name: 'order_modify',
    description: 'Modify an existing open order. Requires the same fields as order_place plus the orderId to modify.',
    inputSchema: toSchema(OrderModifyInput),
    handler: async (args: Record<string, unknown>) => {
      const input = OrderModifyInput.parse(args);
      return withEnvelope(async () => ordersService.orderModify(input));
    },
  },
  {
    name: 'order_cancel',
    description: 'Cancel an open order by orderId.',
    inputSchema: toSchema(OrderCancelInput),
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
    inputSchema: toSchema(OrdersOpenListInput),
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
    inputSchema: toSchema(ExecutionsListInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ExecutionsListInput.parse(args);
      return withEnvelope(async () => ordersService.executionsList(input));
    },
  },
  {
    name: 'order_preview',
    description: 'Preview/what-if an order: see estimated commission, margin impact, equity with loan before actually sending. Same input shape as order_place.',
    inputSchema: toSchema(OrderPreviewInput),
    handler: async (args: Record<string, unknown>) => {
      const input = OrderPreviewInput.parse(args);
      return withEnvelope(async () => ordersService.orderWhatIf(input));
    },
  },
  {
    name: 'exercise_options',
    description: 'Exercise or lapse an option contract.',
    inputSchema: toSchema(ExerciseOptionsInput),
    handler: async (args: Record<string, unknown>) => {
      const input = ExerciseOptionsInput.parse(args);
      return withEnvelope(async () => ordersService.exerciseOptions(input.contract, input.exerciseAction, input.exerciseQuantity, input.account, input.override));
    },
  },
  {
    name: 'bracket_order',
    description: 'Place a bracket order: parent + take-profit + stop-loss. All three orders are linked and submitted together.',
    inputSchema: toSchema(BracketOrderInput),
    handler: async (args: Record<string, unknown>) => {
      const input = BracketOrderInput.parse(args);
      return withEnvelope(async () => ordersService.orderPlace(input as any));
    },
  },
  {
    name: 'oco_order',
    description: 'Place a One-Cancels-Other (OCO) order group of 2-10 orders. When one order fills, the others are cancelled.',
    inputSchema: toSchema(OCOOrderInput),
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
    inputSchema: toSchema(OrderStatusStreamUnsubscribeInput),
    handler: async (args: Record<string, unknown>) => {
      const input = OrderStatusStreamUnsubscribeInput.parse(args);
      return withEnvelope(async () => ordersService.orderStatusStreamUnsubscribe(input.subscription_id));
    },
  },
];
