# MHC weekly log

Written by the weekly logger, read by the monthly Market Health Check. One file per month: `YYYY-MM.json`.

```json
{
  "month": "2026-11",
  "days":  [{"date":"2026-11-02","sp500":7695,"y10":5.12,"y30":5.61,"bill13":4.08,"vix":19.2,"hy":331,"brent":104.5,"btc":86100}],
  "notes": [{"date":"2026-11-04","text":"≤20 words, factual, with the market reaction","swan":"optional long-shot risk it relates to","source":"https://…"}],
  "flags": [{"date":"2026-11-04","level":"attention","text":"Stress line: VIX closed above 30 (31.4)"}],
  "status": [{"date":"2026-11-21","state":"on-track | watch | attention","text":"the Saturday message, verbatim"}],
  "runs":  ["2026-11-07"]
}
```

Units: index points, yields in %, `hy` in basis points, Brent and BTC in USD. `null` where a value could not be sourced; never estimated.

`flags.level` is `watch` (close to a plan line) or `attention` (a plan line crossed). The plan lines are the monthly report's triggers; `status` keeps one entry per weekly run.
