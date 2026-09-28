# Bosses and pacing

This rebalance makes boss fights last and keeps the late game dangerous without being unfair. It supersedes the numbers in `oven-boss.md` and `boss-relics.md`. All tuning lives in `src/game/config/` (`balance.ts`, `ovenBoss.ts`, `stagBoss.ts`, `kingBoss.ts`).

## Every boss

- Health scales with the run clock (`health + healthPerMinute × minutes`, see `scaledBossHealth`). The Oven starts at 6,500 (+150/min), Wonky at 15,000 (+300/min) and King Rumbles at 30,000 (+450/min). The old values (1,200 and 2,600) died in about 5 seconds, before either boss finished its first attack.
- Bosses deal their own contact damage (22–26) instead of a squirrel's 8.
- Knockback, pulls, crowd shoving and roots do not move a boss, and slows never take them below 70% speed (`BALANCE.boss.slowFloor`).
- Each boss calls in reinforcements at set health thresholds, so crowd-clearing builds still matter in the arena.

## Oven (level 10)

Rotates **toss** (three tacos) → **ring** (five tacos around the player) → **flame cone** (a 1.1s telegraphed wedge from the door: step behind him). Line cooks (red squirrels) rush in at 66% and 33% health. Below half health he runs hot: two staggered rings 0.4s apart (stand in a gap, then move to the next), salsa that lasts 4s and burns for 7, and shorter breaks. Each ring can hit once.

## Wonky (level 15)

A lopsided summer whitetail in velvet: three points on his left antler, five on his right. The sprite sheet has drawn left-facing rows (`scripts/build_stag.py`), so the antlers never swap sides.

Each time he finishes stalking he uses the next attack in `STAG.attackOrder`: **charge → velvet volley → charge → bellow**, round and round. His windups, rests and recoveries are all shorter than before.

- **Charge:** a locked, telegraphed lane. Ramming a **tree** stuns him for 2.2s, and he takes 25% more damage while stunned. The arena edge only ends a charge.
- **Velvet volley:** he shakes his head (a fan telegraph), then flings 5 antler shards along the locked aim (10 damage each). Standing still at range is no longer safe.
- **Bellow:** he rears up with a ring telegraph (360px). A player inside is slowed to half speed for 2.5s, and he charges straight after.
- **Antler sweep:** staying within about 150px for 1.5s earns a telegraphed sweep across the half circle in front of him (22 damage, big knockback).
- **Enraged (below 50%):** double charges, and the second one leads a moving player. Every other fresh charge is a **feint**: the lane turns orange and swings to your new spot after a short pause, with a full windup still to come.
- **Rut (below 30%):** he is tinted red and frenzied, with triple charges, quicker windups and recoveries, faster charges and stalking, an 8-shard volley, and 1.6s stuns.
- He calls the herd (two stampede lanes) at 50% and 25%.

## King Frankie (level 25)

A great buzzard in a little gold crown, in pixel art seen from above as he soars (`scripts/build_buzzard.py` draws him, the buzzard enemies and Sheldon's Frankie). He turns to face where he flies, his shadow falls well below him to show his height, and he flies over scenery.

- **Circling:** he orbits the player on a flattened ellipse, so he stays on screen. In the air he takes **half damage** and cannot body-check.
- He cycles **dive → feather volley → dive → gust**.
- **Dive:** a shadow lane is locked through the player (stopping short of the arena edge), then he dives down it. Each dive can hit once (28 damage, knockback). Afterwards he **lands** for 1.7s and takes **+30% damage**: the window to strike.
- **Feather volley:** a fan of 7 feathers along a locked aim, 9 damage each.
- **Gust:** a wing-beat cone (400px) that hurls a player caught inside it (10 damage, big knockback).
- **Enraged (below 40%):** two dives back to back, quicker windups, an 11-feather volley, shorter circling and shorter landings.

### Buzzard enemies (after King Frankie)

From level 25, one spawn in five is a buzzard. Normal spawns pause during the boss fight and the gate holds the run at 25 until he falls, so they arrive right after him. They fly straight at the player over scenery (`core/BuzzardFlight.ts`). When close and ready, one hovers with wings raised for about half a second (the tell), then swoops along the line it locked (20 damage instead of 14). It climbs away, then comes round again after a cooldown. 110 health, worth 26 crystals, and they can be elites. `?review=buzzard` has a **Send buzzards** button.

## King Rumbles (level 30): the final boss

A crowned armadillo. He curls up with his first lane and a faint first ricochet shown, then rolls, bouncing off the arena wall 2 times (3 enraged). He can hit once per leg. **Every wall (or tree) he strikes sends out a ground ripple**: an expanding ring (430px/s, 18 damage and a shove) that hurts everywhere it passes except the lane he just rolled in along, which glows green while the ripple travels. Step into his trail to let it pass. When the roll ends he is **dizzy** (+20% damage taken) and sprays a ring of shell shards. His royal guard of armadillos arrives at 66% and 33%. Defeating him wins the run: a victory screen offers to keep wandering (endless) or head home. With four bosses, a run earns four relic picks, so rank 3 of a relic is reachable.

## Between bosses

- **Speed** rises 6/min but is capped at +40% of each creature's base, so nothing outruns the base player. **Contact damage** rises 4%/min instead.
- **Crystals by creature:** squirrel 8, grey 10, fawn 8, doe 14, buck 30, armadillo 35. Bigger crystals look bigger.
- From level 10, 30% of spawns are still squirrels.
- From minute 6 each spawn tick brings 2 creatures, and 3 from minute 10.
- **Set pieces:** an elite every 75s from 2:30 (5× health, gold, drops a chest, 5× crystals); an encircling ring every 90s from 3:00; a telegraphed stampede every 90s from 3:45 (two lanes from minute 10). Their clock pauses during boss fights.

## Upgrades

- Split Charm / Twin Quarrels can be picked at most 4 times (it multiplies with Ricochet splits).
- Acorn Shower's awakening is now 120 damage (was 200), and 260 at ascension (was 480).

## Review pages (dev only)

`?review=oven`, `?review=stag`, `?review=buzzard`, `?review=king` (reach the boss level, walk, defeat, end run) and `?review=events` (buttons for an elite, a ring, and one or two stampedes).
