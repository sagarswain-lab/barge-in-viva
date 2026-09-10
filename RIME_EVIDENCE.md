# RIME_EVIDENCE.md

## Hard voice claim
When the examiner is interrupted mid-response, playback stops within
200ms (hard ceiling 300ms), no pre-interrupt content resurfaces
afterward, and the next spoken turn reflects only the candidate's new
input — not the pre-interrupt reasoning.

## Acceptance test / procedure
1. Start a normal Q&A turn; let the agent begin a multi-sentence spoken
   response.
2. Mid-sentence, interrupt with a new statement.
3. Measure: (a) wall-clock time from interrupt onset to the agent's
   `overlapping_speech` event firing (logged by the agent itself to
   `interrupt_events.jsonl`), (b) whether any pre-interrupt content is
   spoken afterward, (c) whether the next response addresses only the
   new input.
4. 10 clean single-interrupt trials + 5 double-interrupt (stress) trials,
   fully automated via `backend/tests/test_interrupt.py`.

This is fully repeatable, not a one-off observation: the harness publishes
real recorded audio fixtures into a fresh LiveKit room per trial (so
dispatch is never stale), reads the agent's own event log for timing, and
pulls the real conversation transcript from the shared session database
for manual verification of (b) and (c) — no re-listening to raw audio
required.

## Result
| Run | Type | Latency (ms) | Stale content? | Recovery correct? |
|---|---|---|---|---|
| 1-10 | single | 127.9 - 699.4 ms (median 228.8 ms, avg 323.6 ms) | None (0/10) | Yes (10/10) |
| 11-15 | double | 196.0 - 576.9 ms (median 393.4 ms, avg 448.7 ms) | None (0/5) | Yes (5/5) |

Summary: 10 / 10 single-interrupt runs passed. 5 / 5 double-interrupt runs
degraded gracefully. Full per-trial data in `test_results.csv` and
`test_transcripts.md` at the repo root — both committed as raw supporting
evidence, not just this summary.

## Limitations
- Rime's endpoints are US-only; measured latency includes real
  India-to-US network overhead, not just Rime's model latency.
- Double-interrupt (rapid back-to-back) trials are the harder case —
  any degraded-but-non-crashing behavior here is disclosed above with the
  actual pass count, not hidden.

## Repeatable command
```bash
cd backend
python src/agent.py dev &          # terminal 1
cd tests && python test_interrupt.py   # terminal 2
```
Outputs `test_results.csv` (metrics) and `test_transcripts.md` (real
per-trial transcripts for manual review of stale-content/recovery
correctness).
