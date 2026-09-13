# Spec: `roll_option` — Atomic Combo/BAG Option Roll Order

Status: **NOT STARTED** (design only). This document is the resumable starting
point for implementing the tool. Written 2026-09-12 after a full hardening
pass on the forked IBKR MCP server (see "Prior Work" below).

## 1. Why this tool exists

The user's primary options strategy is **selling and rolling** calls and puts
(covered calls, cash-secured puts) across both Robinhood and IBKR. "Rolling"
means: buy back the currently-short option and sell a new option (different
strike and/or expiry) *as a single atomic transaction*, so the position is
never naked/uncovered even for a moment and the net debit/credit is priced as
one spread rather than two independent legs with slippage risk in between.

This is the **specific reason** `guramrit-dhillon/ibkr-mcp` was forked to
`mdasif/ibkr-mcp` in the first place: IB's native way to do this is a
**BAG contract with ComboLegs**, submitted as one `placeOrder` call — not two
sequential `order_place` calls. Two sequential legs is what "naive" rolling
would look like, and is explicitly the thing we are avoiding.

## 2. What already exists in the codebase (as of commit `eec3421`)

**Building blocks are present but unwired:**
- `src/schemas/common.ts`: `ComboLegSchema` (`conId`, `ratio`, `action`,
  `exchange`) and `ContractWithLegsSchema` (`ContractSchema.extend({ comboLegs:
  z.array(ComboLegSchema).optional() })`) already exist.
- `BAG` is already a valid value in the `secType` enum (`common.ts` and
  `contract_tools.ts`).
- `orders_service.ts`'s internal `contract` type already has an ad-hoc
  `comboLegs?: {...}[]` field bolted onto `ContractInput`.

**The critical gap — confirmed by direct source inspection this session:**
- `contract_service.ts`'s `toIBContract(input: ContractInput): IBContract`
  function (the single place that converts our schema objects into the
  `@stoqey/ib` wire format before every `placeOrder`/`reqContractDetails`
  call) has **zero handling of `comboLegs`**. It only maps: symbol, secType,
  exchange, currency, conId, lastTradeDateOrContractMonth, strike, right,
  multiplier, primaryExch, localSymbol, tradingClass. If you passed a BAG
  contract with comboLegs through `order_place` today, the legs would be
  silently dropped and IB would either reject the order or (worse) try to
  price a BAG contract with no legs.
- No tool file (`order_tools.ts`) currently exposes anything that lets a
  caller build/submit a combo contract at all. `OrderPlaceInput`'s `contract`
  field uses `ContractSchema` (no legs), not `ContractWithLegsSchema`.
- There is no `roll_option` tool, handler, or service function anywhere in
  the codebase. This is 100% net-new work, using the above as raw materials.

## 3. Required IB wire-format shape (reference)

A combo/BAG order to IB (`@stoqey/ib`'s `placeOrder`) needs a `Contract` like:

```
{
  symbol: '<underlying symbol>',   // e.g. 'META'
  secType: 'BAG',
  currency: 'USD',
  exchange: 'SMART',
  comboLegs: [
    { conId: <old option conId>, ratio: 1, action: 'BUY',  exchange: 'SMART' },
    { conId: <new option conId>, ratio: 1, action: 'SELL', exchange: 'SMART' },
  ],
}
```

Both legs' `conId`s must already be qualified (via `reqContractDetails`,
i.e. the existing `contract_qualify`/`option_chain` tools) before building
this — IB will reject unqualified conIds in a combo leg.

The accompanying `Order` object is a normal limit/market order (`LMT`,
`MKT`, etc.) — the "spread price" is quoted as one number (net debit/credit
across both legs), not per-leg. For a roll this is typically a small net
credit or debit depending on strike/expiry movement.

## 4. Proposed `roll_option` tool design

**Tool name:** `roll_option`

**Conceptual inputs:**
- `account` (optional, defaults to active account)
- `closeContract` — the currently-short option to buy back (by `conId`, or
  by symbol+expiry+strike+right if conId isn't known yet — needs a qualify
  step first either way)
- `closeQuantity` — contracts to buy back (positive int)
- `openContract` — the new option to sell (same shape as `closeContract`,
  different strike/expiry)
