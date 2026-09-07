# Mandatory bosses and relic abilities

The Taco Toaster at level 10 and Hollowcrown at level 15 now lock the player into a 520-pixel-radius arena. Existing regular enemies and their acorns clear without granting kills or XP. Regular spawning and ordinary chest collection stop until the boss dies. Player movement, knockback, and boss movement stay inside the ring. A stag charge that meets the ring ends in its normal blocked-charge stomp.

XP can still be collected during the fight, but it banks without advancing beyond the boss level. Queued level-ups cannot skip either boss. Bosses must be fought in order, even if a development fixture skips levels. Defeat removes the ring and resumes regular spawning. Existing XP rewards remain intact.

Each boss drops one purple-and-gold crowned chest on nearby dry land. Open it to select one of three exclusive abilities, or improve an owned ability. Boss chests are additional rewards and do not count toward the ordinary 40% chest chance per level. Each chest grants exactly one choice. Neither normal level-up offers nor ordinary chests can unlock or rank up relic abilities.

| Relic | Rank 1 | Rank 2 | Rank 3 |
| --- | --- | --- | --- |
| Crownfire | 120 damage, 210px fire ring | 240 damage, 240px ring | 360 damage, 270px ring |
| Stormcall | 80 damage to 3 targets | 160 damage to 5 targets | 240 damage to 7 targets |
| Phoenix Heart | Heal 8, pulse for 60 damage | Heal 16, pulse for 120 damage | Heal 24, pulse for 180 damage |

Crownfire casts every 4 seconds when an enemy is in reach. Stormcall casts every 3.5 seconds, chaining between distinct living targets within 420 pixels of the previous point. Phoenix Heart casts every 10 seconds when health is missing or an enemy is nearby; healing cannot exceed maximum health. All powers fire automatically, use the shared defeat gate, and pause their clocks with the run. Their ranks reset on restart. There are currently two bosses per run, so a run earns two relic selections; the third rank is supported for future encounters.

Development checks: `?review=boss-rewards` exercises normal boss-level selection, crowd clearing, banked XP, escape attempts, defeat, chest pickup and relic upgrades. `?review=boss-powers` previews all three effects against durable foes. Both fixtures are development-only. Automated checks cover the two XP gates, arena constraints, single chest rewards, exclusive offers, stale/repeated selections, rank caps, damage, healing, cooldowns, and pause/reset behavior. In-game checks confirmed zero regular foes during both encounters, the 502px player boundary, one chest per boss, resumed spawning after victory, and Stormcall upgrading from rank 1 to 2 through the two boss chests.
