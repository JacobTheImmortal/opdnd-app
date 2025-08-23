// src/DmTools.jsx
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { races } from './races';
import { devilFruits } from './devilFruits';

// small helpers
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 0));
const modFromScore = (score) => Math.floor((Number(score || 10) - 10) / 2);

// BASE only (no DM mods)
function recalcBase(char) {
  const race = races[char.race] || {};
  const stats = char.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const level = char.level || 1;
  const baseHP = race.hp || 20;
  const baseBar = race.bar || 100;
  const hp = baseHP + Math.max(0, (stats.con || 10) - 10) * 2 + (level - 1) * 5;
  const bar =
    baseBar + Math.max(0, (stats.int || 10) - 10) * 2 + Math.max(0, (stats.wis || 10) - 10) * 2 + level * 5;
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
    updated.sp = (updated.sp || 0) + (delta > 0 ? 3 : -3 * Math.min(1, Math.abs(delta)));
    // ensure mods present
    updated.hpMod = Number(updated.hpMod || 0);
    updated.barMod = Number(updated.barMod || 0);
    updated.reflexMod = Number(updated.reflexMod || 0);
    // base -> totals
    const base = recalcBase(updated);
    const totals = withMods(base, updated);
    Object.assign(updated, base, totals);
    updated.currentHp = Math.min(updated.currentHp ?? totals.hp, totals.hp);
    updated.currentBar = Math.min(updated.currentBar ?? totals.bar, totals.bar);
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

  // --- UI helpers for DM modifiers (+1, +5, -5) ---
  const bumpMod = async (char, field, delta) => {
    const updated = deepClone(char);
    updated[field] = Number(updated[field] || 0) + delta;
    // recompute base and totals
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

  return (
    <div style={{ padding: '1rem' }}>
      <button onClick={onBack}>← Back</button>
      <h1>Dungeon Master Tools</h1>

      {/* Create buttons (existing) */}
      <div style={{ marginBottom: '0.75rem' }}>
        <button onClick={() => {
          const name = (prompt('Name for character?') || '').trim();
          if (!name) return;
          const raceNames = Object.keys(races);
          const racePick = prompt(`Choose race (exact):\n${raceNames.join(', ')}`, raceNames[0]) || raceNames[0];
          if (!races[racePick]) return alert('Race not found.');
          const passcode = (prompt('4-digit passcode?', '0000') || '0000').slice(0,4);
          const stats = deepClone({ str:10,dex:10,con:10,int:10,wis:10,cha:10 });
          Object.entries(races[racePick].bonuses||{}).forEach(([k,v]) => (stats[k]+=v));
          const base = recalcBase({ race: racePick, stats, level:1 });
          const totals = withMods(base, { hpMod:0, barMod:0, reflexMod:0 });
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
            hpMod:0, barMod:0, reflexMod:0,
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
          supabase.from('characters').insert({ id: char.id, data: char }).then(({error})=>{
            if (error) return alert('Create failed.');
            setCharList((prev)=>[...prev,char]);
          });
        }}>Create Custom</button>
        <button onClick={()=>{
          // keep your existing Create Random if you prefer;
          // omitted here for brevity
          alert('Use your existing Create Random; unchanged by this patch.');
        }}>Create Random</button>
      </div>

      {charList.map((char) => {
        const isOpen = !!expanded[char.id];
        const base = recalcBase(char);
        const totals = withMods(base, char);

        return (
          <div key={char.id} style={{ border: '1px solid #ddd', marginBottom: '1rem', padding: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => adminDelete(char)}>Delete</button>
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
                {/* Core — now shows BASE and MODS separately */}
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
                    DM modifiers are <em>flat additions</em> that persist across level changes. (Base is recalculated from race, stats, and level; then the
                    modifier is applied.) 
                  </div>
                </fieldset>

                {/* (Rest of your DM panel: melee, dice, bonuses, ability +/-, etc. stays the same) */}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
