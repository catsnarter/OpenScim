// Scurrius loads on his route and is drawn from the trimmed cache (his lair's
// map square and the squares beside it, him and his rats); at 80% he runs to a
// food pile and eats; his rats come when he calls them; he dies into the
// victory screen. The mechanics themselves are digested by the determinism
// harness (tools/determinism/scenarios/scurrius.mjs).
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = "http://127.0.0.1:8791";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--enable-unsafe-swiftshader"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  // A model, an animation or a map square missing from the trimmed cache is logged, not thrown.
  page.on("console", (message) => message.text().includes("Empty container") && errors.push(message.text()));
  for (const [path, marker, probe] of [
    ["**/engine/SimulationEngine.js*", "this.encounter = options.encounter;", "if (options.encounter.kind === 'scurrius') window.engine = this;"],
    ["**/encounters/shared/buildScene.js*", "const scene = new Scene();", "window.scene = scene;"],
  ]) {
    await page.route(path, async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      assert.ok(body.includes(marker));
      await route.fulfill({ response, body: body.replace(marker, marker + probe) });
    });
  }

  await page.goto(origin + "/scurrius/");
  await page.waitForFunction(() => window.engine && window.scene, null, { timeout: 60000 });
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 60000 });
  assert.equal(new URL(page.url()).pathname, "/scurrius/");

  // The player starts in the first of his setups (loadouts.js, the wiki's strategies page): the abyssal whip and
  // dragon defender worn, a full inventory of supplies.
  const setup = await page.evaluate(() => {
    const { equipment, inventory } = engine.player();
    return { weapon: equipment.weapon, shield: equipment.shield, items: inventory.filter(Boolean).length };
  });
  assert.deepEqual(setup, { weapon: 4151, shield: 12954, items: 28 });

  // At 79% he runs to a food pile, eats there and, before long, calls his rats.
  const eating = await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.mechanicsConfig, infiniteHealth: true });
    engine.setBossHp(395);
    const state = () => engine.getEncounterSnapshot().state;
    const rats = () => engine.worldState.getNpcs().filter((npc) => npc.npcTypeId === 7223 && npc.alive).length;
    let ate = false;
    for (let tick = 0; tick < 300 && rats() === 0; tick++) {
      engine.advanceTick(engine.player().position);
      ate ||= state().phase === "feeding" && state().pile !== null;
    }
    return { ate, rats: rats() };
  });
  assert.deepEqual(eating, { ate: true, rats: 6 });
  await page.waitForFunction(() => scene.isNpcTypeLoaded(7222) && scene.isNpcTypeLoaded(7223), null, { timeout: 60000 });

  // Killed; the application's own loop plays his death and ends the fight.
  await page.evaluate(() => engine.setBossHp(0));
  await page.waitForFunction(() => engine.getEncounterOutcome().phase === "victory" && document.body.innerText.includes("SCURRIUS DEFEATED"), null, { timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log("Scurrius loaded on /scurrius/, ate at a food pile, called his rats, and was won");
} finally {
  await browser.close();
}
