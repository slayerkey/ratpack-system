# PC Power Meter Pro Measurement Contract

The primary iCUE power sensor is the only source for authoritative energy accounting.

Current watts, session energy, session average, observed peak, daily energy, estimated electricity cost, and archived session statistics all inherit the scope of that primary sensor.

Additional Pro sensors are comparisons only. They receive separate graph traces and live readings and are never added to the primary sensor or to one another to manufacture whole-PC draw.

`total-power-draw` is labeled total power draw only when supplied as that sensor kind by iCUE. `power-in`, `power-out`, and CPU `package` remain explicitly scoped. GPU wording is used only as a descriptive label for an iCUE power sensor whose device/name metadata identifies it as GPU related.

Energy integrates valid consecutive readings over their actual elapsed time with trapezoidal integration. Gaps beyond the continuity limit, disconnects, unavailable readings, restarts, and invalid units are not estimated.
