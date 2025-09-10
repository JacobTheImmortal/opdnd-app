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

const deepClone = (o) => JSON.parse(JSON.stringify(o));
const uniqueBy = (arr, keyFn) => {
  const seen = new Set();
  return arr.filter((x) => {
    const k = keyFn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const modFromScore = (s) => Math.floor((Number(s || 10) - 10) / 2);

async function saveCharacter(c) {
  if (!c?.id) return;
  await supabase.from('characters').upsert({ id: c.id, data: c });
}

// BASE only (no DM mods)
function recalcBase(c) {
  const race = races[c.race] || {};
  const st = c.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const lvl = c.level || 1;
  const baseHP = race.hp || 20;
  const baseBar = race.bar || 100;
  const hp = calculateMaxHealth(baseHP, st.con || 10, lvl);
  const bar = calculateMaxBar(baseBar, st.int || 10, st.wis || 10, lvl);
  const reflex = (race.reflex || 5) + Math.floor((st.dex || 10) / 5) + Math.floor(lvl / 3);
  return { baseHp: hp, baseBar: bar, baseReflex: reflex };
}

// apply DM flat modifiers
function applyDmMods(base, c) {
  const hpMod = Number(c.hpMod || 0);
  const barMod = Number(c.barMod || 0);
  const reflexMod = Number(c.reflexMod || 0);
  return {
    hp: Math.max(1, (base.baseHp || 1) + hpMod),
    bar: Math.max(0, (base.baseBar || 0) + barMod),
    reflex: Math.max(0, (base.baseReflex || 0) + reflexMod),
  };
}

// safe int helper
const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

// create a stable unique id for custom actions
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// build a stable key for any action row (per-character)
function actionKey(act) {
  switch (act._kind) {
    case 'equipment':
      return `eq:${act.itemName}`;
    case 'fruit':
      return `fruit:${act.fruitName}:${act.name}`;
    case 'custom':
      return `custom:${act.id}`;
    default:
      return `core:${act.name}`;
  }
}

export default function App() {
  // steps: 0 overview, 1 home, 2 race, 3 DM, 4 sheet
  const [step, setStep] = useState(1);
  const [charList, setCharList] = useState([]);
  const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false });
  const [currentChar, setCurrentChar] = useState(null);

  const [screen, setScreen] = useState('Main');
  const [damageAmount, setDamageAmount] = useState(0);
  const [barAmount, setBarAmount] = useState(0);
  const [actionPoints, setActionPoints] = useState(3);

  // mirrors that we also persist back into the character
  const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);
  const [activeEffects, setActiveEffects] = useState([]);

  // add-custom-action inputs
  const [newActionName, setNewActionName] = useState('');
  const [newActionBarCost, setNewActionBarCost] = useState(0);

  const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  // --------- load character list ----------
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('characters').select('*');
      if (error) {
        console.error('Failed to fetch characters:', error);
        return;
      }
      const parsed = (data || []).map((r) => r.data);
      setCharList(parsed);
    })();
  }, []);

  // --------- central recalc + persist ----------
  const recalcAndPersist = (raw) => {
    const c = deepClone(raw || {});
    c.hpMod = toNum(c.hpMod);
    c.barMod = toNum(c.barMod);
    c.reflexMod = toNum(c.reflexMod);

    // containers for actions
    if (!Array.isArray(c.customActions)) c.customActions = [];
    if (!c.actionOverrides || typeof c.actionOverrides !== 'object') c.actionOverrides = {};

    const base = recalcBase(c);
    const totals = applyDmMods(base, c);
    c.hp = totals.hp;
    c.bar = totals.bar;
    c.reflex = totals.reflex;

    c.currentHp = Math.min(Math.max(0, c.currentHp ?? c.hp), c.hp);
    c.currentBar = Math.min(Math.max(0, c.currentBar ?? c.bar), c.bar);

    setCurrentChar(c);
    saveCharacter(c);
    return c;
  };

  // --------- create flow ----------
  const startCreation = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const passcode = e.target.passcode.value.trim();
    const fruit = e.target.fruit.checked;
    if (!name || passcode.length !== 4) {
      alert('Enter a name and a 4-digit passcode');
      return;
    }
    setNewChar({ name, passcode, fruit });
    setStep(2);
  };

  const chooseRace = (raceKey) => {
    const race = races[raceKey];
    const stats = { ...initStats };
    Object.entries(race.bonuses || {}).forEach(([k, v]) => (stats[k] += v));
    const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null;

    const base = recalcBase({ race: raceKey, stats, level: 1 });
    const totals = applyDmMods(base, {});

    const c = {
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
      meleeBonus: modFromScore(stats.str),
      customActions: [], // [{id, name, barCost}]
      actionOverrides: {}, // { [key]: {mod, deleted} }
    };

    setCharList((prev) => [...prev, c]);
    setCurrentChar(c);
    setEquipment([]);
    setActiveEffects([]);
    setActionPoints(3);
    setScreen('Main');
    setStep(4);
    saveCharacter(c);
  };

  // --------- open/delete from HOME (PIN gate kept) ----------
  const openFromHome = async (char) => {
    const pin = prompt(`Enter 4-digit passcode for ${char.name}`);
    if (pin !== (char.passcode || '')) {
      alert('Incorrect passcode.');
      return;
    }
    const { data, error } = await supabase.from('characters').select('*').eq('id', char.id).single();
    if (error || !data?.data) {
      alert('Could not load character.');
      return;
    }
    const loaded = data.data;
    const fixed = recalcAndPersist(loaded);
    setEquipment(fixed.equipment || []);
    setActiveEffects(fixed.activeEffects || []);
    setActionPoints(3);
    setScreen('Main');
    setStep(4);
  };

  const deleteFromHome = async (char) => {
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    await supabase.from('characters').delete().eq('id', char.id);
    setCharList((prev) => prev.filter((c) => c.id !== char.id));
    if (currentChar?.id === char.id) {
      setCurrentChar(null);
      setStep(1);
    }
  };

  // --------- stat & level ----------
  const increaseStat = (statKey) => {
    if (!currentChar || currentChar.sp <= 0) return;
    const c = deepClone(currentChar);
    c.stats[statKey] = (c.stats[statKey] || 10) + 1;
    c.sp -= 1;
    const base = recalcBase(c);
    const totals = applyDmMods(base, c);
    Object.assign(c, base, totals);
    c.currentHp = Math.min(c.currentHp, c.hp);
    c.currentBar = Math.min(c.currentBar, c.bar);
    setCurrentChar(c);
    saveCharacter(c);
  };

  const levelUp = () => {
    if (!currentChar) return;
    const c = deepClone(currentChar);
    c.level += 1;
    c.sp += 3;
    const base = recalcBase(c);
    const totals = applyDmMods(base, c);
    Object.assign(c, base, totals);
    c.currentHp = c.hp;
    c.currentBar = c.bar;
    setCurrentChar(c);
    saveCharacter(c);
    setActionPoints(3);
  };

  // --------- action sources (equipment/devil fruit/default/custom) ----------
  const equipmentActions = useMemo(() => {
    const names = equipment.filter((e) => e && e.name && e.name !== '').map((e) => e.name);
    const distinct = uniqueBy(names, (n) => n);
    return distinct.map((n) => {
      const meta = equipmentList.find((x) => x.name === n) || {};
      return { name: `Use ${n}`, baseCost: toNum(meta.useCost), _kind: 'equipment', itemName: n };
    });
  }, [equipment]);

  const devilFruitActions = useMemo(() => {
    const fruitName = currentChar?.fruit?.name || '';
    if (!fruitName) return [];
    return getFruitActions(fruitName).map((a) => ({
      name: a.name,
      baseCost: toNum(a.barCost),
      perTurnCost: toNum(a.perTurnCost),
      _kind: 'fruit',
      fruitName,
    }));
  }, [currentChar]);

  const coreActions = useMemo(
    () => defaultActions.map((a) => ({ name: a.name, baseCost: toNum(a.barCost), _kind: 'core' })),
    []
  );

  // ensure custom actions have ids
  const ensureCustomIds = (c) => {
    const next = (c.customActions || []).map((a) => (a.id ? a : { ...a, id: uid() }));
    if (next.length !== (c.customActions || []).length) {
      const nc = { ...c, customActions: next };
      setCurrentChar(nc);
      saveCharacter(nc);
      return next;
    }
    return c.customActions || [];
  };

  const customActions = useMemo(() => {
    if (!currentChar) return [];
    return ensureCustomIds(currentChar).map((a) => ({
      id: a.id,
      name: a.name,
      baseCost: toNum(a.barCost),
      _kind: 'custom',
    }));
  }, [currentChar]);

  // Combine and apply per-action overrides (mod & deleted)
  const actionsToShow = useMemo(() => {
    if (!currentChar) return [];
    const overrides = currentChar.actionOverrides || {};
    const combined = [...coreActions, ...equipmentActions, ...devilFruitActions, ...customActions].map((act) => {
      const key = actionKey(act);
      const ov = overrides[key] || {};
      if (ov.deleted) return null;
      const mod = toNum(ov.mod);
      return {
        ...act,
        key,
        mod,
        cost: Math.max(0, toNum(act.baseCost) + mod),
      };
    });
    return combined.filter(Boolean);
  }, [currentChar, coreActions, equipmentActions, devilFruitActions, customActions]);

  // --------- persistence mirrors ----------
  const persistEquipment = (next) => {
    setEquipment(next);
    if (!currentChar) return;
    const c = { ...currentChar, equipment: next };
    setCurrentChar(c);
    saveCharacter(c);
  };
  const persistEffects = (next) => {
    setActiveEffects(next);
    if (!currentChar) return;
    const c = { ...currentChar, activeEffects: next };
    setCurrentChar(c);
    saveCharacter(c);
  };

  // --------- UI helpers for actions ----------
  const updateMod = (key, value) => {
    if (!currentChar) return;
    const c = deepClone(currentChar);
    const map = { ...(c.actionOverrides || {}) };
    map[key] = { ...(map[key] || {}), mod: toNum(value), deleted: false };
    c.actionOverrides = map;
    setCurrentChar(c);
    saveCharacter(c);
  };

  const deleteAction = (act) => {
    if (!currentChar) return;
    const key = actionKey(act);
    const c = deepClone(currentChar);

    if (act._kind === 'custom') {
      // remove from customActions by id and cleanup override entry
      c.customActions = (c.customActions || []).filter((x) => x.id !== act.id);
      if (c.actionOverrides && c.actionOverrides[key]) {
        const map = { ...c.actionOverrides };
        delete map[key];
        c.actionOverrides = map;
      }
    } else {
      const map = { ...(c.actionOverrides || {}) };
      map[key] = { ...(map[key] || {}), deleted: true };
      c.actionOverrides = map;
    }

    setCurrentChar(c);
    saveCharacter(c);
  };

  const useAction = (act) => {
    if (actionPoints <= 0) return alert('No Action Points left!');
    if (currentChar.currentBar < act.cost) return alert('Not enough Bar!');
    const c = { ...currentChar, currentBar: currentChar.currentBar - act.cost };
    setCurrentChar(c);
    saveCharacter(c);
    setActionPoints((p) => p - 1);

    if (toNum(act.perTurnCost) > 0) {
      const already = activeEffects.some((e) => e.name === act.name);
      if (!already) persistEffects([...activeEffects, { name: act.name, perTurnCost: act.perTurnCost }]);
    }
  };

  // --------- render ---------
  if (step === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <button onClick={() => setStep(1)}>← Back</button>
        <h1>OPDND — Overview</h1>
        <Overview />
      </div>
    );
  }

  if (step === 3) {
    return (
      <DmTools
        charList={charList}
        setCharList={setCharList}
        onBack={() => setStep(1)}
        onOpenSheet={(c) => {
          const fixed = recalcAndPersist(c);
          setEquipment(fixed.equipment || []);
          setActiveEffects(fixed.activeEffects || []);
          setActionPoints(3);
          setScreen('Main');
          setStep(4);
        }}
      />
    );
  }

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
              onChange={(e) => setDamageAmount(toNum(e.target.value))}
              placeholder="Amount"
              style={{ width: '60px' }}
            />
            <button
              onClick={() => {
                const c = { ...currentChar, currentHp: applyDamage(currentChar.currentHp, damageAmount) };
                setCurrentChar(c);
                saveCharacter(c);
              }}
            >
              Take Damage
            </button>
            <button
              onClick={() => {
                const c = { ...currentChar, currentHp: applyHeal(currentChar.currentHp, currentChar.hp, damageAmount) };
                setCurrentChar(c);
                saveCharacter(c);
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
              onChange={(e) => setBarAmount(toNum(e.target.value))}
              placeholder="Amount"
              style={{ width: '60px' }}
            />
            <button
              onClick={() => {
                const c = { ...currentChar, currentBar: spendBar(currentChar.currentBar, barAmount) };
                setCurrentChar(c);
                saveCharacter(c);
              }}
            >
              Use Bar
            </button>
            <button
              onClick={() => {
                const c = { ...currentChar, currentBar: gainBar(currentChar.currentBar, currentChar.bar, barAmount) };
                setCurrentChar(c);
                saveCharacter(c);
              }}
              style={{ marginLeft: '0.5rem' }}
            >
              Regain Bar
            </button>

            <div style={{ marginTop: '1rem' }}>
              <button
                style={{ color: 'crimson', marginRight: '1rem' }}
                onClick={() => {
                  const c = { ...currentChar };
                  c.currentHp = Math.min(c.currentHp + 10, c.hp);
                  c.currentBar = c.bar;
                  setCurrentChar(c);
                  saveCharacter(c);
                }}
              >
                Long Rest
              </button>
              <button
                style={{ color: 'crimson' }}
                onClick={() => {
                  const c = { ...currentChar };
                  const bonus = Math.floor(c.bar * 0.5);
                  c.currentBar = Math.min(c.currentBar + bonus, c.bar);
                  setCurrentChar(c);
                  saveCharacter(c);
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
                const upkeep = activeEffects.reduce((s, e) => s + toNum(e.perTurnCost), 0);
                if (currentChar.currentBar < upkeep) {
                  alert(`Not enough Bar to maintain effects (need ${upkeep}). All effects turned off.`);
                  persistEffects([]);
                  setActionPoints(3);
                  return;
                }
                const c = { ...currentChar, currentBar: currentChar.currentBar - upkeep };
                setCurrentChar(c);
                saveCharacter(c);
                setActionPoints(3);
              }}
            >
              Take Turn
            </button>

            {activeEffects.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.5rem', border: '1px dashed #aaa' }}>
                <strong>Active on Turn</strong>
                {activeEffects.map((eff, i) => (
                  <div key={`eff-${i}`} style={{ marginTop: '0.25rem' }}>
                    {eff.name} — {eff.perTurnCost} Bar
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

            {/* list all actions with Mod + Use + Delete, no "Final:" text */}
            {actionsToShow.map((act) => (
              <div key={act.key} style={{ marginTop: '0.5rem' }}>
                <strong>{act.name}</strong> — Base {toNum(act.baseCost)} Bar
                <span style={{ marginLeft: 10 }}>
                  Mod{' '}
                  <input
                    type="number"
                    value={act.mod || 0}
                    onChange={(e) => updateMod(act.key, e.target.value)}
                    style={{ width: 70 }}
                  />
                </span>
                <button onClick={() => useAction(act)} style={{ marginLeft: '0.75rem' }}>
                  Use
                </button>
                <button onClick={() => deleteAction(act)} style={{ marginLeft: '0.5rem' }}>
                  Delete
                </button>
              </div>
            ))}

            {/* Add custom action */}
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
              onChange={(e) => setNewActionBarCost(toNum(e.target.value))}
              style={{ width: 80, marginRight: '0.5rem' }}
            />
            <button
              onClick={() => {
                const name = newActionName.trim();
                const cost = toNum(newActionBarCost);
                if (!name) return;
                const c = deepClone(currentChar);
                const list = Array.isArray(c.customActions) ? [...c.customActions] : [];
                list.push({ id: uid(), name, barCost: cost });
                c.customActions = list;
                setCurrentChar(c);
                saveCharacter(c);
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
                {devilFruitActions.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <strong>Starting Actions</strong>
                    <ul>
                      {devilFruitActions.map((a) => (
                        <li key={`${a.fruitName}:${a.name}`}>
                          {a.name} — {a.baseCost} Bar{a.perTurnCost ? ` + ${a.perTurnCost}/turn` : ''}
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
                if (currentChar.sp <= 0) return alert('No Skill Points left.');
                const c = { ...currentChar, sp: currentChar.sp - 1 };
                setCurrentChar(c);
                saveCharacter(c);
              }}
            >
              Spend Skill Point
            </button>

            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => {
                  const name = prompt('Skill name?');
                  if (!name) return;
                  const description = prompt('Skill description?') || '';
                  const c = deepClone(currentChar);
                  const next = Array.isArray(c.skills) ? [...c.skills] : [];
                  next.push({ name, description });
                  c.skills = next;
                  setCurrentChar(c);
                  saveCharacter(c);
                }}
              >
                + Add Skill
              </button>
            </div>

            {Array.isArray(currentChar.skills) && currentChar.skills.length > 0 && (
              <ul style={{ marginTop: '1rem' }}>
                {currentChar.skills.map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    <strong>{s.name}</strong>
                    {s.description ? ` — ${s.description}` : ''}
                    <button
                      style={{ marginLeft: '0.5rem' }}
                      onClick={() => {
                        const c = deepClone(currentChar);
                        c.skills = (c.skills || []).filter((_, idx) => idx !== i);
                        setCurrentChar(c);
                        saveCharacter(c);
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  // --------- Home ---------
  return (
    <div style={{ padding: '1rem', position: 'relative', minHeight: '100vh' }}>
      <h1>OPDND</h1>

      {/* Overview */}
      <div style={{ position: 'fixed', right: '1rem', top: '1rem' }}>
        <button style={{ color: 'crimson' }} onClick={() => setStep(0)}>
          Overview
        </button>
      </div>

      <form onSubmit={startCreation}>
        <input name="name" placeholder="Character Name" required />{' '}
        <input name="passcode" placeholder="4-digit Passcode" maxLength={4} required />{' '}
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
              <button onClick={() => openFromHome(char)}>
                {char.name} ({char.race})
              </button>
              <button onClick={() => deleteFromHome(char)} style={{ background: '#fbe9e9', border: '1px solid #e57373' }}>
                Delete
              </button>
            </li>
          ))}
      </ul>

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
