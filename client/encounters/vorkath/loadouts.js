// Vorkath's default loadout (the descriptor's `loadouts`, encounters/registry.js), from the wiki's strategy guide
// (Vorkath/Strategies): a 5-tick crossbow with a dragonfire ward, praying Protect from Missiles, ruby dragon bolts (e)
// until about a third of her hitpoints and diamond dragon bolts (e) after, an extended super antifire, and Crumble
// Undead from a rune pouch for the spawn. The guide's best crossbows are the ascensions; the dragon hunter crossbow is
// its next and the one a mid-level account brings. The guide's armour rows: crystal, an anguish, Ava's assembler,
// Barrows gloves, Pegasian boots and an Archers ring (i). Anti-venom is not drinkable in the client yet: an Antidote++
// takes its place. Sharks are not edible in the client: anglerfish.
const anglerfish = 13441;

export const vorkathLoadouts = {
  dragon_hunter_crossbow: {
    name: "Ranged (Dragon hunter crossbow)",
    equipment: {
      head: 23971, // Crystal helm
      cape: 22109, // Ava's assembler
      amulet: 19547, // Necklace of anguish
      weapon: 21012, // Dragon hunter crossbow
      body: 23975, // Crystal body
      shield: 22002, // Dragonfire ward
      legs: 23979, // Crystal legs
      hands: 7462, // Barrows gloves
      boots: 13237, // Pegasian boots
      ring: 11771, // Archers ring (i)
    },
    inventory: [
      22209, // Extended super antifire(4)
      23733, // Divine ranging potion(4)
      3024, 3024, 3024, // Super restore(4)
      5952, // Antidote++(4)
      21946, // Diamond dragon bolts (e), for below a third
      12791, // Rune pouch: earth, air, chaos for Crumble Undead
      ...Array(20).fill(anglerfish),
    ],
    supplies: {
      equippedAmmo: { id: 21944 }, // Ruby dragon bolts (e)
      runePouch: { kind: "standard", slots: [{ id: 557 }, { id: 556 }, { id: 562 }] }, // Earth, air, chaos runes
      selectedSpell: null,
      spellbook: "standard",
    },
  },
};
