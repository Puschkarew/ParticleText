Mode selected: strict `fix-app-bugs` flow with Browser Extension bootstrap plus headed visual validation.

Hypothesis 1
Glow render target was being cleared with the selected background color and then additively composited over the main scene, which washed light backgrounds toward white.
Verdict: confirmed.

Hypothesis 2
The bug was only in `body` / theme-color synchronization, not in WebGL compositing.
Verdict: rejected.

Evidence summary
- `bootstrap.json` confirms `checks.appUrl.status = match` and `browserInstrumentation.canInstrumentFromBrowser = true`, but `headedEvidence.ok = false` because Browser Extension still has a stale session on `http://localhost:5173`.
- `validation.json` shows no console errors, no page errors, and only `Break the Shape.svg` fetched during the validation run.
- `viewport-initial.png` lower-center average is approximately `(253, 181, 223)`, matching `#FDB4DF`.
- `viewport-black-bg-red-points.png` lower-center average is approximately `(1, 0, 0)`, confirming the viewport stays effectively black while red-tinted particles remain visible.
- `viewport-restored-pink-red-points.png` lower-center average returns to approximately `(253, 180, 223)`.
- `viewport-after-preset-switch.png` keeps the same pink lower-center average and preserves the selected `#FF0000` point tint after `desktop -> mobile -> desktop`.