- `openQuantity` — contracts to sell (should normally equal `closeQuantity`
  for a like-for-like roll, but don't hard-block a size change — rolling into
  a different position size is a legitimate strategy)
- `netPrice` — limit price for the net debit/credit of the whole combo, sign
  convention needs deciding (see Open Question 1 below)
- `orderType` — likely just `LMT` needed initially; `MKT` combo orders are
  legal but risky for options and probably out of scope for v1
- `timeInForce` — reuse `TimeInForceEnum`
- `dryRun`/preview support — should reuse the existing `order_preview`/
  `order_what_if` pattern rather than inventing a new preview mechanism

**High-level flow the handler needs to implement:**
1. Qualify both legs' contracts if `conId` not already given (call existing
   contract qualification logic — check `contract_service.ts`'s
   `qualifyContract`/equivalent, reuse rather than reinvent).
2. Determine `action` per leg automatically: closing a short option is
   always `BUY`, opening a new short option is always `SELL`. (Don't expose
   `action` as user input per leg — infer it from "close" vs "open" — this
   removes a whole class of user error where someone could accidentally
   submit BUY/BUY or SELL/SELL and get a garbage order.)
3. Build the `ContractWithLegsSchema`-shaped BAG contract with `ratio: 1`
   for both legs (1:1 exchange is the vast majority case; consider whether
   ratio needs to be user-configurable for unbalanced rolls — probably not
   for v1, hardcode ratio 1 and revisit if the user asks for ratio spreads).
4. Fix `toIBContract` in `contract_service.ts` to actually map `comboLegs`
   through to the `IBContract` object — this is mandatory, not optional;
   the tool cannot work without this fix regardless of what the tool layer
   does.
5. Build a normal `Order` object (reuse existing order-building logic from
   `orderPlace` in `orders_service.ts` rather than duplicating it) with
   `action: 'BUY'` (IB convention: BAG order's top-level action describes
   the *debit* side; verify this against IB docs/TWS behavior before coding
   — see Open Question 1) and the net limit price.
6. Call `conn.api.placeOrder(orderId, bagContract, order)` — same call
   `order_place` already uses, just with a different contract shape. No new
   IB API surface needed beyond what's already wired.
7. Return the resulting order status same as `order_place` does today
   (reuse the existing order-tracking/response-shaping logic).

## 5. Open questions to resolve before/during implementation

1. **Sign convention for combo limit price and top-level order action.**
   IB's TWS convention for BAG orders: the limit price is the *net* price
   of the combo from the order's perspective, and the order's top-level
   `action` (BUY/SELL) combined with each leg's own `action` determines
   the actual direction. For a credit roll (opening leg richer than closing
   leg — the common case when rolling out for a credit), is the top-level
   order `action: 'SELL'` with a positive limit price meaning "collect at
   least $X net credit", or is it `action: 'BUY'` with a negative price?
   **This needs to be verified empirically against paper trading, not
   assumed from documentation** — same category of gotcha as the
   `reqSecDefOptParams` empty-string-vs-'SMART' bug found this session.
   Recommend: build a minimal standalone test script that submits one BAG
   order directly via `@stoqey/ib` (bypassing the MCP tool layer entirely,
   same pattern as `/tmp/test_put_place.mjs` from this session) against the
   paper account first, to nail the sign convention before writing the real
   tool, rather than debugging it through the full MCP stack.
2. **Should `roll_option` support "open-only, no existing position" or
   "close-only, no replacement"?** i.e. is this strictly a 2-leg roll, or
   should it degrade gracefully to a straight close or straight open if one
   side isn't provided? Recommend: v1 requires both legs (that's the whole
   point — the atomicity). If the user wants to just close or just open,
   the existing `order_place` already covers that; don't overload this
   tool.
3. **What happens on partial fill of a combo order?** IB fills combo orders
   as a unit for marketable orders, but a resting limit combo order can
   partially fill leg-by-leg at the exchange level in some cases. Needs
   research into `@stoqey/ib`'s combo order-status event semantics — check
   whether `orderStatus`/`execDetails` events report combo fills
   differently than single-leg fills. Not blocking for a v1 spec but should
   inform how the tool reports status back.
