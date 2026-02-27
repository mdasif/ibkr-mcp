# IBKR MCP Server — Agent Instructions

You are connected to a production-grade MCP server that interfaces with Interactive Brokers (IB Gateway / TWS). Follow these guidelines carefully.

## Workflow Rules

1. **Always qualify contracts first.** Before requesting market data, placing orders, or any operation that needs a contract, call `contract_qualify` or `contract_search` to get a valid `conId`. Never guess contract IDs.

2. **Use `order_preview` before `order_place`.** Always preview orders to verify commission, margin impact, and price before submitting. This is especially important for options and futures.

3. **Respect guardrails.** The server enforces risk guardrails:
   - Read-only mode blocks all order mutations
   - Maximum order quantity and notional limits
   - Allowed order types whitelist
   - Symbol allowlist/denylist
   - Outside-RTH restrictions
   - Daily loss limits
   If a guardrail blocks your action, explain to the user what limit was hit and suggest alternatives.

4. **Handle streaming subscriptions carefully.**
   - Always unsubscribe when data is no longer needed
   - Use `subscriptions_list` to see active subscriptions
   - IB limits the number of concurrent market data lines (typically 100)

5. **Check connection before operations.** If you get connection errors, call `connection_status` to diagnose. The server handles reconnection automatically, but operations during reconnection will fail.

## Tool Categories

### Contract/Instrument Tools
- `contract_search` — Find instruments by name/symbol
- `contract_qualify` — Qualify partial contract → full conId (REQUIRED before use)
- `contract_details` — Full specs, trading hours, min tick
- `contract_rules` — Trading rules and order type support
- `option_chain` — Full option chain for an underlying
- `security_definitions_option_parameters` — Available expirations and strikes

### Market Data Tools
- `market_data_snapshot` — Point-in-time quote (bidprice, ask, last, volume)
- `market_data_bulk_snapshot` — Multiple contracts at once
- `historical_data` — OHLCV bars (1 min to 1 month)
- `historical_ticks` — Individual tick data
- `fundamental_data` — Financial summaries, ratios, earnings
- `market_depth_snapshot` — Order book (Level 2)
- `market_data_stream_subscribe/unsubscribe` — Live tick stream
- `realtime_bars_stream_subscribe/unsubscribe` — 5-second bars

### Order Management Tools
- `order_preview` — What-if analysis (commission, margin)
- `order_place` — Submit new order
- `order_modify` — Modify existing open order
- `order_cancel` — Cancel specific order
- `orders_cancel_all` — Global cancel (use with caution!)
- `orders_open_list` — List open/pending orders
- `orders_completed_list` — List filled/cancelled orders
- `executions_list` — Execution reports (fills)
- `bracket_order` — Entry + take-profit + stop-loss
- `oco_order` — One-cancels-other group

### Account/Portfolio Tools
- `accounts_list` — List managed accounts
- `account_summary` — Net liquidation, equity, margin, cash
- `positions_list` — Open positions with PnL
- `portfolio_list` — Portfolio with market values
- `pnl_account` — Real-time account PnL
- `pnl_position` — Real-time position PnL
- `buying_power` — Available buying power
- `cash_balances` — Cash by currency
- `leverage_metrics` — Leverage and margin utilization
- `margin_requirements` — Current margin requirement

### Risk/Analytics Tools
- `greeks_calculate` — Option Greeks for a contract
- `portfolio_greeks` — Aggregate portfolio Greeks
- `option_price_calculate` — Theoretical option pricing
- `implied_volatility_calculate` — IV from price
- `stress_test_portfolio` — Scenario analysis
- `value_at_risk` — Portfolio VaR (parametric)
- `beta_exposure` — Beta relative to benchmark
- `correlation_matrix` — Pairwise correlations
- `exposure_by_symbol` / `exposure_by_sector` — Exposure breakdown
- `simulate_trade_impact` — Pre-trade risk analysis

### News & Scanner Tools
- `news_headlines` — Recent headlines by provider/contract
- `news_article` — Full article text
- `scanner_run` — Custom market scanner
- `scanner_run_preset` — Pre-configured scans (top gainers, losers, etc.)

### Admin/Health Tools
- `ping` — Health check
- `connection_status` — Detailed connection info
- `server_config` — Current configuration
- `error_log` — Recent error buffer
- `server_time` — IB server time

## Error Handling

All responses follow a standard envelope:
```json
{
  "success": true|false,
  "data": { ... },       // on success
  "error": {             // on failure
    "code": "ERROR_CODE",
    "message": "...",
    "details": { ... }
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601",
    "latencyMs": 123
  }
}
```

Common error codes:
- `NOT_CONNECTED` — IB connection is down
- `CONTRACT_NOT_FOUND` — Invalid conId or symbol
- `PACING_VIOLATION` — Too many requests, retry after delay
- `ORDER_REJECTED` — Order rejected by IB
- `RISK_GUARDRAIL_BLOCKED` — Server guardrail prevented action
- `MARKET_DATA_UNAVAILABLE` — No data subscription or market closed

## Best Practices

1. Start workflows with `ping` or `connection_status` to verify connectivity
2. Cache contract qualifications (conId) within a conversation
3. Use `market_data_bulk_snapshot` for multiple quotes instead of individual calls
4. For options analysis, get the chain first, then qualify specific strikes
5. Monitor `error_log` if operations are failing unexpectedly
6. Use `scanner_run_preset` for common scans instead of building from scratch
