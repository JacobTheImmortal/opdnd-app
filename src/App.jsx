import React, { useState } from 'react';
import { races } from './races';
import { devilFruits } from './devilFruits';
import { calculateMaxHealth, applyDamage, applyHeal } from './healthUtils';
import { calculateMaxBar, spendBar, gainBar } from './barUtils';

export default function App() {
  const [step, setStep] = useState(1);
  const [charList, setCharList] = useState([]);
  const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false });
  const [currentChar, setCurrentChar] = useState(null);
  const [screen, setScreen] = useState('Main');
  const [damageAmount, setDamageAmount] = useState(0);
  const [barAmount, setBarAmount] = useState(0);

  const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  const calculateDerived = (stats, level = 1, race = {}) => {
    const baseHP = race.hp || 20;
    const baseBar = race.bar || 100;
    const con = stats.con || 10;
    const int = stats.int || 10;
    const wis = stats.wis || 10;
    const hp = calculateMaxHealth(baseHP, con, level);
    const bar = calculateMaxBar(baseBar, int, wis, level);
    const reflex = (race.reflex || 5) + Math.floor(stats.dex / 5) + Math.floor(level / 3);
    return { hp, bar, reflex };
  };

  const startCreation = (e) => {
    e.preventDefault();
    const { name, fruit, passcode } = {
      name: e.target.name.value,
      fruit: e.target.fruit.checked,
      passcode: e.target.passcode.value,
    };
    if (name && passcode.length === 4) {
      setNewChar({ name, passcode, fruit });
      setStep(2);
    } else {
      alert('Enter a name and a 4-digit passcode');
    }
  };

  const chooseRace = (raceKey) => {
    const race = races[raceKey];
    const stats = { ...initStats };
    Object.entries(race.bonuses || {}).forEach(([k, v]) => (stats[k] += v));
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
      currentHp: derived.hp,
      currentBar: derived.bar,
    };
    setCharList((prev) => [...prev, char]);
    setCurrentChar(char);
    setStep(4);
  };

  const enterChar = (char) => {
    const pass = prompt('Enter 4-digit passcode');
    if (pass === char.passcode) {
      setCurrentChar(char);
      setStep(4);
    } else {
      alert('Incorrect passcode');
    }
  };

  const increaseStat = (stat) => {
    if (currentChar.sp > 0) {
      const updated = { ...currentChar };
      updated.stats[stat]++;
      updated.sp--;
      const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
      Object.assign(updated, derived);
      updated.currentHp = Math.min(updated.currentHp, derived.hp);
      updated.currentBar = Math.min(updated.currentBar, derived.bar);
      setCurrentChar(updated);
    }
  };

  const levelUp = () => {
    const updated = { ...currentChar };
    updated.level++;
    updated.sp += 3;
    const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
    Object.assign(updated, derived);
    updated.currentHp = derived.hp;
    updated.currentBar = derived.bar;
    setCurrentChar(updated);
  };

  if (step === 2) {
    return (
      <div style={{ padding: '1rem' }}>
        <h2>Choose a Race</h2>
        {Object.entries(races).map(([name, data]) => (
          <div key={name} style={{ marginBottom: '1rem', borderBottom: '1px solid #ddd' }}>
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
        <p><strong>Devil Fruit:</strong> {currentChar.fruit?.name || 'None'}</p>
        {currentChar.fruit && <p><em>{currentChar.fruit.ability}</em></p>}

        <p>
          <strong>HP:</strong> {currentChar.currentHp} / {currentChar.hp} |
          <strong> Bar:</strong> {currentChar.currentBar} / {currentChar.bar} |
          <strong> Reflex:</strong> {currentChar.reflex}
        </p>

        <button onClick={levelUp}>Level Up (+3 SP & full restore)</button>

        <div style={{ marginTop: '1rem' }}>
          {['Main', 'Actions', 'Equipment'].map((tab) => (
            <button key={tab} onClick={() => setScreen(tab)} style={{ marginRight: '0.5rem' }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Main Sheet */}
        {screen === 'Main' && (
          <>
            <h3>Main Stats</h3>
            <ul>
              {Object.entries(currentChar.stats).map(([k, v]) => (
                <li key={k}>
                  {k.toUpperCase()}: {v}
                  {currentChar.sp > 0 && (
                    <button onClick={() => increaseStat(k)} style={{ marginLeft: '0.5rem' }}>
                      +
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p>Skill Points: {currentChar.sp}</p>

            <h4>Health Management</h4>
            <p>Current HP: {currentChar.currentHp} / {currentChar.hp}</p>
            <input
              type="number"
              value={damageAmount}
              onChange={(e) => setDamageAmount(Number(e.target.value))}
              placeholder="Amount"
              style={{ width: '60px' }}
            />
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentHp = applyDamage(updated.currentHp, damageAmount);
              setCurrentChar(updated);
            }}>Take Damage</button>
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentHp = applyHeal(updated.currentHp, updated.hp, damageAmount);
              setCurrentChar(updated);
            }} style={{ marginLeft: '0.5rem' }}>Heal</button>
          </>
        )}

        {/* Actions Sheet */}
        {screen === 'Actions' && (
          <>
            <h3>Actions</h3>
            <p>Use Bar to perform actions</p>
            <input
              type="number"
              value={barAmount}
              onChange={(e) => setBarAmount(Number(e.target.value))}
              placeholder="Bar Cost"
              style={{ width: '60px' }}
            />
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentBar = spendBar(updated.currentBar, barAmount);
              setCurrentChar(updated);
            }}>Use Bar</button>
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentBar = gainBar(updated.currentBar, updated.bar, barAmount);
              setCurrentChar(updated);
            }} style={{ marginLeft: '0.5rem' }}>Restore Bar</button>
          </>
        )}

        {/* Equipment Sheet */}
        {screen === 'Equipment' && (
          <>
            <h3>Equipment</h3>
            <p>Future equipment slots, armor, weapons, etc.</p>
          </>
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
