# CS2 Competitive Dashboard QA

Date: 2026-08-23

## Automated release evidence

The shared Pro/Lite source has passed clean GitHub Actions validation on Windows and Linux.

Automated checks cover:

- TypeScript typecheck
- CS2 normal-player GSI normalization fixtures
- App ID 730 rejection for non-CS2 payloads
- localhost-only authenticated GSI listener behavior
- Steam library and custom-library discovery fixtures
- atomic GSI configuration generation
- session K/D, derived ADR, HS%, match finalization, and W/L fixtures
- online provider client success/error fixtures
- Competitive/Premier and FACEIT key-format fixtures
- stateless gateway identity/provider/error fixtures
- no-open-proxy gateway test
- no-store gateway response policy
- production dependency audit at high severity
- exact Pro action-surface policy
- exact Lite action/metric ceiling policy
- provider-secret exclusion from packaged plugins
- official Leetify attribution fail-closed policy before a production gateway may be enabled
- both Pro and Lite builds
- official Elgato CLI validation
- official `.streamDeckPlugin` packaging

Expected packaged action surfaces:

### Pro

- Live Metric
- Session Metric
- Competitive Metric
- FACEIT Metric
- CS2 Status

### Lite

- Live Metric
- CS2 Status

Lite Live Metric is restricted to Score, Health, Money, and Map.

## Provider architecture QA

The online gateway is deliberately stateless.

- fixed Steam, Leetify, and FACEIT upstreams only
- no arbitrary proxy target
- no GSI endpoint
- no KV, D1, R2, Durable Object, database, or persistent cache binding
- provider secrets remain server-side
- response header is `Cache-Control: no-store`
- normalized data only is returned to the plugin
- Leetify `not found`, private, rate-limit, unavailable, and offline states remain explicit
- FACEIT `not found`, rate-limit, unavailable, and offline states remain explicit

## Release blockers that require external state

These are not ordinary code or packaging failures and cannot be truthfully simulated in CI.

1. **Official Leetify attribution asset**
   - Obtain Leetify's unmodified primary dark-background `Data Provided by Leetify` SVG from the asset folder linked by Leetify's developer guidelines.
   - Commit it exactly as `plugin/static/ui/leetify-provided-dark.svg`.
   - Do not redraw, trace, recolor, or recreate it.

2. **Provider / Cloudflare secrets**
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `FACEIT_API_KEY`
   - `STEAM_WEB_API_KEY`
   - `LEETIFY_API_KEY`
   - Store these as GitHub environment/repository secrets, never in source.

3. **Production provider deployment**
   - Run `.github/workflows/cs2-gateway-deploy.yml` manually after #1 and #2.
   - The workflow reruns gateway tests, refuses to deploy without the official Leetify attribution file, deploys through Wrangler, and verifies `/health`.
   - Wire the resulting HTTPS origin with `npm run set-gateway -- https://<worker-origin>` from the plugin directory.
   - That command also replaces the temporary text attribution with the official logo element and refuses to run if the logo file is missing.
   - Rerun the full product CI after wiring.

4. **Real normal-player CS2 smoke test**
   - Install the Pro candidate on Windows.
   - Open its Property Inspector and press `Enable Live CS2 Tracking`.
   - Confirm automatic Steam/App 730 discovery or use the path override only if needed.
   - Launch/restart CS2 as a normal player, not GOTV/observer.
   - Verify live Score, Health, Money, Map, weapon/ammo, and player stat updates.
   - Verify no exact timer is claimed from observer-only data.
   - Complete a match and verify W/L increments once and session metrics remain coherent.

5. **Physical Stream Deck smoke test**
   - Add all five Pro action families to keys.
   - Confirm readable rendering, prompt key refresh, Property Inspector settings persistence, Stream Deck restart persistence, and clean error states with CS2 closed/provider unavailable.

## Smallest final manual test

Once the provider deployment is wired, the minimum final host/device validation is:

1. install Pro
2. enable GSI
3. launch CS2 and play/enter a normal match
4. confirm at least one Live, Session, Competitive, and FACEIT key
5. close/reopen Stream Deck and CS2
6. confirm settings and data recovery

Everything before that boundary is automated and should remain automated.
