# Eight woodland abilities

Both wanderers choose a primary arm on the title screen: Spell Charm or Heartwood Crossbow. The eight woodland abilities still unlock the same way. Each run starts with all ranks at zero. A first selection unlocks an ability, and two more selections improve it to rank three. No extra in-run controls are needed.

## Primary arms

Either wanderer can take either arm. Both fire automatically at the nearest foe.

| Arm | Cadence | Damage | Unique shot |
| --- | --- | --- | --- |
| Spell Charm | 850 ms | 18 | Bouncing bolts once Ricochet Charm is taken |
| Heartwood Crossbow | 1150 ms | 28 | Quarrels already punch through one extra foe, keeping 80% damage |

Crossbow quarrels are faster and travel farther. Split Charm, Sharper Spell and Quicker Hex still apply; their cards read Honed Quarrels, Swift String and Twin Quarrels during a crossbow run. Ricochet Charm adds further pierce-throughs instead of bounces.

| Ability | Rank 1 | Rank 2 | Rank 3 |
| --- | --- | --- | --- |
| Ricochet Charm | One additional target | Two additional targets | Three additional targets |
| Firefly Orbit | Two fireflies | Three fireflies | Four fireflies |
| Bramble Snare | 35% slow for 2 seconds | 45% for 2.5 seconds | 55% for 3 seconds |
| Spore Trail | 6 damage per second | 9 damage per second | 12 damage per second |
| Acorn Shower | 24 damage, radius 60 | 32 damage, radius 75 | 40 damage, radius 90 |
| Barkskin Ward | 18-second recharge | 14-second recharge | 10-second recharge |
| Woodland Magnet | Every 10 seconds, range 450 | Every 8 seconds, range 600 | Every 6 seconds, range 750 |
| Mystery’s Double Pounce | Second hit deals 60% damage | 80% damage | 100% damage |

The complete values, names and card descriptions live in `src/game/config/abilities.ts`. The three-card selection reserves an eligible new ability or Mystery recruitment and an eligible rank increase before filling remaining slots. Rank-three abilities, already-recruited Mystery, unavailable Double Pounce, and ineffective Quicker Hex upgrades are excluded. Existing stat upgrades remain repeatable.

## Combat integration

- Spell bolts retain their original lifetime and damage scaling from Sharper Spell. Every bounce finds the nearest unhit living target within 220 pixels and retains 70% of the previous hit’s damage. Split Charm bolts have independent hit histories.
- Crossbow quarrels keep their original lifetime and Honed Quarrels damage. They continue in a straight line after each hit, retain 80% damage, and stop when extra pierce-throughs are spent. Native pierce is one extra foe; Ricochet Charm ranks add more. Twin Quarrels have independent hit histories.
- Fireflies complete their radius-72 orbit every three seconds, dealing 8 damage at most once per enemy every half second across the entire orbit.
- Roots cast every five seconds at a target within 420 pixels, cover radius 90, and slow only enemies currently inside. They do not create collision obstacles.
- Moving at least 24 pixels permits a mushroom patch every 0.75 seconds. Up to four radius-44 patches last three seconds each. Overlap uses the strongest patch, without multiplying damage. Half-second ticks include the final fraction of a patch’s lifetime.
- Acorns cast every four seconds at a target within 420 pixels. The visible 0.45-second warning stays at the original location, even if the target moves or dies.
- A newly acquired ward starts charged. Contact consumes it, grants 0.5 seconds of protection, and starts its recharge. Direct damage used by development review controls bypasses the ward.
- Magnet pulses tag existing nearby crystals; those crystals travel at 600 pixels per second until collected. XP is awarded through normal collection, with surplus XP processed one level-up choice at a time.
- Mystery’s upgrade requires recruitment and permits only one extra pounce per attack sequence. The extra target must be a different living enemy within 180 pixels of Mystery and the existing player-centered pounce range. A lost target causes the normal return; the second leap does not reset the attack cooldown.

All damage sources use the same defeat gate, and enemy destruction is deferred until the end of combat processing. Timers use gameplay time. Pausing, level-up selection, game over and the sprite debugger freeze simulation and presentation. Restart constructs fresh ranks, timers, hit histories and objects.

