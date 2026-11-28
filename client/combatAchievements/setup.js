// The list of a boss's combat achievements to go for, in its setup: the lobby's setup window (assets/application.js)
// and the Practice menu's Setup tab (assets/Grid.js) mount it. A box a task, by tier, the ones completed marked; the
// choice is kept with the player's progress (store.js, `selected`). A chosen task's failure is told in the chat
// whatever the chat settings say (index.js), and the victory screen lists how each chosen task went (results.js).
// Plain DOM, kept in step with the store.
import { combatAchievementsStore, ensureStyle, tierLabel } from "./index.js";
import { getCombatAchievements, taskKey, tierOrder, tierPoints } from "./tracker.js";

export const combatAchievementsCss = `
.ca-setup { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--color-text-body, #cec0a3); }
.ca-setup__note { margin: 0 0 4px; color: var(--color-text-muted, #9f9f9f); font-size: 12px; }
.ca-setup__tier { margin-top: 6px; color: #ffff00; }
.ca-setup__task { display: flex; gap: 6px; align-items: flex-start; cursor: pointer; }
.ca-setup__task input { margin-top: 2px; flex: none; }
.ca-setup__name--done { color: #0dc10d; }
.ca-setup__detail { display: block; color: var(--color-text-muted, #9f9f9f); font-size: 11px; }
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
  const list = el("div", "ca-setup");
  list.dataset.testid = "combat-achievements-setup";
  root.append(list);

  function render() {
    const achievements = getCombatAchievements(kind);
    list.replaceChildren();
    if (!achievements) return;
    const { completed } = combatAchievementsStore.getState();
    const chosen = new Set(combatAchievementsStore.selectedFor(kind));
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
        const row = el("label", "ca-setup__task");
        const box = el("input");
        box.type = "checkbox";
        box.checked = chosen.has(task.id);
        box.setAttribute("aria-label", task.name);
        box.addEventListener("change", () => choose(task.id, box.checked));
        const text = el("span");
        text.append(el("span", "ca-setup__name" + (done ? " ca-setup__name--done" : ""), task.name + (done ? " (completed)" : "")), el("span", "ca-setup__detail", task.description));
        row.append(box, text);
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
    list.remove();
  };
}
