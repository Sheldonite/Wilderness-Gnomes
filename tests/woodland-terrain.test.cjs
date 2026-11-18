const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WOODLAND_CHUNK_SIZE, WOODLAND_START, WoodlandTerrain, woodlandChunkWindow, woodlandPathY, woodlandStreamX
} = require('../artifacts/ability-tests/game/core/WoodlandTerrain.js');

test('world coordinates and run seed determine the same chunks in any visit order', () => {
  const firstRun = new WoodlandTerrain('first run');
  const replay = new WoodlandTerrain('first run');
  const otherRun = new WoodlandTerrain('another run');
  const coordinates = [[1, 1], [12, -9], [-52, 80], [270, 470]];
  const expected = coordinates.map(([x, y]) => firstRun.chunk(x, y));
  for (let i = coordinates.length - 1; i >= 0; i--) {
    const [x, y] = coordinates[i];
    assert.deepEqual(replay.chunk(x, y), expected[i]);
    assert.notDeepEqual(otherRun.chunk(x, y).plants, expected[i].plants);
  }
});

test('near and distant view windows retain only a local set of chunks, including negative coordinates', () => {
  const size = WOODLAND_CHUNK_SIZE;
  assert.deepEqual(woodlandChunkWindow({ left: -size, right: 0, top: -2 * size, bottom: -size }, 0),
    { left: -1, right: -1, top: -2, bottom: -2 });
  const width = 1280, height = 720;
  for (const offset of [-100_000 * size, 0, 100_000 * size]) {
    const chunks = woodlandChunkWindow({ left: offset - 210, top: offset - 460,
      right: offset - 210 + width, bottom: offset - 460 + height });
    assert.ok((chunks.right - chunks.left + 1) * (chunks.bottom - chunks.top + 1) <= 9);
  }
});

test('trail and stream features join neighboring chunks and plants have one owner', () => {
  const terrain = new WoodlandTerrain('seams');
  const paths = [terrain.chunk(-1, 1), terrain.chunk(0, 1)].map(chunk => chunk.paths.find(path => path.index === 0));
  const streams = [terrain.chunk(2, -1), terrain.chunk(2, 0)].map(chunk => chunk.streams.find(stream => stream.index === 0));
  assert.ok(paths.every(Boolean) && streams.every(Boolean));
  assert.equal(woodlandPathY(paths[0], 0), woodlandPathY(paths[1], 0));
  assert.equal(woodlandStreamX(streams[0], 0), woodlandStreamX(streams[1], 0));

  const plants = new Set();
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) {
    const { bounds, plants: ownedPlants } = terrain.chunk(x, y);
    for (const plant of ownedPlants) {
      assert.ok(plant.x >= bounds.left && plant.x < bounds.right && plant.y >= bounds.top && plant.y < bounds.bottom);
      const key = `${plant.x}:${plant.y}`;
      assert.equal(plants.has(key), false);
      plants.add(key);
    }
  }
  assert.ok(plants.size > 1000);
});

test('water and bridge queries agree with generated scenery and keep the starting clearing dry', () => {
  const terrain = new WoodlandTerrain('crossings');
  assert.equal(terrain.isWater(WOODLAND_START, 24), false);
  assert.equal(terrain.isWater({ x: 720, y: 2460 }, 24), true);
  const { streams, bridges } = terrain.chunk(2, 1);
  const stream = streams.find(route => route.index === 0);
  const [bridge] = bridges;
  assert.ok(stream && bridge);
  assert.ok(Math.abs(bridge.x - woodlandStreamX(stream, bridge.y)) < .01);
  assert.equal(terrain.isWater(bridge, 24), false);
  const y = bridge.y + 230;
  assert.equal(terrain.isWater({ x: woodlandStreamX(stream, y), y }, 24), true);

  const distantPonds = Array.from({ length: 9 }, (_, i) => terrain.chunk(30 + i, -20)).flatMap(chunk => chunk.ponds);
  assert.ok(distantPonds.length > 0);
  assert.ok(distantPonds.every(pond => terrain.isWater(pond)));
});
