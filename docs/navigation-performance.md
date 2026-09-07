# Scenery movement performance fix

Actors were checking a complete line of travel and selecting a navigation waypoint every frame. First-time detours also built a 10,000-cell connectivity grid during play. Each actor now retains a small route and replans after movement, a target change, or a blocked step. Routes use staggered travel budgets. Every movement step still uses the same swept collision resolution, including enemy separation. Restart discards actor routes.

Arena setup prepares the three navigation clearances before play begins. Connectivity edges reuse their reverse edge, spatial buckets use numeric keys, and inexpensive bounds checks skip distant water calculations. Destination fields remain bounded to 16 entries. No scenery was removed or made passable.

## Same-machine comparison

`node scripts/benchmark-navigation.cjs artifacts/navigation-performance/before.cjs` compares the saved original compiled module with the revised module. Run `node tests/run.cjs` first to compile the current code. Five trials each use the same 100 obstacles, 180 enemies, moving player target, and 240 frames. Reported values are medians across trials; these measure navigation CPU work, not total rendering time.

| Navigation time | Before | After |
| --- | ---: | ---: |
| Mean per frame | 3.094 ms | 0.108 ms |
| 95th percentile | 6.214 ms | 0.432 ms |
| Maximum frame | 18.975 ms | 1.491 ms |

The revised grid setup took 4.30 ms before simulation. Average navigation cost fell about 96.5%. A separate comparison of 244,036 sampled positions and actor radii found identical scenery collision results.

All 43 automated tests pass, including cached detours, moving targets, bridge crossings, river bends, and route reuse. Chrome's crowded review reported 60.0 FPS with 180 enemies and 220 pickups after the fix.
