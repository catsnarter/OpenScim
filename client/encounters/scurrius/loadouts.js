// Scurrius' default loadout (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy guide
// (Scurrius/Strategies): its mid-level melee setup, since he is a boss for low and mid levels (it recommends 50+ in
// each combat stat and 43 Prayer for the protection prayers). An abyssal whip (the rat bone mace is the guide's first
// pick, but its bonus against rats is not modelled here yet: encounter.js). The guide's super attack and super
// strength are not drinkable in the client, so a super combat potion takes their place; prayer potions and
// karambwans, the guide's food. No ranged loadout for now.
const prayerPotion = 2434; // Prayer potion(4)
const karambwan = 3144; // Cooked karambwan
const supplies = (first, prayerPotions, food) => [first, ...Array(prayerPotions).fill(prayerPotion), ...Array(food).fill(karambwan)];

export const scurriusLoadouts = {
  whip: {
    name: "Melee (Abyssal whip)",
    equipment: {
      head: 10828, // Helm of neitiznot
      cape: 6570, // Fire cape
      amulet: 6585, // Amulet of fury
      weapon: 4151, // Abyssal whip
      body: 10551, // Fighter torso
      shield: 12954, // Dragon defender
      legs: 4087, // Dragon platelegs
      hands: 7462, // Barrows gloves
      boots: 11840, // Dragon boots
      ring: 11773, // Berserker ring (i)
    },
    inventory: supplies(12695 /* Super combat potion(4) */, 4, 23),
    supplies: { selectedSpell: null, spellbook: "standard" },
  },
};
