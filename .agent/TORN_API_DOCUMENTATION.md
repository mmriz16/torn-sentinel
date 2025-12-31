# Torn API Documentation Layer

> **CRITICAL**: AI tidak boleh menggunakan data yang tidak tersedia di dokumentasi ini.
> Jika data tidak ada → harus pakai inference + disclaimer.

---

## Quick Reference

### Access Level Colors
- 🟢 **Public** — Bebas akses
- 🟡 **Minimal** — Basic user data
- 🟠 **Limited** — Private-ish data  
- 🔴 **Full** — WAJIB cek permission

### API Version
- `*` — v1 only
- `**` — v2 only
- `***` — Different behavior v1/v2

---

## 1. User Endpoint

**URL**: `https://api.torn.com/user/{ID}?selections={SELECTIONS}&key={KEY}`

### Available Selections

| Selection | Access | Version | Description |
|-----------|--------|---------|-------------|
| ammo | 🟡 Minimal | both | Ammunition inventory |
| bars | 🟡 Minimal | both | Energy, nerve, happy, life bars |
| basic | 🟢 Public | both | Basic user info |
| battlestats | 🔴 Full | both | Battle statistics |
| bazaar | 🟢 Public | both | Bazaar listings |
| cooldowns | 🟡 Minimal | both | Drug/booster cooldowns |
| crimes | 🟡 Minimal | both | Current crimes data |
| discord | 🟡 Minimal | both | Discord ID |
| display | 🟡 Minimal | both | Display settings |
| education | 🟡 Minimal | both | Education progress |
| equipment | 🟡 Minimal | both | Equipped items |
| events | 🟡 Minimal | both | Recent events |
| gym | 🟢 Public | both | Active gym info |
| honors | 🟢 Public | both | Honors awarded |
| inventory | 🟡 Minimal | both | Item inventory |
| jobpoints | 🟡 Minimal | both | Job points |
| log | 🟠 Limited | both | Activity log entries |
| medals | 🟢 Public | both | Medals awarded |
| merits | 🟡 Minimal | both | Merits |
| messages | 🟡 Minimal | both | Messages |
| missions | 🟡 Minimal | both | Mission progress |
| money | 🟡 Minimal | both | Wallet/vault info |
| networth | 🟡 Minimal | both | Networth breakdown |
| newevents | 🟡 Minimal | both | New events count |
| newmessages | 🟡 Minimal | both | New messages count |
| notifications | 🟡 Minimal | both | Notifications |
| perks | 🟡 Minimal | both | Active perks |
| personalstats | 🟢 Public | both | Personal statistics |
| profile | 🟢 Public | both | Profile info |
| properties | 🟡 Minimal | both | Properties owned |
| refills | 🟡 Minimal | both | Refill status |
| reports | 🟡 Minimal | both | Reports |
| revives | 🟢 Public | both | Revive info |
| revivesfull | 🟡 Minimal | both | Full revive data |
| skills | 🟡 Minimal | both | Skills |
| stocks | 🟡 Minimal | both | Stock portfolio |
| travel | 🟡 Minimal | both | Travel status |
| weaponexp | 🟡 Minimal | both | Weapon experience |
| workstats | 🟡 Minimal | both | Work statistics |
| hof | 🟢 Public | v1* | Hall of Fame |
| competition | 🟢 Public | v2** | Competition data |
| faction | 🟢 Public | v2** | Faction membership |
| forumposts | 🟢 Public | v2** | Forum posts |
| forumthreads | 🟢 Public | v2** | Forum threads |
| job | 🟡 Minimal | v2** | Job info |
| timestamp | 🟢 Public | both | Server timestamp |

### Log Selection Data Structure

```json
{
  "log": {
    "{logId}": {
      "log": 5300,           // Log type ID
      "title": "Gym train strength",
      "timestamp": 1767110604,
      "category": "Gym",
      "data": {
        "trains": 10,
        "energy_used": 100,
        "strength_before": "2314.62",
        "strength_after": 2411.39,
        "strength_increased": 96.77,
        "happy_used": 49,
        "gym": 9
      }
    }
  }
}
```

### Known Log Categories & Types

