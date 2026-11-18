# Bosses and pacing

This rebalance makes boss fights last and keeps the late game dangerous without being unfair. It supersedes the numbers in `oven-boss.md` and `boss-relics.md`. All tuning lives in `src/game/config/` (`balance.ts`, `ovenBoss.ts`, `stagBoss.ts`, `kingBoss.ts`).

## Every boss

- The Squirrel Chief starts the sequence after 60 seconds of active play. Defeat starts a fresh 60-second countdown for the next boss. Pauses and upgrade screens stop the countdown. Encore bosses use the same interval.
- Health scales with the run clock (`health + healthPerMinute x minutes`, see `scaledBossHealth`). The Oven starts at 3,800 (+80/min), Wonky at 15,000 (+300/min), and King Rumbles at 30,000 (+450/min).
- Bosses deal their own contact damage.
- Knockback, pulls, crowd shoving and roots do not move a boss, and slows never take them below 70% speed (`BALANCE.boss.slowFloor`).
- Bosses arrive in the open woods. Existing enemies stay, regular waves continue, and the compass points to a living boss offscreen. XP, level-ups, and chest upgrades work during the fight.

## Oven

Rotates **toss** (three tacos) → **ring** (five tacos around the player) → **flame cone** (a 1.1s telegraphed wedge from the door: step behind him). Line cooks (red squirrels) rush in at 66% and 33% health. Below half health he runs hot: two staggered rings 0.4s apart (stand in a gap, then move to the next), salsa that lasts 4s and burns for 7, and shorter breaks. Each ring can hit once.

## Wonky

A lopsided summer whitetail in velvet: three points on his left antler, five on his right. The sprite sheet has drawn left-facing rows (`scripts/build_stag.py`), so the antlers never swap sides.

Each time he finishes stalking he uses the next attack in `STAG.attackOrder`: **charge → velvet volley → charge → bellow**, round and round. His windups, rests and recoveries are all shorter than before.

- **Charge:** a locked, telegraphed lane ending in a stomp. After the final charge in a burst, he takes 25% more damage for 1.1 seconds.
- **Velvet volley:** he shakes his head (a fan telegraph), then flings 5 antler shards along the locked aim (10 damage each). Standing still at range is no longer safe.
- **Bellow:** he rears up with a ring telegraph (360px). A player inside is slowed to half speed for 2.5s, and he charges straight after.
- **Antler sweep:** staying within about 150px for 1.5s earns a telegraphed sweep across the half circle in front of him (22 damage, big knockback).
- **Enraged (below 50%):** double charges, and the second one leads a moving player. Every other fresh charge is a **feint**: the lane turns orange and swings to your new spot after a short pause, with a full windup still to come.
- **Rut (below 30%):** he becomes frenzied, with triple charges, quicker windups, an eight-shard volley, and a 0.65-second vulnerability window.
- He calls the herd (two stampede lanes) at 50% and 25%.

## King Frankie

A great buzzard in a little gold crown, in pixel art seen from above as he soars (`scripts/build_buzzard.py` draws him, the buzzard enemies and Sheldon's Frankie). He turns to face where he flies, his shadow falls well below him to show his height, and he flies over scenery.

- **Circling:** he orbits the player on a flattened ellipse, so he stays on screen. In the air he takes **half damage** and cannot body-check.
- He cycles **dive → feather volley → dive → gust**.
- **Dive:** a fixed-length shadow lane locks through the player, then he dives down it. Each dive can hit once (28 damage and knockback). He lands afterward and takes **+30% damage** for 1.7 seconds.
- **Feather volley:** a fan of 7 feathers along a locked aim, 9 damage each.
- **Gust:** a wing-beat cone (400px) that hurls a player caught inside it (10 damage, big knockback).
- **Enraged (below 40%):** two dives back to back, quicker windups, an 11-feather volley, shorter circling and shorter landings.

### Buzzard enemies (level 25 onward)

From level 25, one spawn in five is a buzzard. They fly straight at the player over scenery (`core/BuzzardFlight.ts`). When close and ready, one hovers with wings raised for about half a second (the tell), then swoops along the line it locked (20 damage instead of 14). It climbs away, then comes round again after a cooldown. 110 health, worth 26 crystals, and they can be elites. `?review=buzzard` has a **Send buzzards** button.

## King Rumbles, the final story boss

A crowned armadillo. He curls up and rolls along three telegraphed lanes, or four when enraged. At each endpoint he digs in to turn and sends out a ground ripple (430px/s, 18 damage and a shove). The lane he just rolled along stays safe while that ripple travels. After the final roll he is **dizzy** (+20% damage taken) and sprays a ring of shell shards. His royal guard arrives at 66% and 33% health. Defeating him wins the run and offers the choice to keep wandering in endless mode or head home.

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

`?review=oven`, `?review=stag`, `?review=buzzard`, and `?review=king` preview individual fights. `?review=boss-rewards` lets you spawn the next boss, grant a level during the fight, defeat the boss, and collect the relic. `?review=events` previews elites, rings, and stampedes.