4. **Multi-leg rolls beyond 2 legs?** (e.g. rolling a spread, not a single
   option.) Explicitly out of scope for v1 — this spec is for the single-
   option-in, single-option-out roll only, matching the user's stated
   strategy (covered calls / CSPs, not multi-leg spreads).

## 6. Concrete first implementation steps (in order)

1. Write the standalone paper-trading test script to resolve Open Question 1
   (sign convention) — do this *before* writing any tool code.
2. Fix `contract_service.ts`'s `toIBContract` to map `comboLegs` through when
   `input.secType === 'BAG'`.
3. Add `RollOptionInput` to `src/schemas/order_schemas.ts` (or a new
   `roll_schemas.ts` if `order_schemas.ts` is getting large) per the shape in
   section 4.
4. Add a `rollOption()` function to `orders_service.ts`, reusing as much of
   `orderPlace`'s existing qualify → build contract → build order → place →
   track pattern as possible (don't duplicate the promise/timeout/cleanup
   boilerplate that's already flagged as duplicated elsewhere in the
   codebase — extracting that into a shared helper first would actually make
   `roll_option` easier to write cleanly, worth doing as a preparatory step).
5. Add the `roll_option` tool definition to `order_tools.ts` using the
   existing `toSchema()` helper from `schema_utils.ts` (established pattern
   this session — do not hand-write the JSON schema).
6. Write a vitest unit test for the schema/validation layer (cross-field:
   both legs required, quantities positive, etc.) following the existing
   test file patterns.
7. Test end-to-end on paper: use the actual open position from this session
   (SELL 1x META $600P exp 2026-09-25, Order ID 3, Perm ID 975838699) as the
   "close" leg once it's near expiry or ITM — this is a real, already-placed
   position, not a hypothetical, making it a good natural test case.
8. Only after full paper validation, per the user's explicit standing
   safety directive, consider testing against the live account.

## 7. Related pre-existing TODOs discovered during the hardening pass
   (not required for `roll_option` specifically, but touch the same files
   and are worth doing in the same pass if convenient):
   - `logging.ts` has the same eager-singleton `.env`-read-before-load bug
     pattern that was fixed in `ib_connection.ts` this session — not yet
     fixed.
   - `npm run dev` (tsx, not esbuild) bypasses the esbuild-banner `.env` fix
     entirely — dev-mode runs still don't load `.env` correctly. Only
     `npm run build` + `node dist/app.js` is confirmed working.
   - `zod` 3.25.76→4.6.4 and `uuid` 11.1.1→14.0.2 major bumps still deferred.
   - Duplicated promise/timeout/cleanup boilerplate across ~28 call sites in
     `*_service.ts` files — flagged as a good candidate to extract into a
     shared helper, and would directly reduce the amount of new duplicate
     code `rollOption()` needs in step 4 above.

## 8. Environment reference (for whoever picks this up)

- Repo: `mdasif/ibkr-mcp` (fork), local clone `~/Code/ibkr-mcp`, branch `main`.
  `upstream` remote (`guramrit-dhillon/ibkr-mcp`) is dead — do not sync from it.
- Latest pushed commit at time of writing: `eec3421`.
- IB Gateway (not TWS) runs headless. **Paper**: port 4002, account
  `DUT121147`. **Live**: port 4001 (separate account, untouched so far).
- Build: `npm run build` → esbuild bundles to `dist/app.js` (single file,
  ~830kb). `.env` is loaded via an esbuild **banner** injected in
  `scripts/build.mjs` — this is deliberate and required; do not move that
  logic back into `app.ts`, it was proven not to work reliably there (see
  git history/commit `bd3736b` for the full story if the reasoning needs
  re-verifying).
- Test: `npx vitest run` (currently 84/84 passing). `npx tsc --noEmit` for
  typecheck.
- Existing proven pattern for schema-to-MCP-JSON-Schema: `toSchema()` in
  `src/tools/schema_utils.ts`, wrapping `zodToJsonSchema()`. Use this for
  any new tool, do not hand-write `inputSchema`.
- A real paper order already exists to test against: SELL 1x META $600 Put,
  exp 2026-09-25, Order ID 3, Perm ID 975838699, status was `PreSubmitted`
  as of last check (will have activated at Monday's market open since).
