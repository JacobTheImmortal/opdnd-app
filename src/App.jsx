// src/App.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { races } from './races';
import { devilFruits } from './devilFruits';
import { calculateMaxHealth, applyDamage, applyHeal } from './healthUtils';
import { calculateMaxBar, spendBar, gainBar } from './barUtils';
import { defaultActions } from './actionsUtils';
import EquipmentSheet from './EquipmentSheet';
import { equipmentList } from './equipmentData';
import Overview from './Overview';
import DmTools from './DmTools';
import { getFruitActions } from './devilFruitActions';

// ---------- helpers ----------
const PIN_DM = '5637';

async function saveCharacter(character) {
  if (!character || !character.id) return;
  const { error } = await supabase.from('characters').upsert({ id: character.id, data: character });
  if (error) console.error('❌ Error saving character:', error);
}

const uniqueBy = (arr, keyFn) => {
  const seen = new Set();
  return arr.filter((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
const modFromScore = (score) => Math.floor((Number(score || 10) - 10) / 2);

// Recalc BASE (no DM mods here)
function recalcBase(char) {
  const race = races[char.race] || {};
  const stats = char.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const level = char.level || 1;
  const baseHP = race.hp || 20;
  const baseBar = race.bar || 100;
  const con = stats.con || 10;
  const int = stats.int || 10;
  const wis = stats.wis || 10;
  const hp = calculateMaxHealth(baseHP, con, level);
  const bar = calculateMaxBar(baseBar, int, wis, level);
  const reflex = (race.reflex || 5) + Math.floor((stats.dex || 10) / 5) + Math.floor(level / 3);
  return { baseHp: hp, baseBar: bar, baseReflex: reflex };
}

// Apply DM mods to base, clamp to minimums
function applyDmMods(base, mods) {
  const hpMod = Number(mods.hpMod || 0);
  const barMod = Number(mods.barMod || 0);
  const reflexMod = Number(mods.reflexMod || 0);
  return {
    hp: Math.max(1, (base.baseHp || 1) + hpMod),
    bar: Math.max(0, (base.baseBar || 0) + barMod),
    reflex: Math.max(0, (base.baseReflex || 0) + reflexMod),
  };
}

export default function App() {
  // ---- app state ----
  const [step, setStep] = useState(1); // 0 Overview, 1 Home, 2 Choose Race, 3 DevTools, 4 Sheet
  const [charList, setCharList] = useState([]);
  const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false });
  const [currentChar, setCurrentChar] = useState(null);

  const [screen, setScreen] = useState('Main');
  const [damageAmount, setDamageAmount] = useState(0);
  const [barAmount, setBarAmount] = useState(0);
  const [actionPoints, setActionPoints] = useState(3);

  // actions state (and persistence)
  const [customActions, setCustomActions] = useState([]); // [{name, barCost}]
  const [actionCostMods, setActionCostMods] = useState({}); // { [actionName]: number }

  const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);
  const [activeEffects, setActiveEffects] = useState([]);

  const [newActionName, setNewActionName] = useState('');
  const [newActionBarCost, setNewActionBarCost] = useState(0);

  const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // ---- load characters (list) ----
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('characters').select('*');
      if (error) return console.error('Failed to fetch characters:', error);
      const parsed = (data || []).map((row) => row.data);
      setCharList(parsed);
    })();
  }, []);

  // ---- helpers to recalc & persist a character (respecting DM mods) ----
  const recalcAndPersist = (rawChar) => {
    const c = deepClone(rawChar);
    // ensure modifiers exist
    c.hpMod = Number(c.hpMod || 0);
    c.barMod = Number(c.barMod || 0);
    c.reflexMod = Number(c.reflexMod || 0);

    // ensure action persistence fields exist
    c.customActions = Array.isArray(c.customActions) ? c.customActions : [];
    c.actionCostMods = c.actionCostMods && typeof c.actionCostMods === 'object' ? c.actionCostMods : {};

    const base = recalcBase(c);
    const withMods = applyDmMods(base, c);
    c.hp = withMods.hp;
    c.bar = withMods.bar;
    c.reflex = withMods.reflex;

    // clamp current pools
    c.currentHp = Math.min(Math.max(0, c.currentHp ?? c.hp), c.hp);
    c.currentBar = Math.min(Math.max(0, c.currentBar ?? c.bar), c.bar);

    setCurrentChar(c);
    setCustomActions(c.customActions);
    setActionCostMods(c.actionCostMods);
    saveCharacter(c);
    return c;
  };

  const loadCharacter = async (id) => {
    const { data, error } = await supabase.from('characters').select('*').eq('id', id).single();
    if (error || !data?.data) return console.error('❌ Error loading character:', error);
    const c = data.data;
    const full = recalcAndPersist(c);
    setEquipment(full.equipment?.length ? full.equipment : [{ name: '', quantity: 1, customDesc: '' }]);
    setActiveEffects(full.activeEffects || []);
    setActionPoints(3);
    setScreen('Main');
    setStep(4);
  };

  // Home helpers (restore buttons)
  const enterChar = (char) => loadCharacter(char.id);
  const deleteCharacter = async (char) => {
    if (!window.confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) {
      alert('Delete failed.');
      return;
    }
    setCharList((prev) => prev.filter((c) => c.id !== char.id));
    if (currentChar?.id === char.id) {
      setCurrentChar(null);
      setStep(1);
    }
  };

  // ---- create flow ----
  const startCreation = (e) => {
    e.preventDefault();
    const { name, fruit, passcode } = {
      name: e.target.name.value.trim(),
      fruit: e.target.fruit.checked,
      passcode: e.target.passcode.value.trim(),
    };
    if (!name || passcode.length !== 4) return alert('Enter a name and a 4-digit passcode');
    setNewChar({ name, passcode, fruit });
    setStep(2);
  };

  const chooseRace = (raceKey) => {
    const race = races[raceKey];
    const stats = { ...initStats };
    Object.entries(race.bonuses || {}).forEach(([k, v]) => (stats[k] += v));
    const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null;

    const base = recalcBase({ race: raceKey, stats, level: 1 });
    const mods = { hpMod: 0, barMod: 0, reflexMod: 0 }; // start clean
    const totals = applyDmMods(base, mods);

    const char = {
      ...newChar,
      id: Date.now().toString(),
      race: raceKey,
      stats,
      level: 1,
      sp: race.sp,
      ...base,
      ...totals,
      hpMod: 0,
      barMod: 0,
      reflexMod: 0,
      fruit,
      currentHp: totals.hp,
      currentBar: totals.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: false,
      meleeText: '1d6',
      meleeBonus: modFromScore(stats.str || 10),

      // actions persistence
      customActions: [],
      actionCostMods: {},
    };
    setCharList((prev) => [...prev, char]);
    setCurrentChar(char);
    setEquipment([]);
    setActiveEffects([]);
    setCustomActions([]);
    setActionCostMods({});
    setActionPoints(3);
    setScreen('Main');
    setStep(4);
    saveCharacter(char);
  };

  // ---- stat increase & level up (respect DM mods) ----
  const bumpAndPersistFrom = (updated) => {
    const base = recalcBase(updated);
    const totals = applyDmMods(base, updated);
    Object.assign(updated, base, totals);
    updated.currentHp = Math.min(updated.currentHp ?? totals.hp, totals.hp);
    updated.currentBar = Math.min(updated.currentBar ?? totals.bar, totals.bar);
    setCurrentChar(updated);
    saveCharacter(updated);
  };

  const increaseStat = (stat) => {
    if (!currentChar || currentChar.sp <= 0) return;
    const updated = deepClone(currentChar);
    updated.stats[stat] = (updated.stats[stat] || 10) + 1;
    updated.sp--;
    bumpAndPersistFrom(updated);
  };

  const levelUp = () => {
    if (!currentChar) return;
    const updated = deepClone(currentChar);
    updated.level++;
    updated.sp = (updated.sp || 0) + 3;
    // full restore on level up
    const base = recalcBase(updated);
    const totals = applyDmMods(base, updated);
    Object.assign(updated, base, totals);
    updated.currentHp = updated.hp;
    updated.currentBar = updated.bar;
    setCurrentChar(updated);
    saveCharacter(updated);
    setActionPoints(3);
  };

  // ---- equipment & devil fruit -> actions ----
  const equipmentActions = useMemo(() => {
    const names = equipment.filter((it) => it && it.name && it.name !== '').map((it) => it.name);
    const distinct = uniqueBy(names, (n) => n);
    return distinct.map((n) => {
      const meta = equipmentList.find((e) => e.name === n) || {};
      const cost = Number(meta.useCost) || 0;
      return { name: `Use ${n}`, barCost: cost, _kind: 'equipment', itemName: n };
    });
  }, [equipment]);

  const devilFruitActions = useMemo(() => {
    const fruitName = currentChar?.fruit?.name || '';
    if (!fruitName) return [];
    return getFruitActions(fruitName).map((a) => ({
      name: a.name,
      barCost: Number(a.barCost) || 0,
      _kind: 'devilFruit',
      perTurnCost: Number(a.perTurnCost) || 0,
    }));
  }, [currentChar]);

  // Merge actions (default + equipment + fruit + custom)
  const actionsMerged = useMemo(
    () => [...defaultActions, ...equipmentActions, ...devilFruitActions, ...customActions],
    [equipmentActions, devilFruitActions, customActions]
  );

  // Compute final actions with cost modifiers applied
  const actionsToShow = useMemo(() => {
    const mods = actionCostMods || {};
    return actionsMerged.map((a) => {
      const mod = Number(mods[a.name] || 0);
      const baseCost = Number(a.barCost || 0);
      const finalCost = Math.max(0, baseCost + mod);
      return { ...a, _baseCost: baseCost, _mod: mod, barCost: finalCost };
    });
  }, [actionsMerged, actionCostMods]);

  // ---- persistence mirrors for equipment/effects ----
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

  // ---- actions persistence helpers ----
  const persistActionMods = (nextMods) => {
    setActionCostMods(nextMods);
    if (!currentChar) return;
    const updated = { ...currentChar, actionCostMods: nextMods };
    setCurrentChar(updated);
    saveCharacter(updated);
  };

  const persistCustomActions = (nextCustom) => {
    setCustomActions(nextCustom);
    if (!currentChar) return;
    const updated = { ...currentChar, customActions: nextCustom };
    setCurrentChar(updated);
    saveCharacter(updated);
  };

  /* ----------------------------------
     Renders
  -----------------------------------*/
  // Overview page
  if (step === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <button onClick={() => setStep(1)}>← Back</button>
        <h1>OPDND — Overview</h1>
        <Overview />
      </div>
    );
  }

  // DEV TOOLS
  if (step === 3) {
    return (
      <DmTools
        charList={charList}
        setCharList={setCharList}
        onBack={() => setStep(1)}
        onOpenSheet={(char) => {
          // ensure mods & actions are respected on open
          const c = recalcAndPersist(char);
          setEquipment(c.equipment || []);
          setActiveEffects(c.activeEffects || []);
          setCustomActions(c.customActions || []);
          setActionCostMods(c.actionCostMods || {});
          setActionPoints(3);
          setScreen('Main');
          setStep(4);
        }}
      />
    );
  }

  // Choose race page
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

  // Character sheet
  if (step === 4 && currentChar) {
    return (
      <div style={{ padding: '1rem' }}>
        {/* Back clears the open session */}
        <button
          onClick={() => {
            setCurrentChar(null);
            setStep(1);
          }}
        >
          ← Back
        </button>

        <h2>
          {currentChar.name} (Level {currentChar.level})
        </h2>
        <p>
          <strong>Race:</strong> {currentChar.race}
        </p>

        <p>
          <strong>HP:</strong> {currentChar.currentHp} / {currentChar.hp} | <strong>Bar:</strong> {currentChar.currentBar} / {currentChar.bar} |{' '}
          <strong>Reflex:</strong> {currentChar.reflex} | <strong>Melee:</strong>{' '}
          {(currentChar.meleeText || '1d6') + ' + ' + (Number(currentChar.meleeBonus || 0))}
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
                    <button onClick={() => increaseStat(k)} style={{ marginLeft: '0.5rem' }}>
                      +
                    </button>
                  )}{' '}
                  Modifier: {(v - 10 >= 0 ? '+' : '') + Math.floor((v - 10) / 2)}
                </li>
              ))}
            </ul>
            <p>Skill Points: {currentChar.sp}</p>

            <h4>Health Management</h4>
            <p>
              Current HP: {currentChar.currentHp} / {currentChar.hp}
            </p>
            <input
              type="number"
              value={damageAmount}
              onChange={(e) => setDamageAmount(Number(e.target.value))}
              placeholder="Amount"
              style={{ width: '60px' }}
            />
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentHp = applyDamage(updated.currentHp, damageAmount);
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
            >
              Take Damage
            </button>
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentHp = applyHeal(updated.currentHp, updated.hp, damageAmount);
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
              style={{ marginLeft: '0.5rem' }}
            >
              Heal
            </button>

            <h4>Bar Management</h4>
            <p>
              Current Bar: {currentChar.currentBar} / {currentChar.bar}
            </p>
            <input
              type="number"
              value={barAmount}
              onChange={(e) => setBarAmount(Number(e.target.value))}
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

            {/* Rest buttons */}
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
            <button
              onClick={() => {
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
              }}
            >
              Take Turn
            </button>

            {/* Active on Turn */}
            {activeEffects.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', border: '1px dashed #aaa' }}>
                <strong>Active on Turn</strong>
                {activeEffects.map((eff, i) => (
                  <div key={`eff-${i}`} style={{ marginTop: '0.25rem' }}>
                    {eff.name} – {eff.perTurnCost} Bar
                    <button
                      style={{ marginLeft: '0.5rem' }}
                      onClick={() => {
                        const next = activeEffects.filter((_, idx) => idx !== i);
                        persistEffects(next);
                      }}
                    >
                      Turn Off
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* All actions (with per-action Mod + Use; delete for custom) */}
            {actionsToShow.map((action, i) => (
              <div key={`${action.name}-${i}`} style={{ marginTop: '0.5rem' }}>
                <strong>{action.name}</strong> — Base {action._baseCost} Bar
                <span style={{ marginLeft: '0.75rem' }}>
                  Mod&nbsp;
                  <input
                    type="number"
                    value={action._mod}
                    onChange={(e) => {
                      const val = Number(e.target.value || 0);
                      const next = { ...(actionCostMods || {}) };
                      next[action.name] = val;
                      persistActionMods(next);
                    }}
                    style={{ width: 60 }}
                  />
                </span>
                <span style={{ marginLeft: '0.75rem' }}>
                  Final: <strong>{action.barCost}</strong> Bar
                </span>
                <button
                  onClick={() => {
                    const cost = action.barCost || 0;
                    if (actionPoints <= 0) {
                      alert('No Action Points left!');
                      return;
                    }
                    if (currentChar.currentBar < cost) {
                      alert('Not enough Bar!');
                      return;
                    }
                    const updated = { ...currentChar };
                    updated.currentBar -= cost;
                    setCurrentChar(updated);
                    saveCharacter(updated);
                    setActionPoints((prev) => prev - 1);

                    if (action.perTurnCost && action.perTurnCost > 0) {
                      const already = activeEffects.some((e) => e.name === action.name);
                      if (!already) persistEffects([...activeEffects, { name: action.name, perTurnCost: action.perTurnCost }]);
                    }
                  }}
                  style={{ marginLeft: '1rem' }}
                >
                  Use
                </button>

                {/* Delete only for custom actions */}
                {customActions.some((c) => c.name === action.name) && (
                  <button
                    style={{ marginLeft: '0.5rem', background: '#fbe9e9', border: '1px solid #e57373' }}
                    onClick={() => {
                      const next = customActions.filter((c) => c.name !== action.name);
                      persistCustomActions(next);
                      // also clean any explicit mod for it
                      const mods = { ...(actionCostMods || {}) };
                      delete mods[action.name];
                      persistActionMods(mods);
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}

            <h4 style={{ marginTop: '1rem' }}>Add Custom Action</h4>
            <input
              placeholder="Action Name"
              value={newActionName}
              onChange={(e) => setNewActionName(e.target.value)}
              style={{ marginRight: '0.5rem' }}
            />
            <input
              type="number"
              placeholder="Bar Cost"
              value={newActionBarCost}
              onChange={(e) => setNewActionBarCost(Number(e.target.value))}
              style={{ width: '80px', marginRight: '0.5rem' }}
            />
            <button
              onClick={() => {
                const name = (newActionName || '').trim();
                if (!name) return;
                const baseCost = Number.isFinite(newActionBarCost) ? Number(newActionBarCost) : 0;
                const next = [...customActions, { name, barCost: baseCost, _kind: 'custom' }];
                persistCustomActions(next);
                // start with no mod for new custom action
                const mods = { ...(actionCostMods || {}) };
                if (mods[name] == null) mods[name] = 0;
                persistActionMods(mods);
                setNewActionName('');
                setNewActionBarCost(0);
              }}
            >
              Add
            </button>
          </>
        )}

        {screen === 'Equipment' && <EquipmentSheet equipment={equipment} setEquipment={persistEquipment} />}

        {screen === 'Devil Fruit' && (
          <div style={{ marginTop: '0.75rem' }}>
            <h3>Devil Fruit</h3>
            {currentChar.fruit ? (
              <>
                <div>
                  <strong>Name:</strong> {currentChar.fruit.name}
                </div>
                {currentChar.fruit.ability && (
                  <p style={{ marginTop: '0.5rem' }}>
                    <em>{currentChar.fruit.ability}</em>
                  </p>
                )}
                {devilFruitActions.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong>Starting Actions</strong>
                    <ul>
                      {devilFruitActions.map((a, i) => (
                        <li key={`dfa-${i}`}>
                          {a.name} – {a.barCost} Bar
                          {a.perTurnCost ? ` + ${a.perTurnCost}/turn` : ''}
                        </li>
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
            <button
              onClick={() => {
                if (currentChar.sp <= 0) {
                  alert('No Skill Points left.');
                  return;
                }
                const updated = { ...currentChar };
                updated.sp -= 1;
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
            >
              Spend Skill Point
            </button>

            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => {
                  const name = prompt('Skill name?');
                  if (!name) return;
                  const desc = prompt('Skill description?') || '';
                  const updated = { ...currentChar };
                  const next = Array.isArray(updated.skills) ? [...updated.skills] : [];
                  next.push({ name, description: desc });
                  updated.skills = next;
                  setCurrentChar(updated);
                  saveCharacter(updated);
                }}
              >
                + Add Skill
              </button>
            </div>

            {Array.isArray(currentChar.skills) && currentChar.skills.length > 0 && (
              <ul style={{ marginTop: '1rem' }}>
                {currentChar.skills.map((s, i) => (
                  <li key={`skill-${i}`}>
                    <strong>{s.name}</strong>
                    {s.description ? ` — ${s.description}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ----------------------------------
     Home
  -----------------------------------*/
  return (
    <div style={{ padding: '1rem', position: 'relative', minHeight: '100vh' }}>
      <h1>OPDND</h1>

      {/* Top-right Overview button */}
      <div style={{ position: 'fixed', right: '1rem', top: '1rem' }}>
        <button style={{ color: 'crimson' }} onClick={() => setStep(0)}>
          Overview
        </button>
      </div>

      <form onSubmit={startCreation}>
        <input name="name" placeholder="Character Name" required />{' '}
        <input name="passcode" placeholder="4-digit Passcode" maxLength="4" required />{' '}
        <label style={{ marginLeft: '1rem' }}>
          <input type="checkbox" name="fruit" /> Start with Devil Fruit?
        </label>
        <button type="submit" style={{ marginLeft: '1rem' }}>
          Create
        </button>
      </form>

      <h2 style={{ marginTop: '2rem' }}>Characters</h2>
      <ul>
        {charList
          .filter((c) => !c.hidden)
          .map((char) => (
            <li key={char.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
              <button onClick={() => enterChar(char)}>
                {char.name} ({char.race})
              </button>
              <button onClick={() => deleteCharacter(char)} style={{ background: '#fbe9e9', border: '1px solid #e57373' }}>
                Delete
              </button>
            </li>
          ))}
      </ul>

      {/* Bottom-left Dev Tool Mode */}
      <div style={{ position: 'fixed', left: '1rem', bottom: '1rem' }}>
        <button
          style={{ color: 'crimson' }}
          onClick={() => {
            const pin = prompt('Enter Dev PIN');
            if (pin === PIN_DM) setStep(3);
            else alert('Incorrect PIN.');
          }}
        >
          DevTool Mode
        </button>
      </div>
    </div>
  );
}
