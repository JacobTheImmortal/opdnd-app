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
// NEW: Use your JSON-backed actions first, then fall back to our resilient inline map
import { getFruitActions } from './devilFruitActions';

/* ----------------------------------
   Small helpers
-----------------------------------*/
const PIN_DM = '5637';

async function saveCharacter(character) {
  if (!character || !character.id) return;
  const { error } = await supabase.from('characters').upsert({ id: character.id, data: character });
  if (error) console.error('❌ Error saving character:', error);
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/* Recalc derived stats for level/race/stat changes */
function recalcDerived(char) {
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
  const reflex = (race.reflex || 5) + Math.floor(stats.dex / 5) + Math.floor(level / 3);
  return { hp, bar, reflex };
}

/* Derive a modifier from a raw ability score */
const modFromScore = (score) => Math.floor((Number(score || 10) - 10) / 2);

/* Clamp utility */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n || 0));

/* ----------------------------------
   Devil Fruit action resolution (robust)
-----------------------------------*/

/** Canonicalize fruit names: strip parens like (Logia), collapse spaces, lower-case, remove obvious noise words */
function canonFruitName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')      // remove parenthetical bits like (Logia)
    .replace(/model\s+[a-z]+/g, ' ') // ignore model qualifiers in names
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Inline fallback table keyed by CANONICAL names.
 * Keep these simple numeric costs so they render nicely in Actions/DF tabs.
 * If a cost in your docs is “N actions”, we set barCost to 0 (you can still track AP in the UI).
 */
const FRUIT_ACTIONS_CANON = {
  // tired tired
  'tired tired': [
    { name: 'Sleep Touch', barCost: 10 },
    { name: 'Aura of Exhaust', barCost: 0, perTurnCost: 5 },
  ],

  // air air (was previously requiring "(Logia)" to match)
  'air air': [
    { name: 'Snuff', barCost: 5 },
    { name: 'Siphon', barCost: 0, perTurnCost: 10 },
    { name: 'Flight', barCost: 10 },
    { name: 'PushBack', barCost: 5 },
  ],

  // walk walk
  'walk walk': [],

  // glycer glycer
  'glycer glycer': [
    { name: 'Explode!', barCost: 20 },
    // “Attack Bar + 5 Bar” -> we expose +5 as the explicit bar cost piece
    { name: 'Crackle Fist', barCost: 5 },
    { name: 'Coat', barCost: 5 },
  ],

  // survive survive
  'survive survive': [{ name: 'Affliction absorption', barCost: 20 }],

  // twin twin (3 Actions in docs -> 0 bar; AP handled by UI)
  'twin twin': [{ name: 'Body maker', barCost: 0 }],

  // water water
  'water water': [
    { name: 'Water Ball', barCost: 5 },
    { name: 'Shape Water', barCost: 0, perTurnCost: 5 },
    { name: 'Separate', barCost: 5 },
    { name: 'Moisture Grab', barCost: 5 },
  ],

  // sound sound
  'sound sound': [
    { name: 'Auditory effect', barCost: 2 },
    { name: 'Silence', barCost: 5 },
    { name: 'Amp Up', barCost: 10 },
  ],

  // dance dance (3 Actions in docs -> 0 bar; AP handled by UI)
  'dance dance': [{ name: 'Disco Time', barCost: 0 }],

  // race race
  'race race': [{ name: 'Race Change', barCost: 20 }],

  // bear bear model panda
  'bear bear panda': [
    { name: 'HumanLike', barCost: 0 },
    { name: 'Half Panda', barCost: 0, perTurnCost: 5 },
    { name: 'Full Panda', barCost: 0, perTurnCost: 5 },
  ],

  // state state
  'state state': [{ name: 'State Change', barCost: 15 }],

  // sit sit
  'sit sit': [{ name: 'Sit!', barCost: 10 }],

  // cellar cellar
  'cellar cellar': [
    { name: 'Cellar Door', barCost: 20 },
    { name: 'Cellar Reset', barCost: 20 },
  ],

  // rage rage
  'rage rage': [{ name: 'Enrage', barCost: 0, perTurnCost: 10 }],

  // potion potion
  'potion potion': [{ name: 'Apply Effect', barCost: 15 }],

  // rat rat (no explicit actions in docs)
  'rat rat': [],

  // phobia phobia
  'phobia phobia': [
    { name: 'Nightmare', barCost: 10 },
    { name: 'Phobia Man', barCost: 10, perTurnCost: 5 },
    { name: 'Overwhelm', barCost: 20 },
  ],

  // reality reality
  'reality reality': [
    { name: 'CUT!', barCost: 20 },
    { name: 'Question', barCost: 30 },
    { name: 'Look away', barCost: 30 },
  ],

  // command command
  'command command': [{ name: 'Issue Command', barCost: 10 }],

  // vector vector
  'vector vector': [],

  // pavo pavo
  'pavo pavo': [],

  // hurt hurt
  'hurt hurt': [{ name: 'Spawn Woman', barCost: 50 }],
};

