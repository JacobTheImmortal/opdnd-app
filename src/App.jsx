import React, { useEffect, useMemo, useState } from 'react'; import { supabase } from './supabaseClient'; import { races } from './races'; import { devilFruits } from './devilFruits'; import { calculateMaxHealth, applyDamage, applyHeal } from './healthUtils'; import { calculateMaxBar, spendBar, gainBar } from './barUtils'; import { defaultActions } from './actionsUtils'; import EquipmentSheet from './EquipmentSheet'; import { equipmentList } from './equipmentData'; import Overview from './Overview';

/* ---------------------------------- Helpers -----------------------------------*/ async function saveCharacter(character) { if (!character || !character.id) return; const { error } = await supabase .from('characters') .upsert({ id: character.id, data: character }); if (error) console.error('❌ Error saving character:', error); }

function uniqueBy(arr, keyFn) { const seen = new Set(); return arr.filter(item => { const k = keyFn(item); if (seen.has(k)) return false; seen.add(k); return true; }); }

export default function App() { // ----- Top-level state ----- const [step, setStep] = useState(1); // 1: Home, 2: Choose Race, 4: Sheet, 'overview', 'dev' const [charList, setCharList] = useState([]); const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false }); const [currentChar, setCurrentChar] = useState(null);

// sheet UI state const [screen, setScreen] = useState('Main'); const [damageAmount, setDamageAmount] = useState(0); const [barAmount, setBarAmount] = useState(0); const [actionPoints, setActionPoints] = useState(3); const [customActions, setCustomActions] = useState([]);

// equipment local mirror (also persisted into currentChar.equipment) const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);

const [newActionName, setNewActionName] = useState(''); const [newActionBarCost, setNewActionBarCost] = useState(0);

// Active, persistent effects (deducted at start of turn) const [activeEffects, setActiveEffects] = useState([]); // [{ name, perTurnCost }]

// ----- Constants ----- const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

const calculateDerived = (stats, level = 1, race = {}) => { const baseHP = race.hp || 20; const baseBar = race.bar || 100; const con = stats.con || 10; const int = stats.int || 10; const wis = stats.wis || 10; const hp = calculateMaxHealth(baseHP, con, level); const bar = calculateMaxBar(baseBar, int, wis, level); const reflex = (race.reflex || 5) + Math.floor(stats.dex / 5) + Math.floor(level / 3); return { hp, bar, reflex }; };

/* ---------------------------------- Load characters (no auto-open) -----------------------------------/ useEffect(() => { const fetchCharacters = async () => { const { data, error } = await supabase.from('characters').select(''); if (error) { console.error('Failed to fetch characters:', error); return; } if (data) { const parsed = data.map(row => row.data); setCharList(parsed); } }; fetchCharacters(); }, []);

/* ---------------------------------- Loader (scoped so it can set state) -----------------------------------/ const loadCharacter = async (id) => { const { data, error } = await supabase .from('characters') .select('') .eq('id', id) .single(); if (error) { console.error('❌ Error loading character:', error); return; } if (data && data.data) { const loaded = data.data; setCurrentChar(loaded); setEquipment(loaded.equipment && Array.isArray(loaded.equipment) && loaded.equipment.length ? loaded.equipment : [{ name: '', quantity: 1, customDesc: '' }]); setActionPoints(3); setActiveEffects(loaded.activeEffects || []); setStep(4); } };

/* ---------------------------------- Create → choose race -----------------------------------*/ const startCreation = (e) => { e.preventDefault(); const { name, fruit, passcode } = { name: e.target.name.value.trim(), fruit: e.target.fruit.checked, passcode: e.target.passcode.value.trim(), }; if (!name || passcode.length !== 4) { alert('Enter a name and a 4-digit passcode'); return; } setNewChar({ name, passcode, fruit }); setStep(2); };

const chooseRace = (raceKey) => { const race = races[raceKey]; const stats = { ...initStats }; Object.entries(race.bonuses || {}).forEach(([k, v]) => (stats[k] += v)); const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null; const level = 1; const derived = calculateDerived(stats, level, race); const char = { ...newChar, id: Date.now().toString(), race: raceKey, stats, level, sp: race.sp, ...derived, fruit, currentHp: derived.hp, currentBar: derived.bar, equipment: [], activeEffects: [], skills: [], }; setCharList(prev => [...prev, char]); setCurrentChar(char); setEquipment([]); setActiveEffects([]); setActionPoints(3); setStep(4); saveCharacter(char); };

/* ---------------------------------- Enter / delete -----------------------------------*/ const enterChar = async (char) => { const pass = prompt('Enter 4-digit passcode'); if (pass === char.passcode) { await loadCharacter(char.id); } else { alert('Incorrect passcode'); } };

const deleteCharacter = async (char) => { const pass = prompt(Enter 4-digit passcode to DELETE "${char.name}"); if (pass !== char.passcode) { alert('Incorrect passcode'); return; } if (!confirm(Delete ${char.name}? This cannot be undone.)) return; const { error } = await supabase.from('characters').delete().eq('id', char.id); if (error) { console.error('❌ Error deleting character:', error); alert('Failed to delete character.'); return; } setCharList(prev => prev.filter(c => c.id !== char.id)); if (currentChar?.id === char.id) { setCurrentChar(null); setStep(1); } };

/* ---------------------------------- Stats & level -----------------------------------*/ const increaseStat = (stat) => { if (!currentChar || currentChar.sp <= 0) return; const updated = { ...currentChar }; updated.stats[stat]++; updated.sp--; const derived = calculateDerived(updated.stats, updated.level, races[updated.race]); Object.assign(updated, derived); updated.currentHp = Math.min(updated.currentHp, derived.hp); updated.currentBar = Math.min(updated.currentBar, derived.bar); setCurrentChar(updated); saveCharacter(updated); };

const levelUp = () => { if (!currentChar) return; const updated = { ...currentChar }; updated.level++; updated.sp += 3; const derived = calculateDerived(updated.stats, updated.level, races[updated.race]); Object.assign(updated, derived); updated.currentHp = derived.hp; updated.currentBar = derived.bar; setCurrentChar(updated); saveCharacter(updated); setActionPoints(3); };

/* ---------------------------------- Equipment → Actions bridge (useCost only) -----------------------------------*/ const equipmentActions = useMemo(() => { const names = equipment .filter(it => it && it.name && it.name !== '') .map(it => it.name); const distinct = uniqueBy(names, n => n); return distinct.map(n => { const meta = equipmentList.find(e => e.name === n) || {}; const cost = Number(meta.useCost) || 0; // default to 0 if not set return { name: Use ${n}, barCost: cost, _kind: 'equipment', itemName: n, }; }); }, [equipment]);

/* ---------------------------------- Devil Fruit → Actions bridge (inline subset for now) -----------------------------------*/ const FRUIT_ACTIONS = useMemo(() => ({ 'Air Air(Logia)': [ { name: 'Snuff', barCost: 5 }, { name: 'Siphon', barCost: 0, perTurnCost: 10 }, { name: 'Flight', barCost: 10 }, { name: 'PushBack', barCost: 5 }, ], 'Tired Tired': [ { name: 'Sleep Touch', barCost: 10 }, { name: 'Aura of Exhaust', barCost: 0, perTurnCost: 5 }, ], 'Water Water': [ { name: 'Water Ball', barCost: 5 }, { name: 'Shape Water', barCost: 0, perTurnCost: 5 }, { name: 'Separate', barCost: 5 }, { name: 'Moisture Grab', barCost: 5 }, ], 'Phobia Phobia': [ { name: 'Nightmare', barCost: 10 }, { name: 'Phobia Man', barCost: 10, perTurnCost: 5 }, { name: 'Overwhelm', barCost: 20 }, ], 'Rage Rage': [ { name: 'Enrage', barCost: 0, perTurnCost: 10 }, ], 'Bear Bear Model Panda': [ { name: 'HumanLike', barCost: 0 }, { name: 'Half Panda', barCost: 0, perTurnCost: 5 }, { name: 'Full Panda', barCost: 0, perTurnCost: 5 }, ], 'State State': [ { name: 'State Change', barCost: 15 }, ], 'Dance Dance': [ { name: 'Disco Time', barCost: 0 } ], 'Walk Walk': [ ], }), []);

const devilFruitActions = useMemo(() => { const fruitName = currentChar?.fruit?.name; if (!fruitName) return []; const list = FRUIT_ACTIONS[fruitName] || []; return list.map(a => ({ name: a.name, barCost: Number(a.barCost) || 0, _kind: 'devilFruit', perTurnCost: Number(a.perTurnCost) || 0, })); }, [currentChar, FRUIT_ACTIONS]);

const actionsToShow = useMemo( () => [...defaultActions, ...equipmentActions, ...devilFruitActions, ...customActions], [equipmentActions, devilFruitActions, customActions] );

const persistEquipment = (updated) => { setEquipment(updated); if (!currentChar) return; const updatedChar = { ...currentChar, equipment: updated }; setCurrentChar(updatedChar); saveCharacter(updatedChar); };

const persistEffects = (updated) => { setActiveEffects(updated); if (!currentChar) return; const updatedChar = { ...currentChar, activeEffects: updated }; setCurrentChar(updatedChar); saveCharacter(updatedChar); };

const addSkill = () => { const name = prompt('Enter skill name'); const desc = prompt('Enter skill description'); if (!name) return; const updated = { ...currentChar }; updated.skills = [...(updated.skills || []), { name, desc }]; setCurrentChar(updated); saveCharacter(updated); };

/* ---------------------------------- HOME (step 1) -----------------------------------*/ if (step === 1) { return ( <div style={{ padding: '1rem', position: 'relative' }}> <h1>OPDND</h1>

{/* Overview button (top-right) */}
    <button
      style={{ position: 'fixed', right: 16, top: 16, color: '#d33' }}
      onClick={() => setStep('overview')}
    >
      Overview
    </button>

    {/* Dev page button (bottom-left) */}
    <button
      style={{ position: 'fixed', left: 16, bottom: 16, color: '#d33' }}
      onClick={() => {
        const pin = prompt('Enter 4-digit PIN');
        if (pin === '5637') setStep('dev');
        else alert('Wrong PIN');
      }}
    >
      DevTool Mode
    </button>

    <form onSubmit={startCreation} style={{ marginBottom: '1rem' }}>
      <input name="name" placeholder="Character Name" />{' '}
      <input name="passcode" placeholder="4-digit Passcode" maxLength={4} />{' '}
      <label style={{ marginRight: '0.5rem' }}>
        <input name="fruit" type="checkbox" /> Start with Devil Fruit?
      </label>
      <button type="submit">Create</button>
    </form>

    <h2>Characters</h2>
    <ul>
      {charList.map((c) => (
        <li key={c.id} style={{ marginBottom: 6 }}>
          <button onClick={() => enterChar(c)}>{c.name} ({c.race})</button>{' '}
          <button onClick={() => deleteCharacter(c)} style={{ color: '#b33', marginLeft: 6 }}>Delete</button>
        </li>
      ))}
    </ul>
  </div>
);

}

/* ---------------------------------- OVERVIEW (step: 'overview') -----------------------------------*/ if (step === 'overview') { return <Overview onBack={() => setStep(1)} />; }

/* ---------------------------------- DEV TOOLS (step: 'dev') — minimal list for now -----------------------------------*/ if (step === 'dev') { const levelAdjust = async (char, delta) => { const updated = { ...char, level: Math.max(1, (char.level || 1) + delta) }; const derived = calculateDerived(updated.stats, updated.level, races[updated.race]); Object.assign(updated, derived); updated.currentHp = Math.min(updated.currentHp, updated.hp); updated.currentBar = Math.min(updated.currentBar, updated.bar); setCharList(prev => prev.map(c => (c.id === updated.id ? updated : c))); await saveCharacter(updated); };

const cloneChar = async (char) => {
  const copy = { ...char, id: Date.now().toString(), name: char.name + ' (Copy)' };
  setCharList(prev => [...prev, copy]);
  await saveCharacter(copy);
};

const modifyFruit = async (char) => {
  const name = prompt('Enter Devil Fruit name (or "none")', char.fruit?.name || '');
  const updated = { ...char };
  if (!name || name.toLowerCase() === 'none') updated.fruit = null;
  else updated.fruit = { name };
  setCharList(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  await saveCharacter(updated);
};

return (
  <div style={{ padding: '1rem' }}>
    <button onClick={() => setStep(1)}>← Back</button>
    <h2>Dungeon Master Tools</h2>
    <ul>
      {charList.map(c => (
        <li key={c.id} style={{ marginBottom: 8 }}>
          <span>{c.name} ({c.race})</span>{' '}
          <button onClick={() => deleteCharacter(c)} style={{ marginLeft: 8 }}>Delete</button>{' '}
          <button onClick={() => cloneChar(c)}>Copy</button>{' '}
          <button onClick={() => levelAdjust(c, +1)}>Lvl +</button>{' '}
          <button onClick={() => levelAdjust(c, -1)}>Lvl -</button>{' '}
          <button onClick={() => modifyFruit(c)}>Modify DevilFruit</button>
        </li>
      ))}
    </ul>
  </div>
);

}

/* ---------------------------------- CHARACTER SHEET (step 4) -----------------------------------*/ if (step === 4 && currentChar) { return ( <div style={{ padding: '1rem' }}> <button onClick={() => { setCurrentChar(null); setStep(1); }}>← Back</button>

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

        {/* Rests */}
        <div style={{ marginTop: '0.75rem' }}>
          <button onClick={() => {
            const updated = { ...currentChar };
            updated.currentHp = Math.min(updated.hp, updated.currentHp + 10);
            updated.currentBar = updated.bar;
            setCurrentChar(updated);
            saveCharacter(updated);
          }} style={{ color: '#b33', marginRight: 10 }}>Long Rest</button>

          <button onClick={() => {
            const updated = { ...currentChar };
            const half = Math.floor(updated.bar * 0.5);
            updated.currentBar = Math.min(updated.bar, updated.currentBar + half);
            setCurrentChar(updated);
            saveCharacter(updated);
          }} style={{ color: '#b33' }}>Short Rest</button>
        </div>
      </>
    )}

    {screen === 'Equipment' && (
      <EquipmentSheet
        equipment={equipment}
        onChange={persistEquipment}
        equipmentList={equipmentList}
      />
    )}

    {screen === 'Actions' && (
      <div>
        <h3>Actions</h3>
        <p>Action Points: {actionPoints}</p>
        <button onClick={() => {
          // start of turn: reset AP to 3 and pay per-turn effects
          let total = 0;
          activeEffects.forEach(e => { total += Number(e.perTurnCost) || 0; });
          const updated = { ...currentChar };
          updated.currentBar = spendBar(updated.currentBar, total);
          setCurrentChar(updated);
          saveCharacter(updated);
          setActionPoints(3);
        }}>Take Turn</button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, maxWidth: 420 }}>
          {actionsToShow.map((a, idx) => (
            <div key={idx}>
              <strong>{a.name}</strong> – {a.barCost} Bar{' '}
              <button onClick={() => {
                if (actionPoints <= 0) return;
                const updated = { ...currentChar };
                updated.currentBar = spendBar(updated.currentBar, a.barCost || 0);
                setCurrentChar(updated);
                saveCharacter(updated);
                setActionPoints(p => Math.max(0, p - 1));
                if (a.perTurnCost) {
                  const newEffect = { name: a.name, perTurnCost: a.perTurnCost };
                  const next = [...activeEffects.filter(e => e.name !== a.name), newEffect];
                  setActiveEffects(next);
                  persistEffects(next);
                }
              }}>Use</button>
            </div>
          ))}
        </div>

        {/* Active on turn */}
        <div style={{ marginTop: '1rem' }}>
          <h4>Active on Turn</h4>
          {activeEffects.length === 0 && <p>None</p>}
          <ul>
            {activeEffects.map((e, i) => (
              <li key={i}>
                {e.name} – {e.perTurnCost} Bar{' '}
                <button onClick={() => {
                  const next = activeEffects.filter(x => x.name !== e.name);
                  setActiveEffects(next);
                  persistEffects(next);
                }}>Turn Off</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Add custom action */}
        <div style={{ marginTop: '1rem' }}>
          <h4>Add Custom Action</h4>
          <input value={newActionName} onChange={(e) => setNewActionName(e.target.value)} placeholder="Action Name" style={{ width: 160, marginRight: 6 }} />
          <input type="number" value={newActionBarCost} onChange={(e) => setNewActionBarCost(Number(e.target.value))} style={{ width: 60, marginRight: 6 }} />
          <button onClick={() => {
            if (!newActionName) return;
            setCustomActions(prev => [...prev, { name: newActionName, barCost: Number(newActionBarCost) || 0 }]);
            setNewActionName('');
            setNewActionBarCost(0);
          }}>Add</button>
        </div>
      </div>
    )}

    {screen === 'Devil Fruit' && (
      <div>
        <h3>Devil Fruit</h3>
        {!currentChar.fruit && <p>None</p>}
        {currentChar.fruit && (
          <>
            <p><strong>Name:</strong> {currentChar.fruit.name}</p>
            <p><em>Description goes here (see Overview).</em></p>
            <h4>Starting Actions</h4>
            <ul>
              {devilFruitActions.map((a, i) => (
                <li key={i}>{a.name} – {a.barCost} Bar{a.perTurnCost ? ` (+${a.perTurnCost} / turn)` : ''}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    )}

    {screen === 'Skill Tree' && (
      <div>
        <h3>Skill Tree</h3>
        <button onClick={() => {
          if (!currentChar || currentChar.sp <= 0) return;
          const updated = { ...currentChar, sp: currentChar.sp - 1 };
          setCurrentChar(updated);
          saveCharacter(updated);
        }}>Spend Skill Point</button>
        <div style={{ marginTop: 10 }}>
          <button onClick={addSkill}>+ Add Skill</button>
        </div>
        {(currentChar.skills || []).length > 0 && (
          <ul style={{ marginTop: 10 }}>
            {currentChar.skills.map((s, i) => (
              <li key={i}><strong>{s.name}</strong>: {s.desc}</li>
            ))}
          </ul>
        )}
      </div>
    )}
  </div>
);

}

// Fallback return null; }

