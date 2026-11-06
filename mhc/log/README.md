# MHC weekly log

Written by the weekly logger, read by the monthly Market Health Check. One file per month: `YYYY-MM.json`.

```json
{
  "month": "2026-11",
  "days":  [{"date":"2026-11-02","sp500":7695,"y10":5.12,"y30":5.61,"bill13":4.08,"vix":19.2,"hy":331,"brent":104.5,"btc":86100}],
  "notes": [{"date":"2026-11-04","text":"≤20 words, factual, with the market reaction","swan":"optional long-shot risk it relates to","source":"https://…"}],
  "flags": [{"date":"2026-11-04","text":"Tripwire: VIX closed above 30 (31.4)"}],
  "runs":  ["2026-11-07"]
}
```

Units: index points, yields in %, `hy` in basis points, Brent and BTC in USD. `null` where a value could not be sourced; never estimated.
