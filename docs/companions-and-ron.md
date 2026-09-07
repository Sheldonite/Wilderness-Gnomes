# Bound companions, and Ron the Festive Bard

## Companions belong to a wanderer

A companion is no longer something you find in an upgrade card. Each wanderer travels with
exactly one, from the first step of every run:

| Wanderer | Companion | What it does |
|---|---|---|
| Nick (wizard) | Mystery | Pounces on whatever comes near |
| Hailey | Midnight | Swats a whole arc of foes flat |
| Sheldon | Frankie | Circles overhead and stoops on the unwary |
| Ron | Tobias | A bluefin tuna who swims through the air and torpedoes trouble |

The binding lives in `COMPANION_BY_CHARACTER` in `src/game/config/companions.ts`, and each
character definition carries its own `companionId`.

### They grow on their own

Companions gain a rank every three player levels, to a maximum of rank 10 at level 30. Nothing
is chosen: the rank is recomputed from the level, so skipped levels, boss jumps and dev review
pages all stay consistent. Each rank adds 15% to the companion's power.

- **Mystery** hits harder, recovers faster and reaches a little further.
- **Midnight** hits harder.
- **Frankie** gains a buzzard every second rank, one at rank 0 up to five at rank 8.
- **Tobias** hits harder and darts more often.

The level-up panel announces each growth once, and the companion panel on the left of the HUD
always shows the current rank and the level the next one arrives at.

The two abilities that command a companion, Mystery's Double Pounce and Midnight's Mighty
Swat, are now gated on the wanderer rather than on owning the companion. They mean the same
thing, because only Nick has Mystery and only Hailey has Midnight.

## Ron, the Festive Bard

A travelling performer with a ribbon staff. He is unlocked at the Staffing Company for 50 gold
and plays with either weapon, like the others.

Ron is the only wanderer who can learn these three, and he cannot learn anyone else's:

- **Ribbon Sweep** — a wide arc toward the nearest foe, damaging and throwing them back.
  Awakens into **Ribbon Cyclone**, a full circle with a trailing echo, and ascends to
  **Aurora Sweep**.
- **Inspiring Shout** — a rally that raises his attack and movement speed for a few seconds.
  Awakens into **Rally Anthem**, which also blasts nearby foes on the opening note and mends
  him while it lasts, and ascends to **Grand Finale**.
- **Dizzying Flurry** — a staff spin that beats on everything close by. Awakens into
  **Dizzying Vortex**, which drags foes inward and slows them, and ascends to
  **Carnival Maelstrom**.

The gating list is `CHARACTER_ONLY_ABILITIES` in `src/game/config/abilities.ts`. Adding a
wanderer-specific ability is a matter of adding one entry there.

### Tobias

Tobias cruises a slow figure of eight beside Ron, bobbing as he goes, then torpedoes the
nearest foe within 300 pixels and drifts back. Because he swims through air rather than water,
he trails curls of stirred air instead of bubbles, and his shadow stays on the ground while his
body rides above it. The behaviour is in `src/game/core/TobiasSwim.ts` with no Phaser in it, so
it is testable; `src/game/entities/TobiasCompanion.ts` only draws it.

## Art

Both sheets are generated, in the same way as the deer and the armadillo:

```bash
python scripts/build_ron_bard.py
python scripts/build_tobias_tuna.py
```

Ron's sheet matches the Code Wizard layout exactly: 8 columns by 8 rows of 192px cells, with
row 0 the idle and rows 1 to 7 eight-frame stride cycles. Tobias is 6 by 2 cells of 192px, row
0 the cruising swim and row 1 the dart.

## Dev review pages

- `?review=ron` drops Ron into a ring of tough foes with all three skills at rank 5. Add
  `&rank=10` to see the ascensions. Tobias comes along, since he is bound to Ron.
- `?review=frankie` and `?review=companions` still work for the other companions.

## Tests

`tests/companions.test.cjs` covers the binding, the every-three-levels growth, the flock size
curve and Tobias's hunt. `tests/ron.test.cjs` covers the ability gating and each of the three
skills, base and awakened.
