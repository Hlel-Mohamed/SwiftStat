// Derived from the WotC "Converting to SRD 5.2.1" document.
//
// LICENSING NOTE: that PDF is © Wizards of the Coast, released only with permission
// to "print and photocopy for personal use" — it is NOT under the SRD's CC-BY-4.0.
// So we extract ONLY non-copyrightable facts: (1) old→new term mappings, and
// (2) brief rules summaries written in our OWN words (not WotC's prose). The change
// cards are flag-gated (see INCLUDE_2024_CHANGES in build-data.mjs) so they can be
// excluded from a publicly hosted build if you want to be conservative.

// 5.1 name (as it appears in the SRD data) → 5.2.1 name. Attached as an alias so a
// 2024-era search term still finds the 5.1 card.
export const renames = {
  // Spells
  Feeblemind: 'Befuddlement',
  'Branding Smite': 'Shining Smite',
  // Poisons
  'Drow Poison': "Spider's Sting",
  // Magic items
  'Arrow of Slaying': 'Ammunition of Slaying',
  'Orb of Dragonkind': 'Dragon Orb',
  'Iron Bands of Binding': 'Iron Bands',
  'Deck of Many Things': 'Mysterious Deck',
  // Monsters / NPCs
  'Flying Sword': 'Animated Flying Sword',
  'Rug of Smothering': 'Animated Rug of Smothering',
  Azer: 'Azer Sentinel',
  Bugbear: 'Bugbear Warrior',
  Centaur: 'Centaur Trooper',
  'Cult Fanatic': 'Cultist Fanatic',
  Gnoll: 'Gnoll Warrior',
  Goblin: 'Goblin Warrior',
  'Half-Red Dragon Veteran': 'Half-Dragon',
  Hobgoblin: 'Hobgoblin Warrior',
  Kobold: 'Kobold Warrior',
  Merfolk: 'Merfolk Skirmisher',
  Minotaur: 'Minotaur of Baphomet',
  Acolyte: 'Priest Acolyte',
  Sahuagin: 'Sahuagin Warrior',
  Gynosphinx: 'Sphinx of Lore',
  Androsphinx: 'Sphinx of Valor',
  Thug: 'Tough',
  'Tribal Warrior': 'Warrior Infantry',
  Veteran: 'Warrior Veteran',
  // Animals
  'Giant Sea Horse': 'Giant Seahorse',
  'Giant Poisonous Snake': 'Giant Venomous Snake',
  Quipper: 'Piranha',
  'Sea Horse': 'Seahorse',
  'Swarm of Quippers': 'Swarm of Piranhas',
  'Swarm of Poisonous Snakes': 'Swarm of Venomous Snakes',
  'Poisonous Snake': 'Venomous Snake',
}

// New / renamed 2024 concepts that have no 5.1 SRD card. Summaries are our own wording.
export const changeCards = [
  { name: 'D20 Test', summary: 'Umbrella term for ability checks, attack rolls, and saving throws.', text: 'A "D20 Test" is any d20 roll: an ability check, an attack roll, or a saving throw. Rules that apply to all three now use this single term.' },
  { name: 'Heroic Inspiration', aliases: ['inspiration'], summary: 'Replaces Inspiration — lets you reroll a d20.', text: 'Heroic Inspiration replaces the old Inspiration rule. Instead of granting advantage, it lets you reroll a d20 immediately and use the new roll.' },
  { name: 'Influence (action)', aliases: ['influence action'], summary: 'Use a check to sway a creature’s attitude.', text: 'The Influence action covers swaying a monster through an ability check (Persuasion, Deception, Intimidation, etc.). Previously handled loosely under social interaction.' },
  { name: 'Study (action)', aliases: ['study action'], summary: 'Make an Intelligence check to recall or analyze knowledge.', text: 'The Study action covers Intelligence checks to recall lore or examine a book or object. Split out from the old Search action.' },
  { name: 'Utilize (action)', aliases: ['use an object', 'utilize action'], summary: 'New name for the Use an Object action.', text: 'The Utilize action is the renamed "Use an Object" action — used to operate an object that needs an action (e.g. pull a lever).' },
  { name: 'Magic (action)', aliases: ['cast a spell', 'magic action'], summary: 'Cast a spell or use a magic item / magical feature.', text: 'The Magic action is a single action that covers casting a spell, using a magic item, or using a magical feature. It absorbs the old Cast a Spell action.' },
  { name: 'Search (action, revised)', aliases: ['search action'], summary: 'Now covers Wisdom checks to find hidden things.', text: 'The Search action now specifically covers Wisdom checks to notice hidden things, such as a Wisdom (Perception) check to spot something concealed. Recalling lore moved to the Study action.' },
  { name: 'Weapon Mastery', summary: 'Martial classes gain mastery properties on weapons (Cleave, Slow, Vex…).', text: 'Weapon Mastery lets certain classes use a weapon’s mastery property — such as Cleave, Slow, Vex, Topple, or Push — when they attack with it.' },
  { name: 'Bloodied', summary: 'A creature at or below half its hit point maximum is Bloodied.', text: 'A creature is "Bloodied" while it has half or fewer of its hit points remaining. Some abilities key off this state.' },
  { name: 'Unarmed Strike (grapple/shove)', aliases: ['grapple', 'shove'], summary: 'Grappling and shoving are now options of an Unarmed Strike.', text: 'Options to grapple and shove a target now appear as part of the Unarmed Strike rules, rather than as a special function of the Attack action.' },
  { name: 'Dropping Prone (revised)', aliases: ['prone'], summary: 'You can’t drop Prone if your Speed is 0.', text: 'A creature can’t make itself Prone if its Speed is 0.' },
  { name: 'Knocking Out a Creature (revised)', summary: 'Unconscious at 1 HP; starts a short rest; ends if it regains HP.', text: 'Reducing a creature to 0 HP non-lethally now leaves it at 1 Hit Point (not 0) and causes it to start a Short Rest. The Unconscious condition ends if it regains any Hit Points.' },
  { name: 'Attack (action, revised)', aliases: ['attack action'], summary: 'Equip/unequip one weapon per attack; move between attacks.', text: 'The Attack action now specifies it involves a weapon or Unarmed Strike, lets you equip or unequip one weapon with each attack, and makes moving between attacks a function of the action.' },
  { name: 'Speed (renamed)', aliases: ['walking speed'], summary: 'Renamed from Walking Speed.', text: 'What was called "Walking Speed" is now simply "Speed".' },
  { name: 'Surprise (revised)', summary: 'Surprise now means Disadvantage on your initiative roll.', text: 'Being surprised no longer costs you your first turn. Instead, a surprised creature has Disadvantage on its Initiative roll.' },
]
