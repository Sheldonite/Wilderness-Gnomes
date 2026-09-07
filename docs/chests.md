# Treasure chests

Each level, including level 1, gets one independent 40% chest roll: an average of two chests per five levels. Individual five-level stretches can have more or fewer. Skipped levels receive their rolls, and staying on a level never rerolls it.

Chests appear 120–260 pixels from the player on dry, reachable ground, at least 70 pixels apart. Failed placements stay pending and retry every half-second. Unopened chests remain on the map until collected or the run ends. Gold rings, sparkles and a “FREE UPGRADE” label distinguish them from XP crystals; reduced-motion mode keeps the glow still.

Approaching within 38 pixels opens three normal upgrade choices and pauses the run. Selecting one grants an extra upgrade without changing the player's level, XP, or XP threshold. Normal rank limits, companion requirements and the level-10 awakening gate still apply. Chests cannot be collected while paused, choosing another upgrade, or after death; queued XP level-ups finish first.

Development preview: `?review=chests` guarantees one chest and provides controls to collect it and trigger a normal level-up. The preview is disabled in production. Automated tests cover spawn frequency, placement, blocked-ground retries, single-use collection, pause behavior, XP preservation, queued level-ups, gates and fresh-run state. Browser verification confirmed the visible chest, health upgrade from 100 to 120 at level 1 with 0 XP, and the subsequent normal level-2 selection.
