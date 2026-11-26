// Scurrius' default loadouts (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy guide
// (Scurrius/Strategies): its low and mid level setups, since he is a boss for those levels (it recommends 50+ in each
// combat stat and 43 Prayer for the protection prayers).
// - Melee: the guide's mid-level row with an abyssal whip (the rat bone mace is its first pick, but its bonus against
//   rats is not modelled here yet: encounter.js). The guide's super attack and super strength are not drinkable in the
//   client, so a super combat potion takes their place.
// - Ranged: the magic shortbow (i) with amethyst arrows, as the guide pairs them, in black d'hide.
// Both bring prayer potions and karambwans, the guide's food.
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
  magic_shortbow: {
    name: "Ranged (Magic shortbow (i))",
    equipment: {
      head: 10382, // Blessed coif
      cape: 10499, // Ava's accumulator
      amulet: 1712, // Amulet of glory(4)
      weapon: 12788, // Magic shortbow (i)
      body: 2503, // Black d'hide body
      legs: 2497, // Black d'hide chaps
      hands: 2491, // Black d'hide vambraces
      boots: 6328, // Snakeskin boots
      ring: 11771, // Archers ring (i)
    },
    inventory: supplies(2444 /* Ranging potion(4) */, 4, 23),
    supplies: { equippedAmmo: { id: 21326 }, selectedSpell: null, spellbook: "standard" }, // Amethyst arrow
  },
};