The renderer reuses its graphics and four firefly images, caps transient ability bursts at six, and keeps gameplay objects independent of visual-effect capacity. Reduced motion preserves attack trajectories, warning durations and damage while simplifying decorative flicker, falling motion and expanding rings. Existing character image files, enemy scaling and XP thresholds are unchanged.

## Development review

These routes and controls are development-only:

- `?review=abilities` starts with all eight abilities at rank three. Use `&rank=1` or `&rank=2` for other ranks.
- Add `&ability=ricochet-charm` (or any of the eight IDs in the configuration) to isolate an ability. Each supports all three ranks.
- `?review=ability-cards&rank=1` shows real unlock cards; ranks two and three show their corresponding offers. An `ability` parameter includes that requested ability among three real offers.
- Add `&character=hailey` for Hailey; Code Wizard is the default. Add `&weapon=crossbow` to start with the Heartwood Crossbow.
- Review buttons exercise movement trails, level-up selection, and death. Restart clears the review state and begins an ordinary run.
- `?review=ability-crowd` maintains 180 enemies with test-only high health and 220 pickups with every ability at rank three. Pickups replenish after magnet collection so the stress load does not disappear.
- `?review=ability-baseline` uses the same initial crowd with no abilities. F9 shows frame timing. The previous committed build can also be compared independently; the local archived fixture is ignored under `artifacts/`.

## Automated checks

Run `npm test` (or `node tests/run.cjs`). The existing TypeScript compiler builds the pure gameplay modules into ignored `artifacts/ability-tests`, then Node’s built-in test runner executes the checks. No new testing dependencies are required.

The suite covers three unique offers and category reservations across 3,500 simulated level-ups, all rank caps and descriptions, stale selections, Mystery gating, cooldown limits, queued XP, shield protection/recharge/pause, ricochet targeting and damage, single-award defeats, orbit hit intervals, slowing and expiry, spore movement/caps/overlap/frame-rate-independent lifetime damage, acorn targeting, magnet timing, chained pounce eligibility, and fresh-run state.

## Local verification — September 6, 2026

- All 20 automated checks, TypeScript checking and the production build passed. The existing Phaser bundle-size advisory remains. The deployment workflow now runs the checks before building.
- Tested Code Wizard with all eight maximum-rank abilities; tested Hailey’s keyboard and mouse selection, rank increases, live combat and Mystery’s final rank. An ordinary restarted run earned XP and offered new abilities and rank increases through natural combat.
- Paused screenshots taken separately were byte-for-byte identical. Tab reached the scrollable ability journal and Escape resumed gameplay. Restart reset health, XP, kills and acquired abilities while retaining Hailey.
- Upgrade cards fit at 800×600, 1280×720 and 1920×1080. The pause journal scrolls within its own region at small sizes, keeping the resume action visible.
- No browser errors or warnings appeared during the development combat and menu checks.
- Production preview ignored ability-review query parameters, started an ordinary run and kept F9 review controls disabled. No production browser errors were observed.
- Representative previews are saved locally under ignored `artifacts/screenshots/ability-upgrades.jpg`, `ability-gameplay.jpg` and `ability-journal.jpg`.

For performance, the previous committed build (`85c0754`) was archived into an isolated, ignored local fixture. Both versions ran at 1280×720 in the same Chrome session with 180 enemies given test-only high health. The previous version held 220 pickups; the new maximum-rank fixture replenished pickups to 220 after collection. Normal balance values were not changed.

| Build | Steady frame rate | Mean frame time | 95th percentile |
| --- | --- | --- | --- |
| Previous build, observed beyond 2 minutes | 60.0 FPS | 16.7 ms | 16.8 ms |
| Eight abilities, observed beyond 2:45 including movement trails | 60.0 FPS | 16.7 ms | 16.8 ms |

No sustained regression was observed on this machine. Initial samples after switching tabs were excluded. Reduced-motion behavior is separated from gameplay in code; the operating-system preference was not changed during this check.
