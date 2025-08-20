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
  HumanCyborgVariant: {
    description: "+1 starting point Str+1 Con+1 Start with Monentary Repair.",
    bonuses: {str: 1, con: 1, dex: -1, wis: -1},
    hp: 22,
    bar: 90,
    reflex: 5,
    runSpeed: 30,
    sp: 4
  },
  HumanHalfBuccaneer: {
    description: "Starting Health 30. Starting Bar 85. +1 starting point",
    bonuses: {},
    hp: 30,
    bar: 85,
    reflex: 5,
    runSpeed: 30,
    sp: 4
  },
  Fishman: {
    description: "+Swim speed 60ft, +can breathe underwater, +Speak with Fish, -Run Slower on Land",
    bonuses: { con: 1, wis: -1 },
    hp: 22,
    bar: 100,
    reflex: 6,
    runSpeed: 20,
    sp: 3
  },
  AnglerFishman: {
    description: "+Swim speed 60ft, +can breathe underwater, +Speak with Fish, -Run Slower on Land, +Start with Light, +Darkvision",
    bonuses: { con: 1, wis: -1 },
    hp: 22,
    bar: 100,
    reflex: 6,
    runSpeed: 20,
    sp: 3
  },
  SharkFishman: {
    description: "+Swim speed 60ft, +can breathe underwater, +Speak with Fish, -Run Slower on Land, Str+4, Starting Health 30",
    bonuses: { str: 4,wis: -4 },
    hp: 30,
    bar: 100,
    reflex: 6,
    runSpeed: 20,
    sp: 3
  },
  Mink: {
    description: "Electro Punch trait. High reflex and speed. STR+1, CON-2, DEX+2, WIS+1",
    bonuses: { str: 1, con: -2, dex: 2, wis: 1 },
    hp: 20,
    bar: 100,
    reflex: 7,
    runSpeed: 35,
    sp: 3
  },
  Skypiean: {
    description: "Inhabitants of sky islands. DEX+1, INT+1, WIS+1, CON-2",
    bonuses: { dex: 1, int: 1, wis: 1, con: -2 },
    hp: 18,
    bar: 110,
    reflex: 6,
    runSpeed: 30,
    sp: 3
  },
  Shendorians: {
    description: "+starting point 1 +Jump distance Double +Infinite Breath Holding +5 Bar",
    bonuses: {},
    hp: 19,
    bar: 105,
    reflex: 6,
    runSpeed: 30,
    sp: 4
  },
  Berkin: {
    description: "+Jump distance Double +Infinite Breath Holding +15 Bar",
    bonuses: { },
    hp: 19,
    bar: 115,
    reflex: 6,
    runSpeed: 30,
    sp: 3
  },
  ThreeEye: {
    description: "Rare race that can awaken the Voice of All Things. INT+3, WIS+1, CHA-2",
    bonuses: { int: 3, wis: 1, cha: -2 },
    hp: 18,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
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
    runSpeed: 60,
    sp: 3
  },
  HumanHalfLunarian: {
    description: "+Fire resistance, +2 starting point, +Advantage History, -Starting Bar 80, CHA-2",
    bonuses: { cha: -2 },
    hp: 20,
    bar: 80,
    reflex: 5,
    runSpeed: 30,
    sp: 5
  }
};