| Category | Log ID | Title | Data Fields |
|----------|--------|-------|-------------|
| Gym | 5300 | Gym train {stat} | trains, energy_used, gym, {stat}_before, {stat}_after, happy_used |
| Travel | 6000 | Travel initiate | origin, destination, travel_method, duration |
| Travel | 4201 | Item abroad buy | item, quantity, cost_each, cost_total, area |
| Crimes | 5725 | Crime success item gain | crime, nerve, item_gained |
| Crimes | 5705 | Crime fail jail | crime, nerve, jail_time_increased |
| Item market | 1110 | Item market add | items[], price, anonymous |
| Item market | 1112 | Item market buy | items[], cost_total, seller |
| Item market | 1113 | Item market sell | items[], cost_total, fee, buyer |
| Hospital | 5400 | Hospital | time, reason |
| Attacking | 8151 | Attack leave receive | attacker, anonymous, hospital_time_increased |
| Jail | 5350 | Jail | time, reason |
| Jail | 5361 | Bust receive success | buster |
| Company | 6221 | Company employee pay | pay, job_points, working_stats_received |
| Missions | 7800 | Missions accept | type, agent, mission, difficulty |
| Merits | 5120 | Medal awarded | medal |
| Authentication | 101 | Successful login | ip_address |

---

## 2. Faction Endpoint

**URL**: `https://api.torn.com/faction/{ID}?selections={SELECTIONS}&key={KEY}`

### Available Selections

| Selection | Access | Description |
|-----------|--------|-------------|
| basic | 🟢 Public | Basic faction info |
| chain | 🟢 Public | Chain status |
| chains | 🟢 Public | Chain history |
| contributors | 🟢 Public | Contributors |
| lookup | 🟢 Public | Lookup |
| timestamp | 🟢 Public | Timestamp |
| attacks | 🟡 Minimal | Attacks |
| attacksfull | 🔴 Full | Full attack data |
| armor | 🔴 Full | Armory |
| boosters | 🔴 Full | Boosters |
| caches | 🔴 Full | Caches |
| cesium | 🔴 Full | Cesium |
| crimeexp | 🔴 Full | Crime exp |
| crimes | 🔴 Full | Crimes |
| drugs | 🔴 Full | Drugs |
| medical | 🔴 Full | Medical items |
| positions | 🔴 Full | Positions |
| revives | 🔴 Full | Revives |
| revivesfull | 🔴 Full | Full revive data |
| stats | 🔴 Full | Stats |
| temporary | 🔴 Full | Temporary items |
| upgrades | 🔴 Full | Upgrades |
| weapons | 🔴 Full | Weapons |

---

## 3. Company Endpoint

**URL**: `https://api.torn.com/company/{ID}?selections={SELECTIONS}&key={KEY}`

### Available Selections

| Selection | Access | Description |
|-----------|--------|-------------|
| companies | 🟢 Public | Company list |
| lookup | 🟢 Public | Lookup |
| profile | 🟢 Public | Profile |
| timestamp | 🟢 Public | Timestamp |
| applications | 🟠 Limited | Applications |
| detailed | 🟠 Limited | Detailed info |
| employees | 🟠 Limited | Employees |
| news | 🟠 Limited | News |
| stock | 🟠 Limited | Stock |

---

## 4. Market Endpoint

**URL**: `https://api.torn.com/market/{ID}?selections={SELECTIONS}&key={KEY}`

### Available Selections

| Selection | Access | Description |
|-----------|--------|-------------|
| bazaar | 🟢 Public | Bazaar listings |
| itemmarket | 🟢 Public | Item market |
| lookup | 🟢 Public | Item lookup |
| pointsmarket | 🟢 Public | Points market |
| properties | 🟢 Public | Property market |
| rentals | 🟢 Public | Rental properties |
| timestamp | 🟢 Public | Timestamp |

---

## 5. Torn Endpoint

**URL**: `https://api.torn.com/torn/{ID}?selections={SELECTIONS}&key={KEY}`

### Available Selections

