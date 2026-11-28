// Combat achievements in the page (client/combatAchievements/setup.js, and the victory screen of assets/application.js):
// the Practice menu's Setup lists the Alchemical Hydra's tasks to go for, folded until opened, a box each, kept as
// they are ticked; a
// chosen task's failure is told in the chat; and the victory screen lists how each chosen task went, the failed ones
// with why and the tick. With infinite health and the boss's hitpoints set, the kill does not count.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { browserOptions } from "../tools/browser.mjs";

const browser = await chromium.launch(browserOptions);
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.stack));
  await page.addInitScript(() => localStorage.setItem("osrs-yama-settings", JSON.stringify({ fightStartCountdown: false, pauseWhenUnfocused: false })));
  await page.route("**/engine/SimulationEngine.js*", async (route) => {
    const response = await route.fetch();
    const marker = "this.encounter = options.encounter;";
    const body = await response.text();
    assert.ok(body.includes(marker));
    await route.fulfill({ response, body: body.replace(marker, marker + "window.engine=this;") });
  });
  await page.goto(process.env.TEST_ORIGIN + "/alchemical-hydra/");
  await page.locator(".loading-screen").waitFor({ state: "hidden", timeout: 180000 });

  // The list, under Practice, Setup, Options: the twelve tasks by tier.
  await page.getByRole("button", { name: "Practice" }).first().click();
  await page.getByRole("button", { name: /Options/ }).first().click();
  const list = page.locator('[data-testid="combat-achievements-setup"]').first();
  await list.waitFor();
  // Folded until opened: its header says so, and none of its boxes is showing.
  assert.equal(await list.evaluate((fold) => fold.open), false);
  assert.equal(await list.locator("summary").innerText(), "Tasks to go for");
  assert.equal(await list.locator('input[type="checkbox"]:visible').count(), 0);
  await list.locator("summary").click();
  assert.equal(await list.locator('input[type="checkbox"]').count(), 12);
  for (const name of ["Alcleanical Hydra", "Alchemical Veteran"]) await page.getByRole("checkbox", { name }).first().check();
  assert.match(await list.innerText(), /2 to go for/);
  assert.equal(await list.locator("summary").innerText(), "Tasks to go for (2 chosen)");
  assert.equal(await list.evaluate((fold) => fold.open), true, "still open after a box is ticked");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("openscim.combatAchievements.v1")).selected.alchemical_hydra), ["alcleanical_hydra", "alchemical_veteran"]);
  await page.keyboard.press("Escape");

  // A fight with infinite health, taken to its end by setting the boss's hitpoints.
  await page.evaluate(() => {
    engine.setMechanicsConfig({ ...engine.getMechanicsConfig(), infiniteHealth: true });
    engine.injectAction({ type: "attackTarget", targetId: "alchemical-hydra" });
  });
  // The first hit on the player fails Alcleanical Hydra, and the chat says so.
  await page.getByText("Alcleanical Hydra", { exact: true }).filter({ visible: true }).locator("xpath=..").filter({ hasText: "You have failed" }).first().waitFor({ timeout: 90000 });
  await page.evaluate(() => engine.setBossHp(0));
  const section = page.locator(".victory-modal-ca");
  await section.waitFor({ timeout: 60000 });
  const rows = await section.locator(".victory-modal-ca-row").evaluateAll((items) =>
    items.map((item) => ({
      status: item.querySelector(".victory-modal-ca-status").textContent,
      name: item.querySelector(".victory-modal-ca-name").textContent,
      tick: item.querySelector(".victory-modal-ca-tick").textContent,
      reason: item.querySelector(".victory-modal-ca-reason")?.textContent ?? "",
    })),
  );
  assert.deepEqual(rows.map((row) => [row.status, row.name]), [["Failed", "Alchemical Veteran"], ["Failed", "Alcleanical Hydra"]]);
  assert.equal(rows[1].reason, "You took damage.");
  // The two aids, in the order the tracker saw them: which comes first depends on the ticks between them.
  assert.match(rows[0].reason, /^The kill did not count: (infinite health, boss hitpoints set|boss hitpoints set, infinite health)\.$/);
  assert.ok(rows.every((row) => /^Tick \d+$/.test(row.tick)), JSON.stringify(rows));
  assert.deepEqual(errors, []);
  console.log("Combat achievements in the page: the setup's list, the chat's failure, the victory screen's results");
} finally {
  await browser.close();
}
