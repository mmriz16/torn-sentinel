---
description: How to validate Torn API usage before implementation
---

# Torn API Validation Workflow

Before implementing ANY feature that uses Torn API, follow this checklist:

## Pre-Implementation Checklist

1. **Check endpoint exists in documentation**
   - Open `.agent/TORN_API_DOCUMENTATION.md`
   - Verify endpoint (user, faction, company, market, torn) exists
   - Verify selection exists for that endpoint

2. **Verify access level**
   - 🟢 Public — OK to use freely
   - 🟡 Minimal — OK for own user data
   - 🟠 Limited — Check if key has access
   - 🔴 Full — MUST verify permission, may fail

3. **Check API version**
   - `*` selections only work in v1
   - `**` selections only work in v2
   - `***` behave differently between versions

4. **Verify data fields exist**
   - Check the schema in `.agent/torn-api-schema.json`
   - Never assume fields exist — verify in documentation

5. **Check forbidden assumptions**
   - If data is in `forbiddenAssumptions` list → CANNOT use
   - Must use inference + disclaimer instead

## Error Handling

// turbo
When API returns error, check code in documentation:
```javascript
// Example error handling
if (error.code === 16) {
  // Access denied - key level too low
  // STOP - cannot proceed
}
if (error.code === 5) {
  // Rate limit - implement backoff
  await delay(60000);
}
```

## Inference Rules

When data is NOT available from API:

1. Use valid inference source from `validInferenceSources`
2. Label output with:
   - `confidence: "inferred"` or `confidence: "confirmed"`
   - `source: "api-log"` or `source: "estimate"`
3. Display disclaimer to user if using estimates

## Example: Gym Energy Per Click

❌ **WRONG**: Assume API provides energy cost per click
✅ **CORRECT**: Parse from log selection:
```javascript
// From log entry with log type 5300 (Gym train)
const energyPerClick = entry.data.energy_used / entry.data.trains;
// Label as confirmed since it's from actual log
confidence = "confirmed";
source = "api-log";
```

## Quick Reference Files

- `.agent/TORN_API_DOCUMENTATION.md` — Human readable docs
- `.agent/torn-api-schema.json` — Machine readable schema
