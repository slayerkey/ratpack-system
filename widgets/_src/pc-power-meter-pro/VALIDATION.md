# PC Power Meter Pro Validation

## Verdict

**BUILD / RELEASE CANDIDATE TARGET**

PC Power Meter Pro is technically feasible as an honest power and energy product when its claims are scoped to the power sensors that iCUE actually exposes on the buyer's hardware.

## Official provider evidence

The current CORSAIR iCUE Sensors Data Provider exposes a `power` sensor type and sensor kinds including CPU `package`, PSU `power-in`, PSU `power-out`, rail power kinds, and `total-power-draw`.

The provider also exposes sensor identity, units, device name, sensor kind, connectivity, enumeration, value-change signals, add/remove signals and a default-sensor lookup. Native XENEON widget properties support `sensors-combobox` for one sensor and `sensors-factory` for multiple sensor/color selections.

## Product boundary

Availability is hardware-dependent. The provider contract does not guarantee that every PC exposes whole-system power, a compatible PSU power reading, or a dedicated GPU board-power sensor.

The product therefore uses one selected primary measured `power` sensor as the authoritative scope. CPU package power is labeled CPU package power. PSU input and output stay distinct. Total-PC wording is used only when iCUE identifies the sensor as `total-power-draw`.

Additional Pro sensors are comparisons only and are never summed into a manufactured total.

## Accuracy approach

Energy uses trapezoidal integration over the actual elapsed milliseconds between valid readings. The implementation does not assume a fixed one-second sample interval. Invalid readings, long telemetry gaps, disconnects and offline restart time are not backfilled.

Estimated electricity cost is primary-sensor kWh multiplied by the user-configured rate and inherits the primary sensor's measurement scope.

## Feature decision

Pro adds multiple measured traces, primary-sensor energy cost, daily energy, local session history, graph-window control, high-power threshold and additional customization.

Idle-versus-active classification is intentionally omitted in V1 because the current Sensors contract does not provide a universal workload-state signal that would make the label defensible across PCs.

## Pricing

Recommended launch price: **$7.99**. The depth is materially above Lite while remaining below broader dashboard products: multi-sensor comparison, persistent accounting, cost, daily totals, history, thresholds and extended graph control justify the upper end of the original $6.99–$7.99 range.
