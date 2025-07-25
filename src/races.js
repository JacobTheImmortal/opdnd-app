export const races = {
  Human: {
    description: "Humans are average in every way. +4 skill points at start. Default race with no bonuses or penalties.",
    bonuses: {},
    hp: 20,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
    sp: 4
  },
  Fishman: {
    description: "Swim speed 60ft, can breathe underwater, +3 STR, +1 CON, +1 DEX, -1 WIS",
    bonuses: { str: 3, con: 1, dex: 1, wis: -1 },
    hp: 22,
    bar: 100,
    reflex: 6,
    runSpeed: 30,
    sp: 3
  },
  SharkFishman: {
    description: "Same as Fishman with enhanced bite and combat traits",
    bonuses: { str: 4, con: 2, dex: 1, wis: -1 },
    hp: 24,
    bar: 100,
    reflex: 6,
    runSpeed: 30,
    sp: 3
  },
  Mink: {
    description: "Electro Punch trait. High reflex and speed. STR+1, DEX+2, WIS+1",
    bonuses: { str: 1, dex: 2, wis: 1 },
    hp: 20,
    bar: 100,
    reflex: 7,
    runSpeed: 35,
    sp: 3
  },
  Skypiean: {
    description: "Inhabitants of sky islands. DEX+1, INT+2, WIS+1, CON-1",
    bonuses: { dex: 1, int: 2, wis: 1, con: -1 },
    hp: 18,
    bar: 110,
    reflex: 6,
    runSpeed: 30,
    sp: 3
  },
  Shandian: {
    description: "Skypiean subrace. Better strength and mobility. STR+2, DEX+1, WIS+1, CON-1",
    bonuses: { str: 2, dex: 1, wis: 1, con: -1 },
    hp: 19,
    bar: 110,
    reflex: 6,
    runSpeed: 30,
    sp: 3
  },
  Birkian: {
    description: "Winged skyfolk. INT+1, WIS+2, DEX+1, STR-1",
    bonuses: { int: 1, wis: 2, dex: 1, str: -1 },
    hp: 18,
    bar: 115,
    reflex: 6,
    runSpeed: 30,
    sp: 3
  },
  ThreeEye: {
    description: "Rare race that can awaken the Voice of All Things. INT+3, WIS+2, CHA-1",
    bonuses: { int: 3, wis: 2, cha: -1 },
    hp: 18,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
    sp: 3
  },
  Dwarf: {
    description: "Tiny and fast. Jumping masters. STR+1, DEX+2, INT+1, WIS-1",
    bonuses: { str: 1, dex: 2, int: 1, wis: -1 },
    hp: 16,
    bar: 100,
    reflex: 7,
    runSpeed: 40,
    sp: 3
  },
  Giant: {
    description: "Huge in size. STR+6, DEX-3, INT-1. HP 40, Bar 70",
    bonuses: { str: 6, dex: -3, int: -1 },
    hp: 40,
    bar: 70,
    reflex: 3,
    runSpeed: 25,
    sp: 3
  },
  Tontatta: {
    description: "Tiny but incredibly fast. Reflex 8. STR+2, DEX+1, INT-1, CHA-2. Jump 3x distance.",
    bonuses: { str: 2, dex: 1, int: -1, cha: -2 },
    hp: 16,
    bar: 100,
    reflex: 8,
    runSpeed: 70,
    sp: 3
  },
  Lunarian: {
    description: "Can ignite flames. Fire resistance. STR+2, CON+2, CHA-1",
    bonuses: { str: 2, con: 2, cha: -1 },
    hp: 24,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
    sp: 3
  }
};
