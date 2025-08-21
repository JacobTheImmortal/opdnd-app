import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { races } from './races';
import { devilFruits } from './devilFruits';
import { calculateMaxHealth, applyDamage, applyHeal } from './healthUtils';
import { calculateMaxBar, spendBar, gainBar } from './barUtils';
import { defaultActions } from './actionsUtils';
import EquipmentSheet from './EquipmentSheet';
import { equipmentList } from './equipmentData';
import { getFruitActions } from './devilFruitActions';
import Overview from './Overview';

/* ----------------------------------
   Helpers & utilities
-----------------------------------*/
async function saveCharacter(character) {
  if (!character || !character.id) return;
  const { error } = await supabase.from('characters').upsert({ id: character.id, data: character });
  if (error) console.error('❌ Error saving character:', error);
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function derive(stats, level, raceKey) {
  const race = races[raceKey] || {};
  const baseHP = race.hp || 20;
  const baseBar = race.bar || 100;
  const hp = calculateMaxHealth(baseHP, stats.con || 10, level || 1);
  const bar = calculateMaxBar(baseBar, stats.int || 10, stats.wis || 10, level || 1);
  const reflex = (race.reflex || 5) + Math.floor((stats.dex || 10) / 5) + Math.floor((level || 1) / 3);
  return { hp, bar, reflex };
}

function initialStatsWithRace(raceKey) {
  const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const r = races[raceKey] || {};
  Object.entries(r.bonuses || {}).forEach(([k, v]) => (base[k] = (base[k] || 0) + v));
  return base;
}

function cleanString(v) {
  return (v || '').toString().trim();
}

/* A light random helper for Create Random */
function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ----------------------------------
   App
-----------------------------------*/
export default function App() {
  // navigation: 1 Home, 2 Race select, 4 Sheet, 'dev', 'overview'
  const [step, setStep] = useState(1);

  // characters
  const [charList, setCharList] = useState([]);
  const [currentChar, setCurrentChar] = useState(null);

  // creation funnel values
  const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false });

  // sheet UI state
  const [screen, setScreen] = useState('Main');
  const [damageAmount, setDamageAmount] = useState(0);
  const [barAmount, setBarAmount] = useState(0);
  const [actionPoints, setActionPoints] = useState(3);
  const [customActions, setCustomActions] = useState([]);

  // equipment state (mirrors currentChar.equipment)
  const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);

  // “Active on Turn”
  const [activeEffects, setActiveEffects] = useState([]); // [{ name, perTurnCost }]

  // New Action inputs
  const [newActionName, setNewActionName] = useState('');
  const [newActionBarCost, setNewActionBarCost] = useState(0);

  /* ----------------------------------
     Load characters
  -----------------------------------*/
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('characters').select('*');
      if (error) {
        console.error('Failed to fetch characters:', error);
        return;
      }
      if (data) {
        setCharList(data.map(r => r.data));
      }
    })();
  }, []);

  /* ----------------------------------
     Core loaders / savers
  -----------------------------------*/
  const loadCharacter = async (id) => {
    const { data, error } = await supabase.from('characters').select('*').eq('id', id).single();
    if (error) {
      console.error('❌ Error loading character:', error);
      return;
    }
    if (data && data.data) {
      const loaded = data.data;
      setCurrentChar(loaded);
      setEquipment(
        loaded.equipment && Array.isArray(loaded.equipment) && loaded.equipment.length
          ? loaded.equipment
          : [{ name: '', quantity: 1, customDesc: '' }]
      );
      setActionPoints(3);
      setActiveEffects(loaded.activeEffects || []);
      setScreen('Main');
      setStep(4);
    }
  };

  const persistEquipment = (updated) => {
    setEquipment(updated);
    if (!currentChar) return;
    const updatedChar = { ...currentChar, equipment: updated };
    setCurrentChar(updatedChar);
    saveCharacter(updatedChar);
  };

  const persistEffects = (updated) => {
    setActiveEffects(updated);
    if (!currentChar) return;
    const updatedChar = { ...currentChar, activeEffects: updated };
    setCurrentChar(updatedChar);
    saveCharacter(updatedChar);
  };

  /* ----------------------------------
     Create flow (Home)
  -----------------------------------*/
  const startCreation = (e) => {
    e.preventDefault();
    const name = cleanString(e.target.name.value);
    const passcode = cleanString(e.target.passcode.value);
    const fruit = !!e.target.fruit.checked;
    if (!name || passcode.length !== 4) {
      alert('Enter a name and a 4-digit passcode');
      return;
    }
    setNewChar({ name, passcode, fruit });
    setStep(2);
  };

  const chooseRace = (raceKey) => {
    const stats = initialStatsWithRace(raceKey);
    const level = 1;
    const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null;
    const derived = derive(stats, level, raceKey);
    const char = {
      ...newChar,
      id: Date.now().toString(),
      race: raceKey,
      stats,
      level,
      sp: races[raceKey]?.sp ?? 0,
      ...derived,
      fruit,
      currentHp: derived.hp,
      currentBar: derived.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: false,
      meleeBonus: Math.floor((stats.str - 10) / 2) // keep your melee calc visible
    };
    setCharList(prev => [...prev, char]);
    setCurrentChar(char);
    setEquipment([]);
    setActiveEffects([]);
    setActionPoints(3);
    setScreen('Main');
    setStep(4);
    saveCharacter(char);
  };

  /* ----------------------------------
     Enter / delete (Home)
  -----------------------------------*/
  const enterChar = async (char) => {
    const pass = prompt('Enter 4-digit passcode');
    if (pass === char.passcode) {
      await loadCharacter(char.id);
    } else {
      alert('Incorrect passcode');
    }
  };

  const deleteCharacter = async (char) => {
    const pass = prompt(`Enter 4-digit passcode to DELETE "${char.name}"`);
    if (pass !== char.passcode) {
      alert('Incorrect passcode');
      return;
    }
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) {
      console.error('❌ Error deleting character:', error);
      alert('Failed to delete character.');
      return;
    }
    setCharList(prev => prev.filter(c => c.id !== char.id));
    if (currentChar?.id === char.id) {
      setCurrentChar(null);
      setStep(1);
    }
  };

  /* ----------------------------------
     Stats & level (Sheet)
  -----------------------------------*/
  const increaseStat = (stat) => {
    if (!currentChar || currentChar.sp <= 0) return;
    const updated = { ...currentChar };
    updated.stats[stat] = (updated.stats[stat] || 0) + 1;
    updated.sp -= 1;
    const d = derive(updated.stats, updated.level, updated.race);
    Object.assign(updated, d);
    updated.currentHp = Math.min(updated.currentHp, d.hp);
    updated.currentBar = Math.min(updated.currentBar, d.bar);
    updated.meleeBonus = Math.floor((updated.stats.str - 10) / 2);
    setCurrentChar(updated);
    saveCharacter(updated);
  };

  const levelUp = () => {
    if (!currentChar) return;
    const updated = { ...currentChar };
    updated.level += 1;
    updated.sp = (updated.sp || 0) + 3;
    const d = derive(updated.stats, updated.level, updated.race);
    Object.assign(updated, d);
    updated.currentHp = d.hp;
    updated.currentBar = d.bar;
    setCurrentChar(updated);
    saveCharacter(updated);
    setActionPoints(3);
  };

  /* ----------------------------------
     Equipment → Actions bridge
  -----------------------------------*/
  const equipmentActions = useMemo(() => {
    const names = equipment.filter(it => it && it.name && it.name !== '').map(it => it.name);
    const distinct = uniqueBy(names, n => n);
    return distinct.map(n => {
      const meta = equipmentList.find(e => e.name === n) || {};
      const cost = Number(meta.useCost) || 0;
      return { name: `Use ${n}`, barCost: cost, _kind: 'equipment', itemName: n };
    });
  }, [equipment]);

  /* Devil Fruit → Actions */
  const devilFruitActions = useMemo(() => {
    const fruitName = currentChar?.fruit?.name;
    return fruitName ? getFruitActions(fruitName) : [];
  }, [currentChar]);

  const actionsToShow = useMemo(
    () => [...defaultActions, ...equipmentActions, ...devilFruitActions, ...customActions],
    [equipmentActions, devilFruitActions, customActions]
  );

  /* ----------------------------------
     DM TOOLS helpers
  -----------------------------------*/
  const dmSaveInlineName = async (char, nextName) => {
    const updated = { ...char, name: cleanString(nextName || char.name) };
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (!error) setCharList(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  };

  const dmDelete = async (char) => {
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) { alert('Delete failed.'); return; }
    setCharList(prev => prev.filter(c => c.id !== char.id));
  };

  const dmCopy = async (char) => {
    const clone = { ...char, id: `${Date.now()}_${Math.floor(Math.random()*1000)}`, name: `${char.name} (Copy)` };
    const { error } = await supabase.from('characters').insert({ id: clone.id, data: clone });
    if (error) { alert('Copy failed.'); return; }
    setCharList(prev => [...prev, clone]);
  };

  const dmLevelAdjust = async (char, delta) => {
    const next = { ...char, level: Math.max(1, (char.level || 1) + delta) };
    // Adjust SP (+3 / -3) with floor 0
    next.sp = Math.max(0, (next.sp || 0) + (delta > 0 ? 3 : -3));
    const d = derive(next.stats || {}, next.level, next.race);
    Object.assign(next, d);
    next.currentHp = Math.min(next.currentHp ?? d.hp, d.hp);
    next.currentBar = Math.min(next.currentBar ?? d.bar, d.bar);
    const { error } = await supabase.from('characters').upsert({ id: next.id, data: next });
    if (error) { alert('Level change failed.'); return; }
    setCharList(prev => prev.map(c => (c.id === next.id ? next : c)));
  };

  const dmSkillPointsAdjust = async (char, delta) => {
    const next = { ...char, sp: Math.max(0, (char.sp || 0) + delta) };
    const { error } = await supabase.from('characters').upsert({ id: next.id, data: next });
    if (!error) setCharList(prev => prev.map(c => (c.id === next.id ? next : c)));
  };

  const dmModifyFruit = async (char) => {
    const current = char.fruit?.name || '';
    const names = devilFruits.map(f => f.name).join(', ');
    const input = prompt(`Enter Devil Fruit name (or type 'none' to remove)\nAvailable: ${names}`, current);
    if (input === null) return;
    const trimmed = input.trim();
    const next = { ...char };
    if (!trimmed || trimmed.toLowerCase() === 'none') {
      next.fruit = null;
    } else {
      const found = devilFruits.find(f => f.name.toLowerCase() === trimmed.toLowerCase());
      if (!found) { alert('Fruit not found.'); return; }
      next.fruit = { name: found.name, ability: found.ability };
    }
    const { error } = await supabase.from('characters').upsert({ id: next.id, data: next });
    if (!error) setCharList(prev => prev.map(c => (c.id === next.id ? next : c)));
  };

  const dmToggleHidden = async (char, checked) => {
    const next = { ...char, hidden: !!checked };
    const { error } = await supabase.from('characters').upsert({ id: next.id, data: next });
    if (!error) setCharList(prev => prev.map(c => (c.id === next.id ? next : c)));
  };

  const dmViewSheet = async (char) => {
    await loadCharacter(char.id); // bypass PIN
  };

  const dmCreateCustom = async () => {
    // 1) name
    const name = cleanString(prompt('Character name?') || '');
    if (!name) return;

    // 2) race
    const raceNames = Object.keys(races);
    const raceInput = cleanString(prompt(`Choose a race:\n${raceNames.join(', ')}`) || '');
    const raceKey = raceNames.find(r => r.toLowerCase() === raceInput.toLowerCase());
    if (!raceKey) { alert('Invalid race.'); return; }

    // 3) Devil Fruit
    const fruitNames = devilFruits.map(f => f.name);
    const fruitInput = cleanString(prompt(`Devil Fruit (type a name, or 'none'):\n${fruitNames.join(', ')}`) || '');
    let fruit = null;
    if (fruitInput && fruitInput.toLowerCase() !== 'none') {
      const found = devilFruits.find(f => f.name.toLowerCase() === fruitInput.toLowerCase());
      if (!found) { alert('Fruit not found.'); return; }
      fruit = { name: found.name, ability: found.ability };
    }

    // 4) Hidden?
    const hiddenAns = cleanString(prompt('Hidden on Home page? (yes/no)', 'no') || 'no');
    const hidden = ['y', 'yes', 'true', '1'].includes(hiddenAns.toLowerCase());

    // build character
    const stats = initialStatsWithRace(raceKey);
    const level = 1;
    const d = derive(stats, level, raceKey);
    const passcode = (Math.floor(Math.random() * 9000) + 1000).toString(); // DM can change later if needed

    const char = {
      id: Date.now().toString(),
      name,
      passcode,
      race: raceKey,
      stats,
      level,
      sp: races[raceKey]?.sp ?? 0,
      ...d,
      currentHp: d.hp,
      currentBar: d.bar,
      fruit,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden,
      meleeBonus: Math.floor((stats.str - 10) / 2)
    };

    const { error } = await supabase.from('characters').insert({ id: char.id, data: char });
    if (error) { alert('Create failed.'); return; }
    setCharList(prev => [...prev, char]);
  };

  const dmCreateRandom = async () => {
    const raceNames = Object.keys(races);
    const raceKey = randomOf(raceNames);
    const stats = initialStatsWithRace(raceKey);
    // add small random bumps
    ['str','dex','con','int','wis','cha'].forEach(k => { stats[k] += Math.floor(Math.random()*3); });
    const level = 1 + Math.floor(Math.random()*3);
    const fruitPick = Math.random() < 0.5 ? null : randomOf(devilFruits);
    const fruit = fruitPick ? { name: fruitPick.name, ability: fruitPick.ability } : null;
    const d = derive(stats, level, raceKey);

    const char = {
      id: Date.now().toString(),
      name: `NPC ${Math.floor(Math.random()*10000)}`,
      passcode: (Math.floor(Math.random() * 9000) + 1000).toString(),
      race: raceKey,
      stats,
      level,
      sp: races[raceKey]?.sp ?? 0,
      ...d,
      currentHp: d.hp,
      currentBar: d.bar,
      fruit,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: true, // random NPC default hidden
      meleeBonus: Math.floor((stats.str - 10) / 2)
    };

    const { error } = await supabase.from('characters').insert({ id: char.id, data: char });
    if (error) { alert('Create failed.'); return; }
    setCharList(prev => [...prev, char]);
  };

  /* ----------------------------------
     Renders: Overview
  -----------------------------------*/
  if (step === 'overview') {
    return <Overview onBack={() => setStep(1)} />;
  }

  /* ----------------------------------
     Renders: Dev tools
  -----------------------------------*/
  if (step === 'dev') {
    return (
      <div style={{ padding: '1rem' }}>
        <button onClick={() => setStep(1)}>← Back</button>
        <h1>Dungeon Master Tools</h1>
        <p style={{ color: '#666' }}>Administer characters below.</p>

        {/* Create buttons */}
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          <button onClick={dmCreateCustom}>Create Custom</button>
          <button onClick={dmCreateRandom}>Create Random</button>
        </div>

        <ul>
          {charList.map((char) => (
            <li key={char.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              {/* Editable name shows race & level inline */}
              <input
                defaultValue={`${char.name} (${char.race}) (Level ${char.level})`}
                onBlur={(e) => {
                  // allow editing just the leading name part if desired
                  // we'll try to parse a name up to " ("
                  const raw = e.target.value;
                  const idx = raw.indexOf(' (');
                  const justName = idx >= 0 ? raw.slice(0, idx) : raw;
                  dmSaveInlineName(char, justName);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                style={{ minWidth: 260 }}
              />

              <button onClick={() => dmDelete(char)} style={{ background: '#fde7e7' }}>Delete</button>
              <button onClick={() => dmCopy(char)}>Copy</button>

              <button onClick={() => dmLevelAdjust(char, +1)}>Lvl +</button>
              <button onClick={() => dmLevelAdjust(char, -1)}>Lvl -</button>

              <button onClick={() => dmSkillPointsAdjust(char, +1)}>SP +</button>
              <button onClick={() => dmSkillPointsAdjust(char, -1)}>SP -</button>

              <button onClick={() => dmModifyFruit(char)}>Modify DevilFruit</button>
              <button onClick={() => dmViewSheet(char)}>View Sheet</button>

              <label style={{ marginLeft: 8 }}>
                <input
                  type="checkbox"
                  checked={!!char.hidden}
                  onChange={(e) => dmToggleHidden(char, e.target.checked)}
                /> Hidden
              </label>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* ----------------------------------
     Renders: Race select
  -----------------------------------*/
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

  /* ----------------------------------
     Renders: Character Sheet
  -----------------------------------*/
  if (step === 4 && currentChar) {
    return (
      <div style={{ padding: '1rem' }}>
        <button onClick={() => { setCurrentChar(null); setStep(1); }}>← Back</button>

        <h2>{currentChar.name} (Level {currentChar.level})</h2>
        <p><strong>Race:</strong> {currentChar.race}</p>
        <p>
          <strong>HP:</strong> {currentChar.currentHp} / {currentChar.hp} |{' '}
          <strong>Bar:</strong> {currentChar.currentBar} / {currentChar.bar} |{' '}
          <strong>Reflex:</strong> {currentChar.reflex} |{' '}
          <strong>Melee:</strong> 1d6 + {Math.floor((currentChar.stats?.str - 10) / 2)}
        </p>

        <button onClick={levelUp}>Level Up (+3 SP & full restore)</button>

        <div style={{ marginTop: '1rem' }}>
          {['Main', 'Actions', 'Equipment', 'Devil Fruit', 'Skill Tree'].map((tab) => (
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
                  )}{' '}
                  Modifier: {(v - 10 >= 0 ? '+' : '') + Math.floor((v - 10) / 2)}
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
            <input type="number" value={barAmount} onChange={e => setBarAmount(Number(e.target.value))} placeholder="Amount" style={{ width: '60px' }} />
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentBar = spendBar(updated.currentBar, barAmount);
              setCurrentChar(updated);
              saveCharacter(updated);
            }}>Use Bar</button>
            <button onClick={() => {
              const updated = { ...currentChar };
              updated.currentBar = gainBar(updated.currentBar, updated.bar, barAmount);
              setCurrentChar(updated);
              saveCharacter(updated);
            }} style={{ marginLeft: '0.5rem' }}>Regain Bar</button>

            {/* Rest helpers */}
            <div style={{ marginTop: '1rem' }}>
              <button
                style={{ color: 'crimson', marginRight: '1rem' }}
                onClick={() => {
                  const updated = { ...currentChar };
                  updated.currentHp = Math.min(updated.currentHp + 10, updated.hp);
                  updated.currentBar = updated.bar;
                  setCurrentChar(updated);
                  saveCharacter(updated);
                }}
              >
                Long Rest
              </button>
              <button
                style={{ color: 'crimson' }}
                onClick={() => {
                  const updated = { ...currentChar };
                  const bonus = Math.floor(updated.bar * 0.5);
                  updated.currentBar = Math.min(updated.currentBar + bonus, updated.bar);
                  setCurrentChar(updated);
                  saveCharacter(updated);
                }}
              >
                Short Rest
              </button>
            </div>
          </>
        )}

        {screen === 'Actions' && (
          <>
            <h3>Actions</h3>
            <p>Action Points: {actionPoints}</p>
            <button onClick={() => {
              const totalUpkeep = activeEffects.reduce((sum, e) => sum + (Number(e.perTurnCost) || 0), 0);
              if (currentChar.currentBar < totalUpkeep) {
                alert(`Not enough Bar to maintain effects (need ${totalUpkeep}). All effects turned off.`);
                persistEffects([]);
                setActionPoints(3);
                return;
              }
              const updated = { ...currentChar, currentBar: currentChar.currentBar - totalUpkeep };
              setCurrentChar(updated);
              saveCharacter(updated);
              setActionPoints(3);
            }}>Take Turn</button>

            {activeEffects.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', border: '1px dashed #aaa' }}>
                <strong>Active on Turn</strong>
                {activeEffects.map((eff, i) => (
                  <div key={`eff-${i}`} style={{ marginTop: '0.25rem' }}>
                    {eff.name} – {eff.perTurnCost} Bar
                    <button style={{ marginLeft: '0.5rem' }} onClick={() => {
                      const next = activeEffects.filter((_, idx) => idx !== i);
                      persistEffects(next);
                    }}>Turn Off</button>
                  </div>
                ))}
              </div>
            )}

            {actionsToShow.map((action, i) => (
              <div key={`${action.name}-${i}`} style={{ marginTop: '0.5rem' }}>
                <strong>{action.name}</strong> – {action.barCost} Bar
                <button
                  onClick={() => {
                    const cost = action.barCost || 0;
                    if (actionPoints <= 0) { alert('No Action Points left!'); return; }
                    if (currentChar.currentBar < cost) { alert('Not enough Bar!'); return; }
                    const updated = { ...currentChar, currentBar: currentChar.currentBar - cost };
                    setCurrentChar(updated);
                    saveCharacter(updated);
                    setActionPoints(prev => prev - 1);

                    if (action.perTurnCost && action.perTurnCost > 0) {
                      const already = activeEffects.some(e => e.name === action.name);
                      if (!already) persistEffects([...activeEffects, { name: action.name, perTurnCost: action.perTurnCost }]);
                    }
                  }}
                  style={{ marginLeft: '1rem' }}
                >
                  Use
                </button>
              </div>
            ))}

            <h4 style={{ marginTop: '1rem' }}>Add Custom Action</h4>
            <input
              placeholder="Action Name"
              value={newActionName}
              onChange={e => setNewActionName(e.target.value)}
              style={{ marginRight: '0.5rem' }}
            />
            <input
              type="number"
              placeholder="Bar Cost"
              value={newActionBarCost}
              onChange={e => setNewActionBarCost(Number(e.target.value))}
              style={{ width: '60px', marginRight: '0.5rem' }}
            />
            <button onClick={() => {
              if (!newActionName) return;
              setCustomActions(prev => [...prev, { name: newActionName, barCost: newActionBarCost }]);
              setNewActionName('');
              setNewActionBarCost(0);
            }}>Add</button>
          </>
        )}

        {screen === 'Equipment' && (
          <EquipmentSheet equipment={equipment} setEquipment={persistEquipment} />
        )}

        {screen === 'Devil Fruit' && (
          <div style={{ marginTop: '0.75rem' }}>
            <h3>Devil Fruit</h3>
            {currentChar.fruit ? (
              <>
                <div><strong>Name:</strong> {currentChar.fruit.name}</div>
                {currentChar.fruit.ability && <p style={{ marginTop: '0.5rem' }}><em>{currentChar.fruit.ability}</em></p>}
                {devilFruitActions.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong>Starting Actions</strong>
                    <ul>
                      {devilFruitActions.map((a, i) => (
                        <li key={`dfa-${i}`}>{a.name} – {a.barCost} Bar{a.perTurnCost ? ` + ${a.perTurnCost}/turn` : ''}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p>No Devil Fruit.</p>
            )}
          </div>
        )}

        {screen === 'Skill Tree' && (
          <div style={{ marginTop: '0.75rem' }}>
            <h3>Skill Tree</h3>
            <p>Skill Points: {currentChar.sp}</p>
            <button onClick={() => {
              if (currentChar.sp <= 0) { alert('No Skill Points left.'); return; }
              const updated = { ...currentChar, sp: currentChar.sp - 1 };
              setCurrentChar(updated);
              saveCharacter(updated);
            }}>Spend Skill Point</button>

            <div style={{ marginTop: '1rem' }}>
              <button onClick={() => {
                const name = prompt('Skill name?');
                if (!name) return;
                const desc = prompt('Skill description?') || '';
                const updated = { ...currentChar };
                const next = Array.isArray(updated.skills) ? [...updated.skills] : [];
                next.push({ name, description: desc });
                updated.skills = next;
                setCurrentChar(updated);
                saveCharacter(updated);
              }}>+ Add Skill</button>
            </div>

            {Array.isArray(currentChar.skills) && currentChar.skills.length > 0 && (
              <ul style={{ marginTop: '1rem' }}>
                {currentChar.skills.map((s, i) => (
                  <li key={`skill-${i}`}><strong>{s.name}</strong>{s.description ? ` — ${s.description}` : ''}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ----------------------------------
     Renders: Home
  -----------------------------------*/
  return (
    <div style={{ padding: '1rem', position: 'relative', minHeight: '100vh' }}>
      <h1>OPDND</h1>

      {/* Overview (top-right) */}
      <div style={{ position: 'fixed', right: '1rem', top: '1rem' }}>
        <button style={{ color: 'crimson' }} onClick={() => setStep('overview')}>Overview</button>
      </div>

      {/* Dev Tools (bottom-left) */}
      <div style={{ position: 'fixed', left: '1rem', bottom: '1rem' }}>
        <button
          style={{ color: 'crimson' }}
          onClick={() => {
            const pin = prompt('Enter Dev PIN');
            if (pin === '5637') setStep('dev'); else alert('Incorrect PIN.');
          }}
        >
          DevTool Mode
        </button>
      </div>

      {/* Create */}
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
        {charList.filter(c => !c.hidden).map((char) => (
          <li key={char.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
            <button onClick={() => enterChar(char)}>{char.name} ({char.race})</button>
            <span style={{ color: '#777' }}>(Level {char.level})</span>
            <button onClick={() => deleteCharacter(char)} style={{ background: '#fbe9e9', border: '1px solid #e57373' }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
