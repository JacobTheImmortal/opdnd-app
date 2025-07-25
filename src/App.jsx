import React, { useState } from 'react';

const races = {
  Human: {
    description: "+4 starting points",
    bonuses: {},
    hp: 20,
    bar: 100,
    reflex: 5,
    runSpeed: 30,
    sp: 4,
  },
  Tontatta: {
    description: "Reflex 8, Speed 70ft, HP 16, STR+2, DEX+1, INT-1, CHA-2, Starts with Dash",
    bonuses: { str: 2, dex: 1, int: -1, cha: -2 },
    hp: 16,
    bar: 100,
    reflex: 8,
    runSpeed: 70,
    sp: 3,
  },
  Giant: {
    description: "HP 40, Bar 70, STR+6, DEX-3, INT-1",
    bonuses: { str: 6, dex: -3, int: -1 },
    hp: 40,
    bar: 70,
    reflex: 3,
    runSpeed: 25,
    sp: 3,
  }
};

const devilFruits = [
  { name: "Flame Flame", ability: "Generate and become fire." },
  { name: "Tired Tired", ability: "Make enemies drowsy." },
  { name: "Bear Bear Model Panda", ability: "Gain powers of a panda bear." },
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
          <div key={name} style={{ marginBottom: '1rem' }}>
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
        <p><strong>HP:</strong> {currentChar.hp} | <strong>Bar:</strong> {currentChar.bar} | <strong>Reflex:</strong> {currentChar.reflex}</p>
        <button onClick={levelUp}>Level Up (+3 pts)</button>

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
            <p>Jump, Punch, Sword Slash, Equip... (customizable)</p>
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
            <h3>Skill Tree Placeholder</h3>
            <p>Each character can have a unique tree.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>OPDND</h1>
      <form onSubmit={startCreation}>
        <input name="name" placeholder="Name" required />
        <input name="passcode" placeholder="4-digit passcode" maxLength="4" required />
        <label style={{ marginLeft: '1rem' }}>
          <input type="checkbox" name="fruit" />
          Start with Devil Fruit?
        </label>
        <button type="submit">Create</button>
      </form>

      <h2>Characters</h2>
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
