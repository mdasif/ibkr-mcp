# ibkr-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for **Interactive Brokers**. Connect any MCP-compatible AI agent to TWS or IB Gateway and get access to 80+ tools — market data, order management, account monitoring, risk analytics, news, and scanning — all through natural language.

## Features

- **80+ MCP tools** across 8 categories (contracts, market data, orders, accounts, risk, news, scanners, admin)
- **Pre-trade guardrails** — max qty, max notional, daily loss limit, symbol allow/deny lists, read-only mode
- **Streaming support** — real-time market data, order status, account updates via MCP notifications
- **Structured envelope responses** — every response wrapped in `{ success, data, error, meta }` with request IDs, timestamps, and latency
- **Reconnection with backoff** — exponential backoff + jitter, automatic subscription resumption
- **Rate limiting** — token-bucket pacing at 45 req/sec (respects IB's 50 msg/sec limit)
- **Full TypeScript strict mode** — `noUncheckedIndexedAccess`, `noUnusedLocals`, `noPropertyAccessFromIndexSignature`, and all strict flags enabled
- **ESLint** with typescript-eslint strict + stylistic presets
- **esbuild bundler** — single-file 780KB bundle, tree-shaken, with optional minification
- **Docker support** — multi-stage build + compose with IB Gateway

## Architecture

```
┌─────────────┐    stdio     ┌──────────────────────────────────────────────┐
│  MCP Client │◄────────────►│  ibkr-mcp                                    │
│  (AI Agent) │              │                                              │
└─────────────┘              │  app.ts ─► tools/ ─► services/ ─► ib_conn   │
                             │              │          │                     │
                             │          schemas/   middleware/               │
                             │        (zod validation) (guardrails,         │
                             │                          rate limit,         │
                             │                          error mapping)      │
                             └──────────────────────────────────────────────┘
                                                          │
                                                     TCP 4001/4002
                                                          │
                                                ┌─────────▼─────────┐
                                                │  TWS / IB Gateway │
                                                └───────────────────┘
```

## Prerequisites

Before setting up the IBKR MCP server, ensure you have the following:

### Required

- **Node.js** ≥ 20 — [download](https://nodejs.org/)
- **Interactive Brokers Account** — a funded or paper trading account
- **TWS (Trader Workstation)** or **IB Gateway** — [download](https://www.interactivebrokers.com/en/trading/tws.php)
  - API connections must be enabled: TWS → Edit → Global Configuration → API → Settings
  - Enable **"Enable ActiveX and Socket Clients"**
  - Note the **Socket port** (default: `7497` for TWS paper, `4002` for Gateway paper)
  - Optionally add `127.0.0.1` to **Trusted IPs** to skip connection prompts

### Optional

- **Docker & Docker Compose** — for containerized deployment
- **Claude Desktop**, **Cursor**, or any MCP-compatible client — to connect to the server

### IB Gateway vs TWS

| | IB Gateway | TWS |
|---|---|---|
| **Best for** | Headless / server use | Interactive trading + API |
| **Paper port** | `4002` | `7497` |
| **Live port** | `4001` | `7496` |
| **GUI** | Minimal | Full trading UI |
| **Stability** | Recommended for always-on | May require interaction |

## Quick Start

### Install & Build

```bash
git clone https://github.com/guramrit-dhillon/ibkr-mcp.git
cd ibkr-mcp
npm install
cp .env.example .env  # edit with your settings
npm run build
```

## Setup

### 1. Configure IB Gateway / TWS

1. Launch **IB Gateway** or **TWS** and log in (use paper trading to start)
2. Enable the API:
   - **TWS**: Edit → Global Configuration → API → Settings
   - **IB Gateway**: Configure → Settings → API → Settings
3. Check **"Enable ActiveX and Socket Clients"**
4. Note the **Socket port** (default `4002` for Gateway paper, `7497` for TWS paper)
5. Optionally add `127.0.0.1` to **Trusted IPs** to avoid connection confirmation dialogs

### 2. Configure the MCP Server

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Key settings in `.env`:

```dotenv
# Connection — match your IB Gateway/TWS settings
IB_HOST=127.0.0.1
IB_PORT=4002          # 4002=Gateway paper, 7497=TWS paper, 4001=Gateway live, 7496=TWS live
IB_CLIENT_ID=1
IB_MODE=paper         # paper | live

# Safety — start with read-only mode
IB_READ_ONLY=true     # blocks all order mutations; set to false when ready to trade

# Risk guardrails
RISK_MAX_ORDER_QTY=1000           # max shares/contracts per order
RISK_MAX_ORDER_NOTIONAL=100000    # max order value in USD
RISK_DAILY_LOSS_LIMIT=10000       # daily loss circuit breaker in USD
```

### 3. Connect from an MCP Client

#### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ibkr": {
      "command": "npx",
      "args": ["ibkr-mcp"],
      "env": {
        "IB_HOST": "127.0.0.1",
        "IB_PORT": "4002",
        "IB_READ_ONLY": "true"
      }
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json` in your project or global config:

```json
{
  "mcpServers": {
    "ibkr": {
      "command": "npx",
      "args": ["ibkr-mcp"]
    }
  }
}
```

#### Any stdio-compatible MCP client

```bash
# The server communicates over stdin/stdout using the MCP protocol
npx ibkr-mcp
```

### 4. Verify the Connection

After connecting, try these prompts to confirm everything works:

1. **"What's the connection status?"** — should show `connected: true`
2. **"List my accounts"** — should show your paper/live account(s)
3. **"What's the current price of AAPL?"** — should return a market data snapshot

## Example Prompts

Once connected, you can ask your AI assistant questions like:

### Market Data & Research
- "What's the current price of AAPL?"
- "Show me historical daily bars for TSLA over the last 6 months"
- "Get me a quote snapshot for SPY, QQQ, and IWM"
- "What are the fundamentals for MSFT — P/E ratio, market cap, earnings?"
- "Show me the order book depth for AMZN"

### Contracts & Options
- "Search for all contracts matching 'META'"
- "What are the available option expirations and strikes for AAPL?"
- "Build me an option chain for SPY expiring next month with strikes near the money"
- "What are the trading rules for ES futures — tick size, trading hours, order types?"

### Portfolio & Account
- "What's my account summary — net liquidation, buying power, margin?"
- "Show me all my current positions"
- "What's my portfolio PnL today?"
- "What are my cash balances by currency?"
- "Show me margin requirements for 100 shares of GOOG"

### Orders & Trading
- "Place a limit order to buy 50 shares of AAPL at $180"
- "Preview the margin impact of buying 200 shares of MSFT"
- "Show me all my open orders"
- "Place a bracket order: buy 100 TSLA at market with a take profit at $300 and stop loss at $250"
- "What are my recent executions today?"

### Risk & Analytics
- "Calculate the implied volatility for the AAPL 200 call expiring in March"
- "What are the greeks for my portfolio?"
- "Run a stress test: what happens if SPY drops 10%?"
- "Show me my exposure breakdown by sector"
- "What's my portfolio Value at Risk at 95% confidence?"
- "Simulate the impact of adding 500 shares of NVDA to my portfolio"

### Scanners & News
- "Run a scanner for the top gainers in US stocks today"
- "Show me the most active options by volume"
- "Get me the latest news headlines for TSLA"

### Admin
- "What's the connection status to IB Gateway?"
- "Show me the recent error log"
- "List all active streaming subscriptions"

## Tools Reference

### Contracts (8 tools)

| Tool | Description |
|------|-------------|
| `contract_search` | Search contracts by symbol/name with optional filters |
| `contract_details` | Get full contract details (by conId or symbol) |
| `contract_qualify` | Qualify a contract — fully resolve and validate |
| `contract_rules` | Get trading rules (min tick, order types, trading hours) |
| `security_definitions_option_parameters` | Get option chain parameters (expirations, strikes) |
| `option_chain` | Build a filtered option chain with greeks |
| `instrument_metadata` | Get instrument metadata (industry, category, long name) |
| `symbol_to_conid_mapping` | Resolve a symbol to qualified conId(s) |

### Market Data (15 tools)

| Tool | Description |
|------|-------------|
| `market_data_snapshot` | Get a snapshot of current market data (bid, ask, last, etc.) |
| `market_data_bulk_snapshot` | Bulk snapshots for multiple contracts |
| `historical_data` | Get historical OHLCV bars |
| `historical_ticks` | Get historical tick data |
| `fundamental_data` | Get fundamental data (financials, ratios, etc.) |
| `market_depth_snapshot` | Get current order book depth snapshot |
| `market_data_stream_subscribe` | Subscribe to streaming market data |
| `market_data_stream_unsubscribe` | Unsubscribe from streaming market data |
| `tick_by_tick_stream_subscribe` | Subscribe to tick-by-tick data |
| `tick_by_tick_stream_unsubscribe` | Unsubscribe from tick-by-tick data |
| `market_depth_stream_subscribe` | Subscribe to streaming order book |
| `market_depth_stream_unsubscribe` | Unsubscribe from streaming order book |
| `realtime_bars_stream_subscribe` | Subscribe to real-time 5-second bars |
| `realtime_bars_stream_unsubscribe` | Unsubscribe from real-time bars |
| `list_market_data_subscriptions` | List all active market data subscriptions |

### Orders (14 tools)

| Tool | Description |
|------|-------------|
| `order_place` | Place a new order (LMT, MKT, STP, TRAIL, etc.) |
| `order_modify` | Modify an existing order |
| `order_cancel` | Cancel a specific order |
| `orders_cancel_all` | Cancel all open orders |
| `orders_open_list` | List all open orders |
| `orders_completed_list` | List completed orders |
| `executions_list` | List recent executions |
| `order_preview` | Preview order impact (margin, commission) |
| `exercise_options` | Exercise or lapse options |
| `bracket_order` | Place a bracket order (entry + take profit + stop loss) |
| `oco_order` | Place a one-cancels-other order group |
| `order_status_stream_subscribe` | Subscribe to order status updates |
| `order_status_stream_unsubscribe` | Unsubscribe from order status updates |

### Account (17 tools)

| Tool | Description |
|------|-------------|
| `accounts_list` | List all managed accounts |
| `account_summary` | Get account summary (NLV, buying power, etc.) |
| `account_values` | Get all account values (key-value pairs) |
| `positions_list` | List all positions |
| `portfolio_list` | List portfolio with PnL |
| `pnl_account` | Get account-level PnL |
| `pnl_position` | Get position-level PnL |
| `account_updates_subscribe` | Subscribe to real-time account updates |
| `account_updates_unsubscribe` | Unsubscribe from account updates |
| `buying_power` | Get available buying power |
| `cash_balances` | Get cash balances by currency |
| `leverage_metrics` | Get leverage/margin metrics |
| `margin_requirements` | Get margin requirements for a contract |
| `fa_groups_list` | List Financial Advisor groups |
| `fa_profiles_list` | List Financial Advisor profiles |
| `fa_aliases_list` | List Financial Advisor aliases |
| `fa_replace` | Replace Financial Advisor configuration |

### Risk Analytics (14 tools)

| Tool | Description |
|------|-------------|
| `option_price_calculate` | Calculate theoretical option price |
| `implied_volatility_calculate` | Calculate implied volatility |
| `greeks_calculate` | Calculate option greeks |
| `portfolio_greeks` | Get aggregate portfolio greeks |
| `stress_test_portfolio` | Run portfolio stress test with custom scenarios |
| `exposure_by_symbol` | Get notional exposure by symbol |
| `exposure_by_sector` | Get exposure breakdown by sector |
| `value_at_risk` | Calculate portfolio Value at Risk |
| `beta_exposure` | Calculate portfolio beta exposure |
| `correlation_matrix` | Generate correlation matrix for portfolio |
| `simulate_trade_impact` | Simulate impact of a hypothetical trade |
| `dividends_and_splits_history` | Get dividend/split history |
| `corporate_actions_calendar` | Get upcoming corporate actions |

### News (6 tools)

| Tool | Description |
|------|-------------|
| `news_providers_list` | List available news providers |
| `news_bulletins_subscribe` | Subscribe to IB bulletins |
| `news_bulletins_unsubscribe` | Unsubscribe from IB bulletins |
| `news_headlines` | Get news headlines for a contract |
| `news_article` | Get full news article by ID |
| `historical_news` | Get historical news for a contract |

### Scanner (5 tools)

| Tool | Description |
|------|-------------|
| `scanner_parameters` | Get available scanner parameters XML |
| `scanner_run` | Run a market scanner with custom criteria |
| `scanner_cancel` | Cancel a running scanner subscription |
| `scanner_presets_list` | List scanner presets |
| `scanner_run_preset` | Run a scanner from a preset name |

### Admin (7 tools)

| Tool | Description |
|------|-------------|
| `connection_status` | Get connection state, uptime, error log |
| `connection_reconnect` | Force reconnection to TWS/IB Gateway |
| `server_config` | View current server configuration |
| `error_log` | Get recent IB error log |
| `subscriptions_list` | List all active subscriptions |
| `server_time` | Get server time |
| `ping` | Health check / ping |

## Configuration

All configuration via environment variables (see [.env.example](.env.example)):

| Variable | Default | Description |
|----------|---------|-------------|
| `IB_HOST` | `127.0.0.1` | TWS/Gateway host |
| `IB_PORT` | `4002` (paper) / `4001` (live) | API port |
| `IB_CLIENT_ID` | `1` | Client ID |
| `IB_MODE` | `paper` | `paper` or `live` |
| `IB_READ_ONLY` | `true` | Block all order mutations |
| `IB_ACCOUNT_ID` | _(auto)_ | Account ID override |
| `RISK_MAX_ORDER_QTY` | `1000` | Max shares/contracts per order |
| `RISK_MAX_ORDER_NOTIONAL` | `100000` | Max order notional ($) |
| `RISK_DAILY_LOSS_LIMIT` | `10000` | Daily loss limit ($) |
| `RISK_ALLOWED_ORDER_TYPES` | `MKT,LMT,STP,STP_LMT,TRAIL` | Allowed order types |
| `RISK_SYMBOL_ALLOWLIST` | _(none)_ | Only allow these symbols |
| `RISK_SYMBOL_DENYLIST` | _(none)_ | Block these symbols |
| `RISK_ALLOW_OUTSIDE_RTH` | `false` | Allow outside-hours orders |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Docker

### With Docker Compose (recommended)

```bash
# Set credentials
cp .env.example .env
# Edit .env: TWS_USERID, TWS_PASSWORD, TRADING_MODE

# Start IB Gateway + MCP server
docker compose up -d

# Check logs
docker compose logs -f mcp
```

### Standalone

```bash
docker build -t ibkr-mcp .
docker run --rm -i \
  -e IB_HOST=host.docker.internal \
  -e IB_PORT=4002 \
  ibkr-mcp
```

## Development

```bash
# Run in development mode
npm run dev

# Type-check only
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Full check (typecheck + lint)
npm run check

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Build (typecheck + bundle)
npm run build

# Bundle only (skip typecheck)
npm run build:bundle
npm run build:bundle:min  # minified
```

### Project Structure

```
src/
├── app.ts                    # MCP server bootstrap
├── config.ts                 # Environment-driven configuration
├── connection/
│   ├── ib_connection.ts      # IB API connection manager
│   └── event_bus.ts          # Typed event pub/sub
├── middleware/
│   ├── logging.ts            # JSON structured logger
│   ├── error_mapping.ts      # Error normalization + response envelope
│   ├── rate_limit.ts         # Token-bucket rate limiter
│   └── guardrails.ts         # Pre-trade safety checks
├── schemas/
│   ├── common.ts             # Shared types (contract, error, response)
│   ├── contract_schemas.ts   # Contract tool schemas
│   ├── market_data_schemas.ts
│   ├── order_schemas.ts
│   ├── account_schemas.ts
│   ├── news_schemas.ts
│   └── scanner_schemas.ts
├── services/
│   ├── contract_service.ts   # Contract operations
│   ├── market_data_service.ts
│   ├── orders_service.ts
│   ├── account_service.ts
│   ├── risk_service.ts
│   ├── news_service.ts
│   └── scanner_service.ts
├── tools/
│   ├── index.ts              # Tool aggregation + O(1) dispatch
│   ├── contract_tools.ts     # Tool definitions + handlers
│   ├── market_data_tools.ts
│   ├── order_tools.ts
│   ├── account_tools.ts
│   ├── risk_tools.ts
│   ├── news_tools.ts
│   ├── scanner_tools.ts
│   └── admin_tools.ts
└── resources/
    ├── index.ts              # MCP resource definitions
    └── server_instructions.md
tests/
├── config.test.ts
├── error_mapping.test.ts
├── guardrails.test.ts
├── rate_limit.test.ts
├── schemas.test.ts
└── event_bus.test.ts
```

## Response Format

Every tool returns a standardized envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2025-01-15T12:34:56.789Z",
    "latency_ms": 42
  }
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "IB_CONTRACT_NOT_FOUND",
    "message": "No matching contract found",
    "details": {},
    "ib_error_code": 200,
    "retriable": false
  },
  "meta": { ... }
}
```

## Safety

- **Read-only by default** — `IB_READ_ONLY=true` blocks all order mutations
- **Pre-trade guardrails** — quantity limits, notional limits, daily loss limits
- **Symbol filtering** — allowlist/denylist enforcement
- **Order type restrictions** — only configured order types allowed
- **Outside-RTH protection** — disabled by default

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Interactive Brokers Group, Inc. "Interactive Brokers", "IBKR", "TWS", and "IB Gateway" are registered trademarks of Interactive Brokers Group, Inc. Use of the Interactive Brokers API is subject to their [API License Agreement](https://www.interactivebrokers.com/en/index.php?f=5041). This software is provided as-is with no warranty — use at your own risk, especially when placing live orders.

## License

MIT
