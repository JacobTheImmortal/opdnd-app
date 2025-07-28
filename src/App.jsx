import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { races } from './races';
import { devilFruits } from './devilFruits';
import { calculateMaxHealth, applyDamage, applyHeal } from './healthUtils';
import { calculateMaxBar, spendBar, gainBar } from './barUtils';
import { defaultActions } from './actionsUtils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function saveCharacter(character) {
  if (!character || !character.id) return;
  await supabase.from('characters').upsert({ id: character.id, data: character });
}

async function loadCharacter(id) {
  const { data, error } = await supabase.from('characters').select('*').eq('id', id).single();
  if (!error && data && data.data) {
    setCurrentChar(data.data);
  }
}

import EquipmentSheet from './EquipmentSheet';

export default function App() {
  const [step, setStep] = useState(1);
  const [charList, setCharList] = useState([]);
  const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false });
  const [currentChar, setCurrentChar] = useState(null);
  useEffect(() => {
  const fetchCharacters = async () => {
    const { data, error } = await supabase.from('characters').select('*');
    if (error) {
      console.error("Failed to fetch characters:", error);
    } else if (data) {
      const parsedCharacters = data.map(entry => entry.data); // Supabase wraps each character in a `data` field
      setCharList(parsedCharacters);
    }
  };

  fetchCharacters();
}, []);
  const [screen, setScreen] = useState('Main');
  const [damageAmount, setDamageAmount] = useState(0);
  const [barAmount, setBarAmount] = useState(0);
  const [actionPoints, setActionPoints] = useState(3);
  const [customActions, setCustomActions] = useState([]);
const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);
  const [newActionName, setNewActionName] = useState('');
  const [newActionBarCost, setNewActionBarCost] = useState(0);

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
    setActionPoints(3);
    setStep(4);
  };

  const enterChar = (char) => {
    const pass = prompt('Enter 4-digit passcode');
    if (pass === char.passcode) {
      loadCharacter(char.id);
      setActionPoints(3);
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
    saveCharacter(updated);
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
    saveCharacter(updated);
    setActionPoints(3);
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
          <strong> Melee:</strong> 1d6 + {Math.floor((currentChar.stats?.str - 10) / 2)}
        </p>

        <button onClick={levelUp}>Level Up (+3 SP & full restore)</button>

        <div style={{ marginTop: '1rem' }}>
          {['Main', 'Actions', 'Equipment'].map((tab) => (
            <button key={tab} onClick={() => setScreen(tab)} style={{ marginRight: '0.5rem' }}>
              {tab}
            </button>
          ))}
        </div>

        {screen === 'Main' && (
          <>
            <h3>Main Stats</h3>
            <ul>
              {Object.entries(currentChar.stats).map(([k, v]) => (
                <li key={k}>
                {k.toUpperCase()}: {v}
                {currentChar.sp > 0 && (
                  <button onClick={() => increaseStat(k)} style={{ marginLeft: '0.5rem' }}>+</button>
                )}
                Modifier: {(v - 10 >= 0 ? '+' : '') + Math.floor((v - 10) / 2)}
                  {currentChar.sp > 0 && (
                    <button onClick={() => increaseStat(k)} style={{ marginLeft: '0.5rem' }}>+</button>
                  )}
                </li>
              ))}
            </ul>
            <p>Skill Points: {currentChar.sp}</p>

            <h4>Health Management</h4>
            <p>Current HP: {currentChar.currentHp} / {currentChar.hp}</p>
            <input type="number" value={damageAmount} onChange={e => setDamageAmount(Number(e.target.value))} placeholder="Amount" style={{ width: '60px' }} />
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentHp = applyDamage(updated.currentHp, damageAmount);
              setCurrentChar(updated);
    saveCharacter(updated);
            }}>Take Damage</button>
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentHp = applyHeal(updated.currentHp, updated.hp, damageAmount);
              setCurrentChar(updated);
    saveCharacter(updated);
            }} style={{ marginLeft: '0.5rem' }}>Heal</button>
            <h4>Bar Management</h4>
            <p>Current Bar: {currentChar.currentBar} / {currentChar.bar}</p>
            <input
              type="number"
              value={barAmount}
              onChange={e => setBarAmount(Number(e.target.value))}
              placeholder="Amount"
              style={{ width: '60px' }}
            />
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentBar = spendBar(updated.currentBar, barAmount);
                setCurrentChar(updated);
    saveCharacter(updated);
              }}
            >
              Use Bar
            </button>
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentBar = gainBar(updated.currentBar, updated.bar, barAmount);
                setCurrentChar(updated);
    saveCharacter(updated);
              }}
              style={{ marginLeft: '0.5rem' }}
            >
              Regain Bar
            </button>
          </>
        )}

        {screen === 'Actions' && (
          <>
            <h3>Actions</h3>
            <p>Action Points: {actionPoints}</p>
            <button onClick={() => setActionPoints(3)}>Take Turn</button>

            {[...defaultActions, ...customActions].map((action, i) => (
              <div key={i} style={{ marginTop: '0.5rem' }}>
                <strong>{action.name}</strong> – {action.barCost} Bar
                <button onClick={() => {
                  if (actionPoints <= 0) {
                    alert("No Action Points left!");
                    return;
                  }
                  if (currentChar.currentBar < action.barCost) {
                    alert("Not enough Bar!");
                    return;
                  }
                  const updated = { ...currentChar };
                  updated.currentBar -= action.barCost;
                  setCurrentChar(updated);
    saveCharacter(updated);
                  setActionPoints(prev => prev - 1);
                }} style={{ marginLeft: '1rem' }}>Use</button>
              </div>
            ))}

            <h4 style={{ marginTop: '1rem' }}>Add Custom Action</h4>
            <input placeholder="Action Name" value={newActionName} onChange={e => setNewActionName(e.target.value)} style={{ marginRight: '0.5rem' }} />
            <input type="number" placeholder="Bar Cost" value={newActionBarCost} onChange={e => setNewActionBarCost(Number(e.target.value))} style={{ width: '60px', marginRight: '0.5rem' }} />
            <button onClick={() => {
              if (!newActionName) return;
              setCustomActions(prev => [...prev, { name: newActionName, barCost: newActionBarCost }]);
              setNewActionName('');
              setNewActionBarCost(0);
            }}>Add</button>
          </>
        )}

        {screen === 'Equipment' && (
          <EquipmentSheet equipment={equipment} setEquipment={setEquipment} />
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
          <li key={i}><button onClick={() => enterChar(char)}>{char.name} ({char.race})</button></li>
        ))}
      </ul>
    </div>
  );
}
