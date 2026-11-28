// The list of a boss's combat achievements to go for, in its setup: the lobby's setup window (assets/application.js)
// and the Practice menu's Setup tab (assets/Grid.js) mount it under their "Combat achievements", folded until
// opened, its header ("Tasks to go for") saying how many are chosen. A box a task, by tier, the ones completed marked; the
// choice is kept with the player's progress (store.js, `selected`). A chosen task's failure is told in the chat
// whatever the chat settings say (index.js), and the victory screen lists how each chosen task went (results.js).
// Plain DOM, kept in step with the store.
import { combatAchievementsStore, ensureStyle, tierLabel } from "./index.js";
import { getCombatAchievements, taskKey, tierOrder, tierPoints } from "./tracker.js";

export const combatAchievementsCss = `
.ca-setup__fold { font-size: 13px; color: var(--color-text-body, #cec0a3); }
.ca-setup__summary { cursor: pointer; color: var(--color-text-heading, #ff981f); user-select: none; }
.ca-setup { display: flex; flex-direction: column; gap: 2px; margin-top: 4px; font-size: 13px; color: var(--color-text-body, #cec0a3); }
.ca-setup__note { margin: 0 0 4px; color: var(--color-text-muted, #9f9f9f); font-size: 12px; }
.ca-setup__tier { margin-top: 6px; color: #ffff00; }
.ca-setup__task { display: flex; flex-direction: column; align-items: flex-start; gap: 0; }
.ca-setup .osrs-checkbox__label.ca-setup__name--done { color: #0dc10d; }
.ca-setup__detail { display: block; margin: 0 0 2px 22px; color: var(--color-text-muted, #9f9f9f); font-size: 11px; }
.ca-setup__clear { align-self: flex-start; margin-top: 4px; font: inherit; font-size: 12px; color: var(--color-text-body, #cec0a3);
  background: none; border: 1px solid var(--color-border, #5a4a2c); cursor: pointer; padding: 1px 6px; }
.victory-modal-ca { margin-top: 12px; }
.victory-modal-ca-list { list-style: none; margin: 0; padding: 0; }
.victory-modal-ca-row { display: grid; grid-template-columns: auto 1fr auto; gap: 2px 8px; padding: 4px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: left; }
.victory-modal-ca-status { font-weight: bold; }
.victory-modal-ca-row--completed .victory-modal-ca-status { color: #0dc10d; }
.victory-modal-ca-row--failed .victory-modal-ca-status { color: #ff3030; }
.victory-modal-ca-row--not-completed .victory-modal-ca-status, .victory-modal-ca-row--in-progress .victory-modal-ca-status { color: #ff981f; }
.victory-modal-ca-name { color: #ffffff; }
.victory-modal-ca-tick { color: var(--color-text-muted, #9f9f9f); font-size: 12px; white-space: nowrap; }
.victory-modal-ca-reason { grid-column: 2 / 4; color: var(--color-text-body, #cec0a3); font-size: 12px; }
.victory-modal-ca-note { margin: 4px 0; font-size: 12px; color: var(--color-text-body, #cec0a3); text-align: left; }
.victory-modal-ca-note--not-counted { color: #ff3030; }
`;

/** Does `kind` have combat achievements to choose from? */
export const hasCombatAchievements = (kind) => Boolean(getCombatAchievements(kind));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Mounts the list of `kind`'s tasks in `root`; returns its unmount. Nothing is drawn for a kind without tasks. */
export function mountCombatAchievementsSetup(root, kind) {
  ensureStyle("ca-ui-style", combatAchievementsCss);
  // Folded until opened: a header saying how many are chosen, the list under it. It stays as the player left it
  // while the list is drawn again.
  const fold = el("details", "ca-setup__fold");
  fold.dataset.testid = "combat-achievements-setup";
  const summary = el("summary", "ca-setup__summary");
  const list = el("div", "ca-setup");
  fold.append(summary, list);
  root.append(fold);

  function render() {
    const achievements = getCombatAchievements(kind);
    list.replaceChildren();
    fold.hidden = !achievements;
    if (!achievements) return;
    const { completed } = combatAchievementsStore.getState();
    const chosen = new Set(combatAchievementsStore.selectedFor(kind));
    summary.textContent = "Tasks to go for" + (chosen.size > 0 ? ` (${chosen.size} chosen)` : "");
    const choose = (id, on) => combatAchievementsStore.setSelected(kind, on ? [...chosen, id] : [...chosen].filter((other) => other !== id));
    list.append(
      el(
        "p",
        "ca-setup__note",
        (chosen.size > 0 ? chosen.size + " to go for. " : "Choose the tasks to go for. ") +
          "Each is told in the chat if it fails, and the victory screen says how each went.",
      ),
    );
    for (const tier of tierOrder) {
      const tasks = achievements.tasks.filter((task) => task.tier === tier);
      if (!tasks.length) continue;
      const points = tierPoints[tier];
      list.append(el("div", "ca-setup__tier", `${tierLabel(tier)} (${points} pt${points === 1 ? "" : "s"} each)`));
      for (const task of tasks) {
        const done = Boolean(completed[taskKey(kind, task)]);
        const on = chosen.has(task.id);
        // The application's own checkbox, as the practice aids' (Infinite Health): a button with the checkbox's role.
        const row = el("div", "setting-row ca-setup__task");
        const box = el("button", "osrs-checkbox");
        box.type = "button";
        box.setAttribute("role", "checkbox");
        box.setAttribute("aria-checked", String(on));
        box.setAttribute("aria-label", task.name);
        box.addEventListener("click", () => choose(task.id, !on));
        // A ticked box has its mark in it (Grid.js, OsrsCheckbox).
        const square = el("span", "osrs-checkbox__box");
        if (on) square.append(el("span", "osrs-checkbox__mark"));
        box.append(square, el("span", "osrs-checkbox__label ca-setup__name" + (done ? " ca-setup__name--done" : ""), task.name + (done ? " (completed)" : "")));
        row.append(box, el("span", "ca-setup__detail", task.description));
        list.append(row);
      }
    }
    if (chosen.size > 0) {
      const clear = el("button", "ca-setup__clear", "Clear");
      clear.type = "button";
      clear.addEventListener("click", () => combatAchievementsStore.setSelected(kind, []));
      list.append(clear);
    }
  }

  render();
  const off = combatAchievementsStore.subscribe(render);
  return () => {
    off();
    fold.remove();
  };
}
