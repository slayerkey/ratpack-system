# PC Power Meter Feasibility Spike

## Official provider contract

Source of truth reviewed: current `Corsair-Labs/icue-widget-builder` Sensors Data Provider documentation and widget meta-parameter reference.

The documented Sensors provider exposes enumeration and metadata methods needed for an honest power meter:

- `getAllSensorIds()`
- `getSensorType()`
- `getSensorKind()`
- `getSensorDeviceName()`
- `getSensorName()`
- `getSensorUnits()`
- `getSensorValue()`
- `sensorIsConnected()`
- add, remove, data, value and unit change signals

The official widget controls include `sensors-combobox` for one sensor and `sensors-factory` for multiple sensors.

## Power capabilities actually documented

The provider documents sensor type `power`.

Relevant documented sensor kinds include:

- `package` — CPU package
- `power-in` — input power, for example a compatible PSU
- `power-out` — output power, for example a compatible PSU
- `power-3-3`
- `power-5`
- `power-12`
- `total-power-draw` — total power consumption

This means the API can represent a true total power draw sensor, CPU package power and compatible PSU telemetry when iCUE/hardware exposes those sensors.

## What is not universal

The API contract does not guarantee that every PC has any particular power sensor.

There is no documented universal `gpu-board-power` sensor kind. A GPU may appear as a `power` sensor with GPU-identifying device or sensor metadata, but the product must not promise that every GPU exposes board power or silently upgrade a generic GPU power reading into that claim.

A documented `total-power-draw` kind is a capability, not a guarantee that ordinary motherboard/CPU/GPU combinations expose whole-system wall draw.

Compatible CORSAIR PSU hardware can expose input/output power telemetry, but those readings have different scopes. PSU output excludes conversion loss. PSU input is closer to wall-side PC electrical input but still depends on the compatible hardware/provider exposing it correctly.

## Existing RatPack sensor infrastructure

`rig-battery` provides reusable, proven patterns for:

- request/response correlation for the asynchronous Sensors provider
- sensor enumeration and metadata inspection
- add/remove/reconnect handling
- value and unit change signals
- periodic reconciliation
- duplicate label disambiguation
- per-widget-instance local storage
- all eight XENEON slot mappings
- deterministic provider fixtures

PC Power Meter reuses those lifecycle patterns but has its own power-specific catalogue, sampling, graphing, session and energy-accounting implementation.

## Real hardware enumeration

This ChatGPT/GitHub execution environment has no live local iCUE process or physical sensor bus, so a real machine sensor dump cannot be performed here. Existing repository browser fixtures are deterministic mocks, not evidence that a buyer's specific PC exposes a given sensor.

The product therefore treats provider metadata as the runtime truth and has explicit empty, disconnected and unavailable states.

## Product decision

### Lite

Lite is built around one user-selected iCUE `power` sensor. All displayed values refer only to that measured sensor.

### Pro

Pro uses one primary measured power sensor for session energy, daily energy and cost, plus optional additional measured power sensors for comparison. Cost remains explicitly derived from the primary sensor's integrated energy and the user's configured electricity rate.

No version labels CPU + GPU arithmetic as total PC power. V1 does not ship a synthetic combined-draw headline.

## Accuracy rules

- Only `power` sensors are accepted for power accounting.
- Units must be recognized as W, kW or mW before a reading is integrated.
- Zero watts is valid.
- Negative or unknown-unit readings are invalid.
- Energy uses trapezoidal integration over actual elapsed milliseconds.
- Irregular intervals are supported.
- Intervals over the continuity limit are dropped rather than filled with stale power.
- Sensor removal breaks continuity immediately.
- Restart persistence can retain accumulated totals, but the restart/offline gap is never integrated.
- Session average is energy divided by actually measured time, not an arithmetic average of samples.
- Peak is the maximum observed valid sample, not an inferred transient.
- Daily buckets split a valid interval at local midnight before assigning energy.
