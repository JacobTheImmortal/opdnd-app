import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { races } from './races';
import { devilFruits } from './devilFruits';
import { calculateMaxHealth } from './healthUtils';
import { calculateMaxBar } from './barUtils';

// helpers
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const modFromScore = (score) => Math.floor((Number(score || 10) - 10) / 2);

// BASE only (no DM mods)
function recalcBase(char) {
  const race = races[char.race] || {};
  const stats = char.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const level = char.level || 1;
  const baseHP = race.hp || 20;
  const baseBar = race.bar || 100;
  const hp = calculateMaxHealth(baseHP, stats.con || 10, level);
  const bar = calculateMaxBar(baseBar, stats.int || 10, stats.wis || 10, level);
  const reflex = (race.reflex || 5) + Math.floor((stats.dex || 10) / 5) + Math.floor(level / 3);
  return { baseHp: hp, baseBar: bar, baseReflex: reflex };
}

// apply DM modifiers (flat additive)
function withMods(base, mods) {
  const hpMod = Number(mods.hpMod || 0);
  const barMod = Number(mods.barMod || 0);
  const reflexMod = Number(mods.reflexMod || 0);
  return {
    hp: Math.max(1, (base.baseHp || 1) + hpMod),
    bar: Math.max(0, (base.baseBar || 0) + barMod),
    reflex: Math.max(0, (base.baseReflex || 0) + reflexMod),
  };
}

