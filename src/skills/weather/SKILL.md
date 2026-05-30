---
name: weather
description: Get current weather or a forecast for any city. Use when the user asks about weather, temperature, rain, wind, or forecast. No API key needed.
---

# Weather

Use the bash tool with curl and wttr.in (no API key required). Use + for spaces in city names (e.g. New+York).

## Current conditions (one line)
curl -s "https://wttr.in/London?format=3"

## Detailed current
curl -s "https://wttr.in/London?format=%l:+%c+%t+(feels+%f),+wind+%w,+humidity+%h"

## Compact forecast
curl -s "https://wttr.in/London?0&T"

Report the result in plain language. If curl returns nothing, the city may be misspelled — ask the user to confirm.