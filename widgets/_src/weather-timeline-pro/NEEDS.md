# Weather Timeline Pro Data / Runtime Notes

## Provider decision

The shipping runtime does **not** call Open-Meteo's public no-key endpoint because its current hosted free service is non-commercial only.

Provider order:

1. If the real iCUE host exposes `window.openMeteoApiKey`, use Open-Meteo's commercial `customer-` endpoints.
2. Otherwise, if the user supplies a WeatherAPI.com key in widget settings, call WeatherAPI directly. The key is not copied to localStorage or sent to PackRat.
3. If neither path is available, keep any cached forecast visible as stale. With no cache, show setup guidance.

The official CORSAIR Air Quality sample proves current iCUE weather examples use Open-Meteo and an iCUE-provided IP Registry key for automatic location, but the public iCUE builder contract does not currently document `openMeteoApiKey`. This is why the user-key fallback remains explicit rather than assuming a private host global will exist on every Marketplace install.

## Location

A location may be a city/postal search string or `latitude,longitude`. Pro stores up to three location strings as normal iCUE widget properties and cycles configured locations from the location header. A blank primary location uses automatic IP location only when the active provider/runtime supports it.

## Cache

Only normalized forecast data and its successful update timestamp are cached in per-widget-instance localStorage. Provider keys are never written by product code.
