// src/DmTools.jsx
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { races } from './races';
import { devilFruits } from './devilFruits';

// --- small local helpers (copied from App to avoid re-import cycles)
const clamp = (n, min, max) => Math.max(min, Math.min(max, n || 0));
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
const modFromScore = (score) => Math.floor((Number(score || 10) - 10) / 2);

// Keep this “recalc” aligned with App’s logic
function recalcDerived(char) {
  const race = races[char.race] || {};
  const stats = char.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const level = char.level || 1;
  const baseHP = race.hp || 20;
  const baseBar = race.bar || 100;
  const con = stats.con || 10;
  const int = stats.int || 10;
  const wis = stats.wis || 10;
  const hp = baseHP + Math.max(0, con - 10) * 2 + (level - 1) * 5; // mirrors calculateMaxHealth
  const bar = baseBar + Math.max(0, int - 10) * 2 + Math.max(0, wis - 10) * 2 + level * 5;
  const reflex = (race.reflex || 5) + Math.floor((stats.dex || 10) / 5) + Math.floor(level / 3);
  return { hp, bar, reflex };
}

export default function DmTools({
  charList,
  setCharList,
  onBack,
  onOpenSheet, // (char) => void (App will set currentChar, equipment, etc.)
}) {
  const [expanded, setExpanded] = useState({}); // id -> boolean
  const toggleExpand = (id) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  // -- thin upsert wrapper used by many controls
  const saveInline = async (updated) => {
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (!error) {
      setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } else {
      alert('Save failed.');
    }
  };

  // ----- Admin actions (moved from App.jsx)
  const adminDelete = async (char) => {
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from('characters').delete().eq('id', char.id);
    if (error) return alert('Delete failed.');
    setCharList((prev) => prev.filter((c) => c.id !== char.id));
  };

  const adminCopy = async (char) => {
    const clone = { ...deepClone(char), id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`, name: `${char.name} (Copy)` };
    const { error } = await supabase.from('characters').insert({ id: clone.id, data: clone });
    if (error) return alert('Copy failed.');
    setCharList((prev) => [...prev, clone]);
  };

  const adminLevelAdjust = async (char, delta) => {
    const updated = deepClone(char);
    updated.level = Math.max(1, (updated.level || 1) + delta);
    updated.sp = (updated.sp || 0) + (delta > 0 ? 3 : -3 * Math.min(1, Math.abs(delta)));
    const derived = recalcDerived(updated);
    Object.assign(updated, derived);
    updated.currentHp = Math.min(updated.currentHp ?? derived.hp, derived.hp);
    updated.currentBar = Math.min(updated.currentBar ?? derived.bar, derived.bar);
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) return alert('Level change failed.');
    setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const adminSpAdjust = async (char, delta) => {
    const updated = deepClone(char);
    updated.sp = Math.max(0, (updated.sp || 0) + delta);
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) return alert('SP change failed.');
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
      if (!found) return alert('Fruit not found.');
      updated.fruit = { name: found.name, ability: found.ability };
    }
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) return alert('Update failed.');
    setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
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
    if (!races[racePick]) return alert('Race not found.');

    const fruitInput = prompt(`Devil Fruit name (or 'none')?`, 'none') || 'none';
    const hiddenAns = (prompt(`Hidden? (yes/no)`, 'no') || 'no').toLowerCase().startsWith('y');
    const passcode = (prompt('4-digit passcode (for player view)?', '0000') || '0000').slice(0, 4);

    const baseStats = deepClone({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    const race = races[racePick];
    Object.entries(race.bonuses || {}).forEach(([k, v]) => (baseStats[k] += v));

    const derived = recalcDerived({ race: racePick, stats: baseStats, level: 1 });
    const fruit =
      fruitInput.toLowerCase() === 'none'
        ? null
        : (() => {
            const f = devilFruits.find((df) => df.name.toLowerCase() === fruitInput.toLowerCase());
            return f ? { name: f.name, ability: f.ability } : null;
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
    if (error) return alert('Create failed.');
    setCharList((prev) => [...prev, char]);
  };

  const createRandom = async () => {
    const raceNames = Object.keys(races);
    const racePick = raceNames[Math.floor(Math.random() * raceNames.length)];
    const race = races[racePick];
    const baseStats = deepClone({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    Object.entries(race.bonuses || {}).forEach(([k, v]) => (baseStats[k] += v));
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((k) => (baseStats[k] = clamp(baseStats[k] + Math.floor(Math.random() * 5) - 2, 6, 20)));
    const derived = recalcDerived({ race: racePick, stats: baseStats, level: 1 });
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
    if (error) return alert('Create failed.');
    setCharList((prev) => [...prev, char]);
  };

  // ---- generic numeric setters used in the expanded editor
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
      <button onClick={onBack}>← Back</button>
      <h1>Dungeon Master Tools</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={createCustom} style={{ marginRight: 8 }}>Create Custom</button>
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
              <button onClick={() => adminDelete(char)} style={{ background: '#fdeaea' }}>Delete</button>
              <button onClick={() => adminCopy(char)}>Copy</button>
              <button onClick={() => adminLevelAdjust(char, +1)}>Lvl +</button>
              <button onClick={() => adminLevelAdjust(char, -1)}>Lvl -</button>
              <button onClick={() => adminSpAdjust(char, +1)}>SP +</button>
              <button onClick={() => adminSpAdjust(char, -1)}>SP -</button>
              <button onClick={() => adminModifyFruit(char)}>Modify DevilFruit</button>
              <button onClick={() => onOpenSheet(char)}>View Sheet</button>
              <label style={{ marginLeft: 8 }}>
                <input type="checkbox" checked={!!char.hidden} onChange={() => toggleHidden(char)} /> Hidden
              </label>
            </div>

            {expanded[char.id] && (
              <div style={{ border: '1px solid #ddd', padding: 12, marginTop: 8, borderRadius: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: 12 }}>
                  <div>
                    <h4 style={{ marginTop: 0 }}>Core</h4>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Max Health:</strong>{' '}
                      <input style={{ width: 80 }} type="number" value={char.hp || 0}
                        onChange={(e) => setNumField(char, 'hp', Number(e.target.value))} />
                      <button onClick={() => nudgeNumField(char, 'hp', +1)} style={{ marginLeft: 6 }}>+</button>
                      <button onClick={() => nudgeNumField(char, 'hp', -1)} style={{ marginLeft: 4 }}>-</button>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <strong>Max Bar:</strong>{' '}
                      <input style={{ width: 80 }} type="number" value={char.bar || 0}
                        onChange={(e) => setNumField(char, 'bar', Number(e.target.value))} />
                      <button onClick={() => nudgeNumField(char, 'bar', +5)} style={{ marginLeft: 6 }}>+5</button>
                      <button onClick={() => nudgeNumField(char, 'bar', -5)} style={{ marginLeft: 4 }}>-5</button>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <strong>Reflex:</strong>{' '}
                      <input style={{ width: 80 }} type="number" value={char.reflex || 0}
                        onChange={(e) => setNumField(char, 'reflex', Number(e.target.value))} />
                      <button onClick={() => nudgeNumField(char, 'reflex', +1)} style={{ marginLeft: 6 }}>+</button>
                      <button onClick={() => nudgeNumField(char, 'reflex', -1)} style={{ marginLeft: 4 }}>-</button>
                    </div>

                    <h4>Melee</h4>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Dice:</strong>{' '}
                      <input style={{ width: 100 }} value={char.meleeText || '1d6'}
                        onChange={(e) => setMeleeText(char, e.target.value)} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Bonus:</strong>{' '}
                      <input style={{ width: 80 }} type="number" value={Number(char.meleeBonus || 0)}
                        onChange={(e) => setMeleeBonus(char, Number(e.target.value))} />
                      <span style={{ marginLeft: 6, color: '#555' }}>
                        (Sheet shows: {char.meleeText || '1d6'} + {Number(char.meleeBonus || 0)})
                      </span>
                    </div>

                    <h4>Skill Points</h4>
                    <div>
                      <input style={{ width: 80 }} type="number" value={Number(char.sp || 0)}
                        onChange={(e) => setNumField(char, 'sp', Number(e.target.value))} />
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
                          <button onClick={() => adjustMod(char, k, +1)} style={{ marginLeft: 6 }}>+</button>
                          <button onClick={() => adjustMod(char, k, -1)} style={{ marginLeft: 4 }}>-</button>
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