/** Given a raw fruit name, return a normalized list of action objects */
function resolveFruitActions(rawName) {
  if (!rawName) return [];
  const canonical = canonFruitName(rawName);

  // 1) Try JSON-backed source first (devilFruitActions.js)
  let fromJson = getFruitActions(rawName);
  if (!fromJson || fromJson.length === 0) {
    // also try canonical key in case your JSON keys are already canonical
    fromJson = getFruitActions(canonical);
  }
  if (fromJson && fromJson.length > 0) return fromJson.map(a => ({
    name: a.name,
    barCost: Number(a.barCost) || 0,
    perTurnCost: Number(a.perTurnCost) || 0,
  }));

  // 2) Fallback to inline canonical map
  if (FRUIT_ACTIONS_CANON[canonical]) {
    return FRUIT_ACTIONS_CANON[canonical].map(a => ({
      name: a.name,
      barCost: Number(a.barCost) || 0,
      perTurnCost: Number(a.perTurnCost) || 0,
    }));
  }

  // 3) Last resort: try a few easy alias shapes
  const easyAliases = [
    canonical.replace(/\s*logia\s*$/i, '').trim(),
    canonical.replace(/\s*model\s+\w+$/i, '').trim(),
  ].filter(Boolean);

  for (const alias of easyAliases) {
    if (FRUIT_ACTIONS_CANON[alias]) {
      return FRUIT_ACTIONS_CANON[alias].map(a => ({
        name: a.name,
        barCost: Number(a.barCost) || 0,
        perTurnCost: Number(a.perTurnCost) || 0,
      }));
    }
  }
  return [];
}

