# Solid scenery and resting cats

Trees block movement around their trunks and rocks around their ground footprints. The river and ponds are impassable; the existing timber bridge remains a crossing. Flowers, ferns, and small mushrooms remain walkable ground cover. Canopies still fade when they hide actors.

Player movement slides along solid edges. Enemies and both companions share navigation around obstacles, including bridge routes. Spawn/follow positions resolve onto nearby clear ground. Enemy separation also respects scenery. Mystery cannot pounce through a solid object, and neither cat can land a melee hit through one.

Mystery uses her original seated frame when her position stops changing. Midnight uses the seated ready pose from her existing swat artwork. Walking resumes with actual movement; swat and pounce animations retain their combat behavior. No artwork was regenerated.

Navigation uses a spatial footprint index and bounded shared destination fields, rebuilt on restart. Tests cover swept collision, sliding, detours, water, bridge crossings at cat/enemy clearances, safe placement, and Midnight settling. All 34 tests, TypeScript, and the production build pass. A synthetic 180-enemy navigation check over 120 frames averaged 3.10 ms per frame on this machine; this measures navigation only, not full rendered frame rate.

Development review: `?review=cats-rest` recruits both cats without enemies. The Walk trail button exercises walking and settling; End run checks restart. Inspected both seated poses and walking-to-sitting transitions in Chrome, verified a clean restart, and found no browser errors or warnings. Screenshot: `artifacts/screenshots/cats-sitting.jpg`.
