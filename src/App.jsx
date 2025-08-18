import React, { useState, useEffect, useMemo } from 'react';
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
   Helpers
-----------------------------------*/
async function saveCharacter(character) {
  if (!character || !character.id) return;
  const { error } = await supabase
    .from('characters')
    .upsert({ id: character.id, data: character });
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

  // equipment local mirror (also persisted into currentChar.equipment)
  const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);

  const [newActionName, setNewActionName] = useState('');
  const [newActionBarCost, setNewActionBarCost] = useState(0);

  // Active, persistent effects (deducted at start of turn)
  const [activeEffects, setActiveEffects] = useState([]); // [{ name, perTurnCost }]

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
        const parsed = data.map(row => row.data);
        setCharList(parsed);
      }
    };
    fetchCharacters();
  }, []);

  /* ----------------------------------
     Loader (scoped so it can set state)
  -----------------------------------*/
  const loadCharacter = async (id) => {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      console.error('❌ Error loading character:', error);
      return;
    }
    if (data && data.data) {
      const loaded = data.data;
      setCurrentChar(loaded);
      setEquipment(loaded.equipment && Array.isArray(loaded.equipment) && loaded.equipment.length
        ? loaded.equipment
        : [{ name: '', quantity: 1, customDesc: '' }]);
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
     Enter / delete
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
     Stats & level
  -----------------------------------*/
  const increaseStat = (stat) => {
    if (!currentChar || currentChar.sp <= 0) return;
    const updated = { ...currentChar };
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

  /* ----------------------------------
     Equipment → Actions bridge (useCost only)
  -----------------------------------*/
  const equipmentActions = useMemo(() => {
    const names = equipment
      .filter(it => it && it.name && it.name !== '')
      .map(it => it.name);
    const distinct = uniqueBy(names, n => n);
    return distinct.map(n => {
      const meta = equipmentList.find(e => e.name === n) || {};
      const cost = Number(meta.useCost) || 0; // default to 0 if not set
      return {
        name: `Use ${n}`,
        barCost: cost,
        _kind: 'equipment',
        itemName: n,
      };
    });
  }, [equipment]);

  /* ----------------------------------
     Devil Fruit → Actions bridge (external JSON)
  -----------------------------------*/
  const devilFruitActions = useMemo(() => {
    const fruitName = currentChar?.fruit?.name;
    return fruitName ? getFruitActions(fruitName) : [];
  }, [currentChar]);

  // Combined actions list
  const actionsToShow = useMemo(
    () => [...defaultActions, ...equipmentActions, ...devilFruitActions, ...customActions],
    [equipmentActions, devilFruitActions, customActions]
  );

  // Persist equipment & effects whenever they change while a character is open
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
     Admin / DM tools helpers
  -----------------------------------*/
  const adminDelete = async (char) => {
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) {
      alert('Delete failed.');
      return;
    }
    setCharList(prev => prev.filter(c => c.id !== char.id));
  };

  const adminCopy = async (char) => {
    const clone = { ...char, id: `${Date.now()}_${Math.floor(Math.random()*1000)}`, name: `${char.name} (Copy)` };
    const { error } = await supabase.from('characters').insert({ id: clone.id, data: clone });
    if (error) { alert('Copy failed.'); return; }
    setCharList(prev => [...prev, clone]);
  };

  const adminLevelAdjust = async (char, delta) => {
    const updated = { ...char, level: Math.max(1, (char.level || 1) + delta) };
    const derived = recalcDerived(updated);
    Object.assign(updated, derived);
    updated.currentHp = Math.min(updated.currentHp ?? derived.hp, derived.hp);
    updated.currentBar = Math.min(updated.currentBar ?? derived.bar, derived.bar);
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) { alert('Level change failed.'); return; }
    setCharList(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  };

  const adminModifyFruit = async (char) => {
    const current = char.fruit?.name || '';
    const names = devilFruits.map(f => f.name).join(', ');
    const input = prompt(`Enter Devil Fruit name (or type 'none' to remove)\nAvailable: ${names}`, current);
    if (input === null) return;
    const trimmed = input.trim();
    let updated = { ...char };
    if (!trimmed || trimmed.toLowerCase() === 'none') {
      updated.fruit = null;
    } else {
      const found = devilFruits.find(f => f.name.toLowerCase() === trimmed.toLowerCase());
      if (!found) { alert('Fruit not found.'); return; }
      updated.fruit = { name: found.name, ability: found.ability };
    }
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) { alert('Update failed.'); return; }
    setCharList(prev => prev.map(c => (c.id === updated.id ? updated : c)));
  };

  /* ----------------------------------
     Renders
  -----------------------------------*/
  // Overview page (moved to separate component)
  if (step === 0) {
    return <Overview onBack={() => setStep(1)} />;
  }

  // DM / DevTools page
  if (step === 3) {
    return (
      <div style={{ padding: '1rem' }}>
        <button onClick={() => setStep(1)}>← Back</button>
        <h1>Dungeon Master Tools</h1>
        <p style={{ color: '#666' }}>Administer characters below.</p>
        <ul>
          {charList.map((char) => (
            <li key={char.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ minWidth: '280px' }}>{char.name} ({char.race})</span>
              <button onClick={() => adminDelete(char)} style={{ background: '#fde7e7' }}>Delete</button>
              <button onClick={() => adminCopy(char)}>Copy</button>
              <span>
                <button onClick={() => adminLevelAdjust(char, +1)}>Lvl +</button>
                <button onClick={() => adminLevelAdjust(char, -1)} style={{ marginLeft: '0.25rem' }}>Lvl -</button>
              </span>
              <button onClick={() => adminModifyFruit(char)}>Modify DevilFruit</button>
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
        {/* Back clears the open session */}
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

            {/* Rest buttons */}
            <div style={{ marginTop: '1rem' }}>
              <button style={{ color: 'crimson', marginRight: '1rem' }} onClick={() => {
                const updated = { ...currentChar };
                // Long Rest: +10 current HP (cap at max), Bar to full
                updated.currentHp = Math.min(updated.currentHp + 10, updated.hp);
                updated.currentBar = updated.bar;
                setCurrentChar(updated);
                saveCharacter(updated);
              }}>Long Rest</button>
              <button style={{ color: 'crimson' }} onClick={() => {
                const updated = { ...currentChar };
                // Short Rest: +50% of max bar to current (cap at max)
                const bonus = Math.floor(updated.bar * 0.5);
                updated.currentBar = Math.min(updated.currentBar + bonus, updated.bar);
                setCurrentChar(updated);
                saveCharacter(updated);
              }}>Short Rest</button>
            </div>
          </>
        )}

        {screen === 'Actions' && (
          <>
            <h3>Actions</h3>
            <p>Action Points: {actionPoints}</p>
            <button onClick={() => {
              // start of turn: reset AP and charge persistent effects
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

            {/* Active on Turn */}
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
                    const updated = { ...currentChar };
                    updated.currentBar -= cost; // upfront cost
                    setCurrentChar(updated);
                    saveCharacter(updated);
                    setActionPoints(prev => prev - 1); // spend an AP

                    // if action has upkeep, toggle it on (if not already present)
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
          <EquipmentSheet
            equipment={equipment}
            setEquipment={persistEquipment}
          />
        )}

        {screen === 'Devil Fruit' && (
          <div style={{ marginTop: '0.75rem' }}>
            <h3>Devil Fruit</h3>
            {currentChar.fruit ? (
              <>
                <div><strong>Name:</strong> {currentChar.fruit.name}</div>
                {currentChar.fruit.ability && (
                  <p style={{ marginTop: '0.5rem' }}><em>{currentChar.fruit.ability}</em></p>
                )}
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
              const updated = { ...currentChar };
              updated.sp -= 1;
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
     Home
  -----------------------------------*/
  return (
    <div style={{ padding: '1rem', position: 'relative', minHeight: '100vh' }}>
      <h1>OPDND</h1>

      {/* Top-right Overview button */}
      <div style={{ position: 'fixed', right: '1rem', top: '1rem' }}>
        <button style={{ color: 'crimson' }} onClick={() => setStep(0)}>Overview</button>
      </div>

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
        {charList.map((char) => (
          <li key={char.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
            <button onClick={() => enterChar(char)}>{char.name} ({char.race})</button>
            <button onClick={() => deleteCharacter(char)} style={{ background: '#fbe9e9', border: '1px solid #e57373' }}>Delete</button>
          </li>
        ))}
      </ul>

      {/* Bottom-left Dev Tool Mode */}
      <div style={{ position: 'fixed', left: '1rem', bottom: '1rem' }}>
        <button style={{ color: 'crimson' }}
          onClick={() => {
            const pin = prompt('Enter Dev PIN');
            if (pin === '5637') setStep(3); else alert('Incorrect PIN.');
          }}
        >
          DevTool Mode
        </button>
      </div>
    </div>
  );
}