/* ----------------------------------
   App
-----------------------------------*/
export default function App() {
  // ----- Top-level state -----
  const [step, setStep] = useState(1); // 0: Overview, 1: Home, 2: Choose Race, 3: DevTools, 4: Sheet
  const [charList, setCharList] = useState([]);
  const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false });
  const [currentChar, setCurrentChar] = useState(null);

  // sheet UI state
  const [screen, setScreen] = useState('Main');
  const [damageAmount, setDamageAmount] = useState(0);
  const [barAmount, setBarAmount] = useState(0);
  const [actionPoints, setActionPoints] = useState(3);
  const [customActions, setCustomActions] = useState([]);

  // equipment mirror for sheet
  const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);
  const [activeEffects, setActiveEffects] = useState([]); // [{ name, perTurnCost }]

  // small inputs
  const [newActionName, setNewActionName] = useState('');
  const [newActionBarCost, setNewActionBarCost] = useState(0);

  // DM tools expanded rows (id -> boolean)
  const [dmExpanded, setDmExpanded] = useState({});

  // ----- Constants -----
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

  /* ----------------------------------
     Load characters (no auto-open)
  -----------------------------------*/
  useEffect(() => {
    const fetchCharacters = async () => {
      const { data, error } = await supabase.from('characters').select('*');
      if (error) {
        console.error('Failed to fetch characters:', error);
        return;
      }
      if (data) {
        const parsed = data.map((row) => row.data);
        setCharList(parsed);
      }
    };
    fetchCharacters();
  }, []);

  /* ----------------------------------
     Loader for a specific character
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

  /* ----------------------------------
     Create → choose race
  -----------------------------------*/
  const startCreation = (e) => {
    e.preventDefault();
    const { name, fruit, passcode } = {
      name: e.target.name.value.trim(),
      fruit: e.target.fruit.checked,
      passcode: e.target.passcode.value.trim(),
    };
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
    const level = 1;
    const derived = calculateDerived(stats, level, race);
    const char = {
      ...newChar,
      id: Date.now().toString(),
      race: raceKey,
      stats,
      level,
      sp: race.sp,
      ...derived,
      fruit,
      currentHp: derived.hp,
      currentBar: derived.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: false,
      meleeText: '1d6',
      meleeBonus: modFromScore(stats.str || 10),
    };
    setCharList((prev) => [...prev, char]);
    setCurrentChar(char);
    setEquipment([]);
    setActiveEffects([]);
    setActionPoints(3);
    setScreen('Main');
    setStep(4);
    saveCharacter(char);
  };

  /* ----------------------------------
     Enter / delete from Home
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
    setCharList((prev) => prev.filter((c) => c.id !== char.id));
    if (currentChar?.id === char.id) {
      setCurrentChar(null);
      setStep(1);
    }
  };

  /* ----------------------------------
     Sheet: Stats & level
  -----------------------------------*/
  const increaseStat = (stat) => {
    if (!currentChar || currentChar.sp <= 0) return;
    const updated = deepClone(currentChar);
    updated.stats[stat]++;
    updated.sp--;
    const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
    Object.assign(updated, derived);
    updated.currentHp = Math.min(updated.currentHp, derived.hp);
    updated.currentBar = Math.min(updated.currentBar, derived.bar);
    setCurrentChar(updated);
    saveCharacter(updated);
  };

  const levelUp = () => {
    if (!currentChar) return;
    const updated = deepClone(currentChar);
    updated.level++;
    updated.sp += 3; // level up grants 3 SP
    const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
    Object.assign(updated, derived);
    updated.currentHp = derived.hp;
    updated.currentBar = derived.bar;
    setCurrentChar(updated);
    saveCharacter(updated);
    setActionPoints(3);
  };

  /* ----------------------------------
     Equipment → Actions bridge
  -----------------------------------*/
  const equipmentActions = useMemo(() => {
    const names = equipment.filter((it) => it && it.name && it.name !== '').map((it) => it.name);
    const distinct = uniqueBy(names, (n) => n);
    return distinct.map((n) => {
      const meta = equipmentList.find((e) => e.name === n) || {};
      const cost = Number(meta.useCost) || 0; // default 0
      return { name: `Use ${n}`, barCost: cost, _kind: 'equipment', itemName: n };
    });
  }, [equipment]);

  /* ----------------------------------
     Devil Fruit → Actions bridge (robust)
  -----------------------------------*/
  const devilFruitActions = useMemo(() => {
    const fruitName = currentChar?.fruit?.name;
    if (!fruitName) return [];
    // Resolve via JSON first, then robust fallback table
    const list = resolveFruitActions(fruitName);
    return list.map((a) => ({
      name: a.name,
      barCost: Number(a.barCost) || 0,
      _kind: 'devilFruit',
      perTurnCost: Number(a.perTurnCost) || 0,
    }));
  }, [currentChar]);

  const actionsToShow = useMemo(
    () => [...defaultActions, ...equipmentActions, ...devilFruitActions, ...customActions],
    [equipmentActions, devilFruitActions, customActions]
  );

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
     Admin / DM tools helpers (inline)
  -----------------------------------*/
  const adminDelete = async (char) => {
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) {
      alert('Delete failed.');
      return;
    }
    setCharList((prev) => prev.filter((c) => c.id !== char.id));
  };

  const adminCopy = async (char) => {
    const clone = { ...deepClone(char), id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`, name: `${char.name} (Copy)` };
    const { error } = await supabase.from('characters').insert({ id: clone.id, data: clone });
    if (error) {
      alert('Copy failed.');
      return;
    }
    setCharList((prev) => [...prev, clone]);
  };

  const adminLevelAdjust = async (char, delta) => {
    const updated = deepClone(char);
    updated.level = Math.max(1, (updated.level || 1) + delta);
    // grant/consume SP when changing level from DM controls
    updated.sp = (updated.sp || 0) + (delta > 0 ? 3 : -3 * Math.min(1, Math.abs(delta))); // -3 per level down
    const derived = recalcDerived(updated);
    Object.assign(updated, derived);
    updated.currentHp = Math.min(updated.currentHp ?? derived.hp, derived.hp);
    updated.currentBar = Math.min(updated.currentBar ?? derived.bar, derived.bar);
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) {
      alert('Level change failed.');
      return;
    }
    setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const adminSpAdjust = async (char, delta) => {
    const updated = deepClone(char);
    updated.sp = Math.max(0, (updated.sp || 0) + delta);
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) {
      alert('SP change failed.');
      return;
    }
    setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const adminModifyFruit = async (char) => {
    const current = char.fruit?.name || '';
    const names = devilFruits.map((f) => f.name).join(', ');
    const input = prompt(`Enter Devil Fruit name (or type 'none' to remove)\nAvailable: ${names}`, current);
    if (input === null) return;
    const trimmed = input.trim();
    const updated = deepClone(char);
    if (!trimmed || trimmed.toLowerCase() === 'none') updated.fruit = null;
    else {
      const found = devilFruits.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
      if (!found) {
        alert('Fruit not found.');
        return;
      }
      updated.fruit = { name: found.name, ability: found.ability };
    }
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) {
      alert('Update failed.');
      return;
    }
    setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const adminOpenSheet = async (char) => {
    setCurrentChar(char);
    setEquipment(char.equipment || []);
    setActiveEffects(char.activeEffects || []);
    setActionPoints(3);
    setScreen('Main');
    setStep(4);
  };

  const toggleHidden = async (char) => {
    const updated = { ...char, hidden: !char.hidden };
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (!error) setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const createCustom = async () => {
    const name = (prompt('Name for character?') || '').trim();
    if (!name) return;
    const raceNames = Object.keys(races);
    const racePick = prompt(`Choose race (exact):\n${raceNames.join(', ')}`, raceNames[0]) || raceNames[0];
    if (!races[racePick]) {
      alert('Race not found.');
      return;
    }
    const fruitInput = prompt(`Devil Fruit name (or 'none')?`, 'none') || 'none';
    const hiddenAns = (prompt(`Hidden? (yes/no)`, 'no') || 'no').toLowerCase().startsWith('y');
    const passcode = (prompt('4-digit passcode (for player view)?', '0000') || '0000').slice(0, 4);

    const baseStats = deepClone(initStats);
    const race = races[racePick];
    Object.entries(race.bonuses || {}).forEach(([k, v]) => (baseStats[k] += v));

    const derived = calculateDerived(baseStats, 1, race);
    const fruit =
      fruitInput.toLowerCase() === 'none'
        ? null
        : (() => {
            const f = devilFruits.find((df) => df.name.toLowerCase() === fruitInput.toLowerCase());
            if (!f) return null;
            return { name: f.name, ability: f.ability };
          })();

    const char = {
      id: Date.now().toString(),
      name,
      passcode,
      race: racePick,
      stats: baseStats,
      level: 1,
      sp: race.sp,
      ...derived,
      fruit,
      currentHp: derived.hp,
      currentBar: derived.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: hiddenAns,
      meleeText: '1d6',
      meleeBonus: modFromScore(baseStats.str),
    };
    const { error } = await supabase.from('characters').insert({ id: char.id, data: char });
    if (error) {
      alert('Create failed.');
      return;
    }
    setCharList((prev) => [...prev, char]);
  };

  const createRandom = async () => {
    const raceNames = Object.keys(races);
    const racePick = raceNames[Math.floor(Math.random() * raceNames.length)];
    const race = races[racePick];
    const baseStats = deepClone(initStats);
    Object.entries(race.bonuses || {}).forEach(([k, v]) => (baseStats[k] += v));
    // small random wiggle
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((k) => (baseStats[k] = clamp(baseStats[k] + Math.floor(Math.random() * 5) - 2, 6, 20)));
    const derived = calculateDerived(baseStats, 1, race);
    const fruit = Math.random() > 0.6 ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null;
    const char = {
      id: Date.now().toString(),
      name: `NPC ${Math.floor(Math.random() * 900 + 100)}`,
      passcode: '0000',
      race: racePick,
      stats: baseStats,
      level: 1,
      sp: race.sp,
      ...derived,
      fruit: fruit ? { name: fruit.name, ability: fruit.ability } : null,
      currentHp: derived.hp,
      currentBar: derived.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: (prompt('Create as hidden? (yes/no)', 'yes') || 'yes').toLowerCase().startsWith('y'),
      meleeText: '1d6',
      meleeBonus: modFromScore(baseStats.str),
    };
    const { error } = await supabase.from('characters').insert({ id: char.id, data: char });
    if (error) {
      alert('Create failed.');
      return;
    }
    setCharList((prev) => [...prev, char]);
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

  // DEV TOOLS (inline here; your project also has a DmTools.jsx version if you wish to swap)
  if (step === 3) {
    const toggleExpand = (id) => setDmExpanded((m) => ({ ...m, [id]: !m[id] }));

    const saveInline = async (updated) => {
      const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
      if (!error) {
        setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    };

    const setNumField = (char, field, value) => {
      const updated = deepClone(char);
      updated[field] = Number(value || 0);
      saveInline(updated);
    };
    const nudgeNumField = (char, field, delta) => {
      const updated = deepClone(char);
      updated[field] = Number(updated[field] || 0) + delta;
      saveInline(updated);
    };

    const setMeleeText = (char, text) => {
      const updated = deepClone(char);
      updated.meleeText = (text || '1d6').trim();
      saveInline(updated);
    };
    const setMeleeBonus = (char, v) => setNumField(char, 'meleeBonus', v);

    const adjustMod = (char, statKey, delta) => {
      const updated = deepClone(char);
      updated.stats[statKey] = clamp((updated.stats[statKey] || 10) + delta * 2, 1, 30);
      const derived = recalcDerived(updated);
      Object.assign(updated, derived);
      updated.currentHp = Math.min(updated.currentHp ?? derived.hp, derived.hp);
      updated.currentBar = Math.min(updated.currentBar ?? derived.bar, derived.bar);
      saveInline(updated);
    };

    return (
      <div style={{ padding: '1rem' }}>
        <button onClick={() => setStep(1)}>← Back</button>
        <h1>Dungeon Master Tools</h1>
        <div style={{ marginBottom: 12 }}>
          <button onClick={createCustom} style={{ marginRight: 8 }}>
            Create Custom
          </button>
          <button onClick={createRandom}>Create Random</button>
        </div>

        <p style={{ color: '#666' }}>Administer characters below.</p>

        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {charList.map((char) => (
            <li key={char.id} style={{ marginBottom: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => toggleExpand(char.id)} style={{ minWidth: 260, textAlign: 'left' }}>
                  {char.name} ({char.race}) (Level {char.level})
                </button>
                <button onClick={() => adminDelete(char)} style={{ background: '#fdeaea' }}>
                  Delete
                </button>
                <button onClick={() => adminCopy(char)}>Copy</button>
                <button onClick={() => adminLevelAdjust(char, +1)}>Lvl +</button>
                <button onClick={() => adminLevelAdjust(char, -1)}>Lvl -</button>
                <button onClick={() => adminSpAdjust(char, +1)}>SP +</button>
                <button onClick={() => adminSpAdjust(char, -1)}>SP -</button>
                <button onClick={() => adminModifyFruit(char)}>Modify DevilFruit</button>
                <button onClick={() => adminOpenSheet(char)}>View Sheet</button>
                <label style={{ marginLeft: 8 }}>
                  <input type="checkbox" checked={!!char.hidden} onChange={() => toggleHidden(char)} /> Hidden
                </label>
              </div>

              {dmExpanded[char.id] && (
                <div style={{ border: '1px solid #ddd', padding: 12, marginTop: 8, borderRadius: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: 12 }}>
                    <div>
                      <h4 style={{ marginTop: 0 }}>Core</h4>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Max Health:</strong>{' '}
                        <input
                          style={{ width: 80 }}
                          type="number"
                          value={char.hp || 0}
                          onChange={(e) => setNumField(char, 'hp', Number(e.target.value))}
                        />
                        <button onClick={() => nudgeNumField(char, 'hp', +1)} style={{ marginLeft: 6 }}>
                          +
                        </button>
                        <button onClick={() => nudgeNumField(char, 'hp', -1)} style={{ marginLeft: 4 }}>
                          -
                        </button>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Max Bar:</strong>{' '}
                        <input
                          style={{ width: 80 }}
                          type="number"
                          value={char.bar || 0}
                          onChange={(e) => setNumField(char, 'bar', Number(e.target.value))}
                        />
                        <button onClick={() => nudgeNumField(char, 'bar', +5)} style={{ marginLeft: 6 }}>
                          +5
                        </button>
                        <button onClick={() => nudgeNumField(char, 'bar', -5)} style={{ marginLeft: 4 }}>
                          -5
                        </button>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Reflex:</strong>{' '}
                        <input
                          style={{ width: 80 }}
                          type="number"
                          value={char.reflex || 0}
                          onChange={(e) => setNumField(char, 'reflex', Number(e.target.value))}
                        />
                        <button onClick={() => nudgeNumField(char, 'reflex', +1)} style={{ marginLeft: 6 }}>
                          +
                        </button>
                        <button onClick={() => nudgeNumField(char, 'reflex', -1)} style={{ marginLeft: 4 }}>
                          -
                        </button>
                      </div>

                      <h4>Melee</h4>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Dice:</strong>{' '}
                        <input
                          style={{ width: 100 }}
                          value={char.meleeText || '1d6'}
                          onChange={(e) => setMeleeText(char, e.target.value)}
                        />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>Bonus:</strong>{' '}
                        <input
                          style={{ width: 80 }}
                          type="number"
                          value={Number(char.meleeBonus || 0)}
                          onChange={(e) => setMeleeBonus(char, Number(e.target.value))}
                        />
                        <span style={{ marginLeft: 6, color: '#555' }}>
                          (Sheet shows: {char.meleeText || '1d6'} + {Number(char.meleeBonus || 0)})
                        </span>
                      </div>

                      <h4>Skill Points</h4>
                      <div>
                        <input
                          style={{ width: 80 }}
                          type="number"
                          value={Number(char.sp || 0)}
                          onChange={(e) => setNumField(char, 'sp', Number(e.target.value))}
                        />
                        <button onClick={() => adminSpAdjust(char, +1)} style={{ marginLeft: 6 }}>
                          SP +
                        </button>
                        <button onClick={() => adminSpAdjust(char, -1)} style={{ marginLeft: 4 }}>
                          SP -
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 style={{ marginTop: 0 }}>Ability Modifiers (DM view)</h4>
                      {['cha', 'con', 'dex', 'int', 'str', 'wis'].map((k) => {
                        const currentScore = char.stats?.[k] ?? 10;
                        const currentMod = modFromScore(currentScore);
                        return (
                          <div key={k} style={{ marginBottom: 8 }}>
                            <strong style={{ textTransform: 'uppercase' }}>{k}</strong>: {currentMod}{' '}
                            <button onClick={() => adjustMod(char, k, +1)} style={{ marginLeft: 6 }}>
                              +
                            </button>
                            <button onClick={() => adjustMod(char, k, -1)} style={{ marginLeft: 4 }}>
                              -
                            </button>
                            <span style={{ marginLeft: 8, color: '#666' }}>
                              (score {currentScore}, mod changes ±1 adjust score ±2)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
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
          <strong>HP:</strong> {currentChar.currentHp} / {currentChar.hp} | <strong>Bar:</strong> {currentChar.currentBar} /{' '}
          {currentChar.bar}{' '}
          | <strong>Reflex:</strong> {currentChar.reflex} | <strong>Melee:</strong>{' '}
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

            {actionsToShow.map((action, i) => (
              <div key={`${action.name}-${i}`} style={{ marginTop: '0.5rem' }}>
                <strong>{action.name}</strong> – {action.barCost} Bar
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
              style={{ width: '60px', marginRight: '0.5rem' }}
            />
            <button
              onClick={() => {
                if (!newActionName) return;
                setCustomActions((prev) => [...prev, { name: newActionName, barCost: newActionBarCost }]);
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
                {devilFruitActions.length === 0 && (
                  <p style={{ color: '#a00' }}>
                    No starting actions found for this fruit. (Name matching is robust now — if you still
                    see this, check JSON keys in <code>devilFruitActions.json</code>.)
                  </p>
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