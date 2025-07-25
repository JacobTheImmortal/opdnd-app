import React, { useState } from 'react';

const races = {
  Human: {
    description: "Humans are the most common race in the world. They have no unique traits but are highly adaptable.",
    bonuses: {},
    hp: 20,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
    sp: 4,
  },
  Giant: {
    description: "Giants are enormous and powerful. HP 40, Bar 70, STR+6, DEX-3, INT-1.",
    bonuses: { str: 6, dex: -3, int: -1 },
    hp: 40,
    bar: 70,
    reflex: 3,
    runSpeed: 25,
    sp: 3,
  },
  Tontatta: {
    description: "Tiny but fast. Reflex 8, Speed 70ft, HP 16, STR+2, DEX+1, INT-1, CHA-2.",
    bonuses: { str: 2, dex: 1, int: -1, cha: -2 },
    hp: 16,
    bar: 100,
    reflex: 8,
    runSpeed: 70,
    sp: 3,
  },
  Fishman: {
    description: "Swimmers of the sea. STR+3, CON+1, DEX+1, WIS-1, breath underwater, swim speed 60ft.",
    bonuses: { str: 3, con: 1, dex: 1, wis: -1 },
    hp: 22,
    bar: 100,
    reflex: 6,
    runSpeed: 30,
    sp: 3,
  },
  Mink: {
    description: "Furry warriors with electric powers. STR+1, DEX+2, WIS+1. Can channel electricity. High reflex.",
    bonuses: { str: 1, dex: 2, wis: 1 },
    hp: 20,
    bar: 100,
    reflex: 7,
    runSpeed: 35,
    sp: 3,
  },
  Lunarian: {
    description: "Wings and fire. STR+2, CON+2, CHA-1. Can burst into flames. Fire resistance.",
    bonuses: { str: 2, con: 2, cha: -1 },
    hp: 24,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
    sp: 3,
  },
  Skypiean: {
    description: "Inhabitants of sky islands. DEX+1, INT+2, WIS+1, CON-1. Can use dials better.",
    bonuses: { dex: 1, int: 2, wis: 1, con: -1 },
    hp: 18,
    bar: 110,
    reflex: 6,
    runSpeed: 30,
    sp: 3,
  },
  ThreeEye: {
    description: "Rare third-eye race. INT+3, WIS+2, CHA-1. Can awaken Voice of All Things.",
    bonuses: { int: 3, wis: 2, cha: -1 },
    hp: 18,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
    sp: 3,
  },
  Dwarf: {
    description: "Small and speedy. STR+1, DEX+2, INT+1, WIS-1. Jumping experts.",
    bonuses: { str: 1, dex: 2, int: 1, wis: -1 },
    hp: 16,
    bar: 100,
    reflex: 7,
    runSpeed: 40,
    sp: 3,
  },
};