| Selection | Access | Description |
|-----------|--------|-------------|
| attacklog | 🟢 Public | Attack log |
| bank | 🟢 Public | Bank rates |
| bounties | 🟢 Public | Active bounties |
| calendar | 🟢 Public | Calendar |
| cards | 🟢 Public | Card info |
| chainreport | 🟢 Public | Chain report |
| cityshops | 🟢 Public | City shops |
| companies | 🟢 Public | Company types |
| competition | 🟢 Public | Competition |
| crimes | 🟢 Public | Crime types |
| dirtybombs | 🟢 Public | Dirty bombs |
| education | 🟢 Public | Education courses |
| eliminationteam | 🟢 Public | Elimination |
| factiontree | 🟢 Public | Faction tree |
| gyms | 🟢 Public | Gym list |
| honors | 🟢 Public | Honors list |
| items | 🟢 Public | Item database |
| itemstats | 🟢 Public | Item stats |
| logcategories | 🟢 Public | Log categories |
| logtypes | 🟢 Public | Log types |
| lookup | 🟢 Public | Lookup |
| medals | 🟢 Public | Medals list |
| organisedcrimes | 🟢 Public | OC types |
| pawnshop | 🟢 Public | Pawnshop |
| pokertables | 🟢 Public | Poker tables |
| properties | 🟢 Public | Property types |
| rackets | 🟢 Public | Rackets |
| raids | 🟢 Public | Raids |
| rankedwars | 🟢 Public | Ranked wars |
| rockpaperscissors | 🟢 Public | RPS |
| searchforcash | 🟢 Public | Search for cash |
| shoplifting | 🟢 Public | Shoplifting |
| stats | 🟢 Public | Global stats |
| stocks | 🟢 Public | Stock market |
| territory | 🟢 Public | Territory |
| territorynames | 🟢 Public | Territory names |
| territorywarreport | 🟢 Public | TW report |
| territorywars | 🟢 Public | Territory wars |
| timestamp | 🟢 Public | Timestamp |

---

## 6. Error Codes

| Code | Name | Description | AI Action |
|------|------|-------------|-----------|
| 0 | Unknown error | Unhandled error | Log & retry |
| 1 | Key empty | API key empty | Stop - invalid config |
| 2 | Incorrect Key | Wrong key format | Stop - invalid config |
| 3 | Wrong type | Wrong basic type | Fix endpoint |
| 4 | Wrong fields | Wrong selection | Fix selection |
| 5 | Too many requests | Rate limit (100/min) | Backoff & retry |
| 6 | Incorrect ID | Wrong ID value | Fix ID |
| 7 | Private selection | Data is private | Can't access |
| 8 | IP block | IP banned | Wait |
| 9 | API disabled | API down | Wait |
| 10 | Key owner in fed jail | Owner jailed | Wait |
| 11 | Key change error | Can't change key (60s) | Wait |
| 12 | Key read error | Database error | Retry |
| 13 | Key inactive | Owner offline 7+ days | Can't use |
| 14 | Daily limit | Too many pulls today | Wait until reset |
| 15 | Temporary error | Testing code | Retry |
| 16 | Access denied | Key level too low | **STOP - can't access** |
| 17 | Backend error | Server error | Retry |
| 18 | Key paused | Owner paused key | Can't use |
| 19 | Crimes 2.0 | Must migrate crimes | Update code |
| 20 | Race not finished | Race still running | Wait |
| 21 | Wrong category | Invalid cat value | Fix parameter |
| 22 | v1 only | Selection only in v1 | Use v1 |
| 23 | v2 only | Selection only in v2 | Use v2 |
| 24 | Closed temporarily | Feature disabled | Wait |

---

## 7. FORBIDDEN ASSUMPTIONS

> ⚠️ **AI TIDAK BOLEH mengklaim data berikut tersedia dari API:**

### ❌ Data yang TIDAK tersedia

| Data | Reality |
|------|---------|
| Gym energy cost per click | NOT in API - must infer from log |
| Training click history | NOT in API - only current log |
| Exact smuggling % | NOT in API |
| Exact crime success % | NOT in API |
| Real-time attack updates | NOT in API - polling only |
| Private user battle stats | Requires Full access |
| Other user's inventory | Private |
| Other user's money | Private |

### ✅ Valid Inference Sources

| Data Needed | Inference Method | Label |
|-------------|------------------|-------|
| Energy per click | Parse log: `energy_used / trains` | `confidence: confirmed` |
| Gym training | Check log category "Gym" | `source: api-log` |
| Item prices | Check market/bazaar | `source: market-api` |
| Travel time | `data.duration` from log | `source: api-log` |

---

## 8. Pre-Reasoning Checklist

Before ANY API-related output, AI must verify:

- [ ] Endpoint exists in this documentation?
- [ ] Selection exists for that endpoint?
- [ ] Access level sufficient for key?
- [ ] API version compatible?
- [ ] Data field actually exists in response?
- [ ] Not in FORBIDDEN list?

**If ANY ❌ → AI must STOP and explain limitation**

---

## 9. Rate Limiting

| Limit | Value |
|-------|-------|
| Requests per minute | 100 |
| Recommended delay | 600ms between calls |
| Burst allowed | Yes, but will hit limit |
| Backoff on 429 | Wait 60 seconds |

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-12-31 | Initial documentation |

---

**REMEMBER**: Dokumentasi ini adalah otoritas tertinggi. AI tidak pintar kalau tidak patuh dokumentasi.