export default function DmTools({ charList, setCharList, onBack, onOpenSheet }) {
  const [expanded, setExpanded] = useState({}); // id -> boolean
  const toggleExpand = (id) => setExpanded((m) => ({ ...m, [id]: !m[id] }));

  const saveInline = async (updated) => {
    const { error } = await supabase.from('characters').upsert({ id: updated.id, data: updated });
    if (error) return alert('Save failed.');
    setCharList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

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
    updated.sp = Math.max(0, Number(updated.sp || 0) + (delta > 0 ? 3 : -3));
    // base -> totals
    const base = recalcBase(updated);
    const totals = withMods(base, updated);
    Object.assign(updated, base, totals);
    updated.currentHp = Math.min(updated.currentHp ?? totals.hp, totals.hp);
    updated.currentBar = Math.min(updated.currentBar ?? totals.bar, totals.bar);
    await saveInline(updated);
  };
  const adminSpAdjust = async (char, delta) => {
    const updated = deepClone(char);
    updated.sp = Math.max(0, (updated.sp || 0) + delta);
    await saveInline(updated);
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
    await saveInline(updated);
  };
  const toggleHidden = async (char) => {
    const updated = { ...char, hidden: !char.hidden };
    await saveInline(updated);
  };

  // --- UI helpers for DM modifiers (+1, +5, -5) ---
  const bumpMod = async (char, field, delta) => {
    const updated = deepClone(char);
    updated[field] = Number(updated[field] || 0) + delta;
    const base = recalcBase(updated);
    const totals = withMods(base, updated);
    Object.assign(updated, base, totals);
    updated.currentHp = Math.min(updated.currentHp ?? totals.hp, totals.hp);
    updated.currentBar = Math.min(updated.currentBar ?? totals.bar, totals.bar);
    await saveInline(updated);
  };
  const setModFromPrompt = async (char, field, label) => {
    const cur = Number(char[field] || 0);
    const v = prompt(`${label} modifier (can be negative):`, String(cur));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isFinite(n)) return alert('Enter a number.');
    await bumpMod(char, field, n - cur);
  };

  // --- Ability score change ---
  const changeScore = async (char, statKey, delta) => {
    const updated = deepClone(char);
    const stats = { ...(updated.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }) };
    stats[statKey] = Math.max(1, Number(stats[statKey] || 10) + delta);
    updated.stats = stats;

    // If STR changes and melee bonus looks derived, optionally keep it in sync
    if (statKey === 'str' && (typeof updated.meleeBonus !== 'number' || Number.isNaN(updated.meleeBonus))) {
      updated.meleeBonus = modFromScore(stats.str);
    }

    const base = recalcBase(updated);
    const totals = withMods(base, updated);
    Object.assign(updated, base, totals);
    updated.currentHp = Math.min(updated.currentHp ?? totals.hp, totals.hp);
    updated.currentBar = Math.min(updated.currentBar ?? totals.bar, totals.bar);
    await saveInline(updated);
  };

  const setMelee = async (char) => {
    const dice = prompt('Melee dice (e.g., 1d6, 2d4):', char.meleeText || '1d6');
    if (dice === null) return;
    const bonusRaw = prompt('Melee bonus (can be negative):', String(char.meleeBonus ?? 0));
    if (bonusRaw === null) return;
    const bonus = Number(bonusRaw);
    if (!Number.isFinite(bonus)) return alert('Enter a number for bonus.');
    const updated = { ...char, meleeText: dice.trim() || '1d6', meleeBonus: bonus };
    await saveInline(updated);
  };

  const createCustom = async () => {
    const name = (prompt('Name for character?') || '').trim();
    if (!name) return;
    const raceNames = Object.keys(races);
    const racePick = prompt(`Choose race (exact):\n${raceNames.join(', ')}`, raceNames[0]) || raceNames[0];
    if (!races[racePick]) return alert('Race not found.');
    const passcode = (prompt('4-digit passcode?', '0000') || '0000').slice(0, 4);

    const stats = deepClone({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    Object.entries(races[racePick].bonuses || {}).forEach(([k, v]) => (stats[k] += v));
    const base = recalcBase({ race: racePick, stats, level: 1 });
    const totals = withMods(base, { hpMod: 0, barMod: 0, reflexMod: 0 });
    const char = {
      id: Date.now().toString(),
      name,
      passcode,
      race: racePick,
      stats,
      level: 1,
      sp: races[racePick].sp,
      ...base,
      ...totals,
      hpMod: 0,
      barMod: 0,
      reflexMod: 0,
      fruit: null,
      currentHp: totals.hp,
      currentBar: totals.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: false,
      meleeText: '1d6',
      meleeBonus: modFromScore(stats.str),
    };
    const { error } = await supabase.from('characters').insert({ id: char.id, data: char });
    if (error) return alert('Create failed.');
    setCharList((prev) => [...prev, char]);
  };

  const createRandom = async () => {
    const raceNames = Object.keys(races);
    const racePick = raceNames[Math.floor(Math.random() * raceNames.length)];
    const name = `NPC ${Math.floor(Math.random() * 1000)}`;
    const passcode = String(1000 + Math.floor(Math.random() * 9000));
    const stats = deepClone({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    Object.entries(races[racePick].bonuses || {}).forEach(([k, v]) => (stats[k] += v));
    const base = recalcBase({ race: racePick, stats, level: 1 });
    const totals = withMods(base, { hpMod: 0, barMod: 0, reflexMod: 0 });
    const char = {
      id: Date.now().toString(),
      name,
      passcode,
      race: racePick,
      stats,
      level: 1,
      sp: races[racePick].sp,
      ...base,
      ...totals,
      hpMod: 0,
      barMod: 0,
      reflexMod: 0,
      fruit: null,
      currentHp: totals.hp,
      currentBar: totals.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
      hidden: false,
      meleeText: '1d6',
      meleeBonus: modFromScore(stats.str),
    };
    const { error } = await supabase.from('characters').insert({ id: char.id, data: char });
    if (error) return alert('Create failed.');
    setCharList((prev) => [...prev, char]);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <button onClick={onBack}>← Back</button>
      <h1>Dungeon Master Tools</h1>

      <div style={{ marginBottom: '0.75rem' }}>
        <button onClick={createCustom}>Create Custom</button>
        <button onClick={createRandom} style={{ marginLeft: 8 }}>Create Random</button>
      </div>

      {charList.map((char) => {
        const isOpen = !!expanded[char.id];
        const base = recalcBase(char);
        const totals = withMods(base, char);
        const s = char.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

        return (
          <div key={char.id} style={{ border: '1px solid #ddd', marginBottom: '1rem', padding: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{char.name}</strong> ({char.race}) Level {char.level}
              <button onClick={() => adminDelete(char)} style={{ marginLeft: 8 }}>Delete</button>
              <button onClick={() => adminCopy(char)}>Copy</button>
              <button onClick={() => adminLevelAdjust(char, +1)}>Lvl +</button>
              <button onClick={() => adminLevelAdjust(char, -1)}>Lvl -</button>
              <button onClick={() => adminSpAdjust(char, +1)}>SP +</button>
              <button onClick={() => adminSpAdjust(char, -1)}>SP -</button>
              <button onClick={() => adminModifyFruit(char)}>Modify DevilFruit</button>
              <button onClick={() => onOpenSheet(char)}>View Sheet</button>
              <label style={{ marginLeft: '0.5rem' }}>
                <input type="checkbox" checked={!!char.hidden} onChange={() => toggleHidden(char)} /> Hidden
              </label>
              <button style={{ marginLeft: 'auto' }} onClick={() => toggleExpand(char.id)}>{isOpen ? 'Collapse' : 'Expand'}</button>
            </div>

            {isOpen && (
              <div style={{ marginTop: '0.5rem' }}>
                {/* Core — Base + Modifiers view */}
                <fieldset style={{ marginBottom: '0.75rem' }}>
                  <legend>Core</legend>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <strong>Max Health:</strong>
                    <span style={{ marginLeft: 8 }}>Base {base.baseHp}</span>
                    <span style={{ marginLeft: 8 }}>Mod {char.hpMod || 0}</span>
                    <span style={{ marginLeft: 8 }}>= <strong>{totals.hp}</strong></span>
                    <span style={{ marginLeft: 8 }}>
                      <button onClick={() => bumpMod(char, 'hpMod', +1)}>+</button>
                      <button onClick={() => bumpMod(char, 'hpMod', +5)} style={{ marginLeft: 4 }}>+5</button>
                      <button onClick={() => bumpMod(char, 'hpMod', -5)} style={{ marginLeft: 4 }}>-5</button>
                      <button onClick={() => setModFromPrompt(char, 'hpMod', 'HP')} style={{ marginLeft: 4 }}>Set…</button>
                    </span>
                  </div>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <strong>Max Bar:</strong>
                    <span style={{ marginLeft: 8 }}>Base {base.baseBar}</span>
                    <span style={{ marginLeft: 8 }}>Mod {char.barMod || 0}</span>
                    <span style={{ marginLeft: 8 }}>= <strong>{totals.bar}</strong></span>
                    <span style={{ marginLeft: 8 }}>
                      <button onClick={() => bumpMod(char, 'barMod', +1)}>+</button>
                      <button onClick={() => bumpMod(char, 'barMod', +5)} style={{ marginLeft: 4 }}>+5</button>
                      <button onClick={() => bumpMod(char, 'barMod', -5)} style={{ marginLeft: 4 }}>-5</button>
                      <button onClick={() => setModFromPrompt(char, 'barMod', 'Bar')} style={{ marginLeft: 4 }}>Set…</button>
                    </span>
                  </div>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <strong>Reflex:</strong>
                    <span style={{ marginLeft: 8 }}>Base {base.baseReflex}</span>
                    <span style={{ marginLeft: 8 }}>Mod {char.reflexMod || 0}</span>
                    <span style={{ marginLeft: 8 }}>= <strong>{totals.reflex}</strong></span>
                    <span style={{ marginLeft: 8 }}>
                      <button onClick={() => bumpMod(char, 'reflexMod', +1)}>+</button>
                      <button onClick={() => bumpMod(char, 'reflexMod', +5)} style={{ marginLeft: 4 }}>+5</button>
                      <button onClick={() => bumpMod(char, 'reflexMod', -5)} style={{ marginLeft: 4 }}>-5</button>
                      <button onClick={() => setModFromPrompt(char, 'reflexMod', 'Reflex')} style={{ marginLeft: 4 }}>Set…</button>
                    </span>
                  </div>

                  <div style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
                    DM modifiers are <em>flat additions</em> that persist across level changes. (Base is recalculated from race, stats, and level; then the modifier is applied.)
                  </div>
                </fieldset>

                {/* Melee dice & bonus */}
                <fieldset style={{ marginBottom: '0.75rem' }}>
                  <legend>Melee</legend>
                  <div>
                    Dice: <strong>{char.meleeText || '1d6'}</strong>
                    <span style={{ marginLeft: 8 }}>Bonus: <strong>{Number(char.meleeBonus || 0)}</strong></span>
                    <span style={{ marginLeft: 8 }}>(Sheet shows: {(char.meleeText || '1d6') + ' + ' + (Number(char.meleeBonus || 0))})</span>
                    <button onClick={() => setMelee(char)} style={{ marginLeft: 8 }}>Set…</button>
                  </div>
                </fieldset>

                {/* Ability Modifiers (DM view) */}
                <fieldset>
                  <legend>Ability Modifiers (DM view)</legend>
                  {[
                    ['cha', 'CHA'],
                    ['con', 'CON'],
                    ['dex', 'DEX'],
                    ['int', 'INT'],
                    ['str', 'STR'],
                    ['wis', 'WIS'],
                  ].map(([k, label]) => (
                    <div key={k} style={{ marginBottom: 6 }}>
                      <strong>{label}:</strong> {modFromScore(s[k])} <button onClick={() => changeScore(char, k, +1)}>+</button>{' '}
                      <button onClick={() => changeScore(char, k, -1)}>-</button>{' '}
                      <span style={{ color: '#666', marginLeft: 8 }}>(score {s[k]})</span>
                    </div>
                  ))}
                </fieldset>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