const devilFruits = [
  { name: "Flame Flame Fruit", ability: "Become and control fire." },
  { name: "Ice Ice Fruit", ability: "Generate and control ice." },
  { name: "Lightning Lightning Fruit", ability: "Command lightning and electricity." },
  { name: "Tired Tired Fruit", ability: "Put others to sleep with drowsiness." },
  { name: "Bear Bear Model Panda", ability: "Gain strength and senses of a panda." },
  { name: "Smoke Smoke Fruit", ability: "Turn into and control smoke." },
  { name: "Sand Sand Fruit", ability: "Manipulate sand and dry enemies." },
  { name: "Dark Dark Fruit", ability: "Absorb everything into darkness." },
  { name: "Light Light Fruit", ability: "Move at light speed and emit lasers." },
  { name: "Gravity Gravity Fruit", ability: "Control gravitational force." },
  { name: "Magnet Magnet Fruit", ability: "Control magnetism." },
  { name: "Chop Chop Fruit", ability: "Split your body into parts, immune to cutting." },
  { name: "Bomb Bomb Fruit", ability: "Detonate any part of your body at will." },
  { name: "Barrier Barrier Fruit", ability: "Create near-invincible barriers." },
  { name: "String String Fruit", ability: "Manipulate strong razor wires." },
  { name: "Operation Operation Fruit", ability: "Create a surgery zone to swap, cut, and heal." },
  { name: "Love Love Fruit", ability: "Turn people to stone with affection." },
  { name: "Clone Clone Fruit", ability: "Imitate appearance and voice of others." },
  { name: "Meme Meme Fruit", ability: "Make things real by imagining or mimicking them." },
  { name: "Gas Gas Fruit", ability: "Control and become toxic gas." },
  { name: "Munch Munch Fruit", ability: "Eat and combine materials or objects." },
  { name: "Toy Toy Fruit", ability: "Turn people into toys under contract." },
  { name: "Art Art Fruit", ability: "Bring drawings to life." },
];
export default function App() {
  const [step, setStep] = useState(1);
  const [charList, setCharList] = useState([]);
  const [newChar, setNewChar] = useState({ name: "", passcode: "", fruit: false });
  const [currentChar, setCurrentChar] = useState(null);
  const [activeTab, setActiveTab] = useState("Main");

  const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  const calculateDerived = (stats, level = 1, base = {}) => {
    const hp = (base.hp || 20) + level * 2;
    const bar = (base.bar || 100) + level * 5;
    const reflex = (base.reflex || 5) + Math.floor(stats.dex / 5) + Math.floor(level / 3);
    return { hp, bar, reflex };
  };

  const startCreation = (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const code = e.target.passcode.value;
    const fruit = e.target.fruit.checked;
    if (name && code.length === 4) {
      setNewChar({ name, passcode: code, fruit });
      setStep(2);
    } else {
      alert("Enter name and 4-digit passcode");
    }
  };

  const chooseRace = (raceKey) => {
    const race = races[raceKey];
    const stats = { ...initStats };
    Object.entries(race.bonuses || {}).forEach(([k, v]) => {
      stats[k] += v;
    });
    const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null;
    const level = 1;
    const derived = calculateDerived(stats, level, race);
    const char = {
      ...newChar,
      race: raceKey,
      stats,
      level,
      sp: race.sp,
      ...derived,
      fruit,
    };
    setCharList((prev) => [...prev, char]);
    setCurrentChar(char);
    setStep(4);
  };

  const enterChar = (char) => {
    const pass = prompt("Enter 4-digit passcode");
    if (pass === char.passcode) {
      setCurrentChar(char);
      setStep(4);
    } else {
      alert("Incorrect passcode");
    }
  };

  const increaseStat = (stat) => {
    if (currentChar.sp > 0) {
      const updated = { ...currentChar };
      updated.stats[stat]++;
      updated.sp--;
      const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
      Object.assign(updated, derived);
      setCurrentChar(updated);
    }
  };

  const levelUp = () => {
    const updated = { ...currentChar };
    updated.level++;
    updated.sp += 3;
    const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
    Object.assign(updated, derived);
    setCurrentChar(updated);
  };
if (step === 2) {
    return (
      <div style={{ padding: '1rem' }}>
        <h2>Choose a Race</h2>
        {Object.entries(races).map(([name, data]) => (
          <div key={name} style={{ marginBottom: '1rem', borderBottom: '1px solid #ccc', paddingBottom: '1rem' }}>
            <h3>{name}</h3>
            <p>{data.description}</p>
            <button onClick={() => chooseRace(name)}>Choose {name}</button>
          </div>
        ))}
      </div>
    );
  }

  if (step === 4 && currentChar) {
    return (
      <div style={{ padding: '1rem' }}>
        <button onClick={() => setStep(1)}>← Back</button>
        <h2>{currentChar.name} (Level {currentChar.level})</h2>
        <p><strong>Race:</strong> {currentChar.race}</p>
        <p><strong>Devil Fruit:</strong> {currentChar.fruit?.name || "None"}</p>
        {currentChar.fruit && <p><em>{currentChar.fruit.ability}</em></p>}
        <p><strong>HP:</strong> {currentChar.hp} | <strong>Bar:</strong> {currentChar.bar} | <strong>Reflex:</strong> {currentChar.reflex}</p>
        <button onClick={levelUp}>Level Up (+3 skill points)</button>

        <div style={{ marginTop: '1rem' }}>
          {["Main", "Actions", "Devil Fruit", "Skill Tree"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>

        {activeTab === "Main" && (
          <>
            <h3>Main Stats</h3>
            <ul>
              {Object.entries(currentChar.stats).map(([k, v]) => (
                <li key={k}>{k.toUpperCase()}: {v} {currentChar.sp > 0 && <button onClick={() => increaseStat(k)}>+</button>}</li>
              ))}
            </ul>
            <p>Skill Points: {currentChar.sp}</p>
          </>
        )}
        {activeTab === "Actions" && (
          <div>
            <h3>Actions Tab</h3>
            <p>Movement, attack, jump, block, etc. (placeholder)</p>
          </div>
        )}
        {activeTab === "Devil Fruit" && currentChar.fruit && (
          <div>
            <h3>{currentChar.fruit.name}</h3>
            <p>{currentChar.fruit.ability}</p>
          </div>
        )}
        {activeTab === "Skill Tree" && (
          <div>
            <h3>Skill Tree</h3>
            <p>Custom skill unlocks coming soon...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>OPDND</h1>
      <form onSubmit={startCreation}>
        <input name="name" placeholder="Character Name" required />
        <input name="passcode" placeholder="4-digit Passcode" maxLength="4" required />
        <label style={{ marginLeft: '1rem' }}>
          <input type="checkbox" name="fruit" />
          Start with Devil Fruit?
        </label>
        <button type="submit" style={{ marginLeft: '1rem' }}>Create</button>
      </form>

      <h2 style={{ marginTop: '2rem' }}>Characters</h2>
      <ul>
        {charList.map((char, i) => (
          <li key={i}>
            <button onClick={() => enterChar(char)}>
              {char.name} ({char.race})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}