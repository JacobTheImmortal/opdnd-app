import React, { useMemo } from 'react';
import { equipmentList } from './equipmentData';

/**
 * Small helpers
 */
const isBlank = (v) => v === undefined || v === null || v === '' || String(v).toLowerCase() === 'n/a';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Return a normalized copy of an item row after selecting a catalog item */
const inflateFromCatalog = (name) => {
  const meta = equipmentList.find((e) => e.name === name) || {};
  const hasDur = Number(meta.durability) > 0;
  const hasAmmo = Number(meta.ammo) > 0;
  return {
    name,
    quantity: 1,
    isCustom: false,
    // meta snapshot for rendering
    damage: meta.damage,
    range: meta.range,
    weight: meta.weight,
    growthTime: meta.growthTime,
    yield: meta.yield,
    // usage cost for Actions tab (App.jsx reads this off each item if present)
    useCost: Number(meta.useCost) || 0,
    // durability
    maxDurability: hasDur ? Number(meta.durability) : undefined,
    currentDurability: hasDur ? Number(meta.durability) : undefined,
    // ammo
    maxAmmo: hasAmmo ? Number(meta.ammo) : undefined,
    currentAmmo: hasAmmo ? Number(meta.ammo) : undefined,
  };
};

/** Create a custom row from user prompts */
const makeCustomRow = () => {
  const name = prompt('Item name?');
  if (!name) return null;
  const pNum = (q) => {
    const v = prompt(q);
    if (!v) return undefined;
    if (String(v).trim().toLowerCase() === 'n/a') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const pTxt = (q) => {
    const v = prompt(q);
    if (!v) return undefined;
    if (String(v).trim().toLowerCase() === 'n/a') return undefined;
    return v;
  };

  const damage = pTxt('Damage (e.g. "2d6" or "Melee + 1d4"), or n/a');
  const range = pTxt('Range (e.g. "30ft - 60ft" or "Melee range"), or n/a');
  const weight = pTxt('Weight (light / heavy), or n/a');
  const durability = pNum('Max Durability (number) or n/a');
  const ammo = pNum('Max Ammo (number) or n/a');
  const growthTime = pTxt('Growth time (text) or n/a');
  const yld = pTxt('Yield (text) or n/a');
  const useCost = (() => {
    const v = prompt('Bar usage (number) or n/a');
    if (!v) return 0;
    if (String(v).trim().toLowerCase() === 'n/a') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  })();

  return {
    name,
    quantity: 1,
    isCustom: true,
    damage,
    range,
    weight,
    growthTime,
    yield: yld,
    useCost,
    maxDurability: durability,
    currentDurability: durability,
    maxAmmo: ammo,
    currentAmmo: ammo,
  };
};

const Stat = ({ label, value }) => {
  if (isBlank(value)) return null;
  return (
    <div>
      <strong>{label}: </strong>{value}
    </div>
  );
};

function Row({ row, onChange, onRemove }) {
  const catalogOptions = useMemo(() => equipmentList.map((e) => e.name), []);
  const selectOptions = row.isCustom && row.name && !catalogOptions.includes(row.name)
    ? [...catalogOptions, row.name]
    : catalogOptions;

  const update = (patch) => onChange({ ...row, ...patch });

  // Change from dropdown
  const handleSelect = (e) => {
    const name = e.target.value;
    if (!name) return;
    update(inflateFromCatalog(name));
  };

  const qtyChange = (e) => {
    const q = Math.max(0, Number(e.target.value) || 0);
    if (q === 0) return onRemove();
    update({ quantity: q });
  };

  // Durability / Ammo controls
  const incDur = (d) => {
    if (!row.maxDurability) return;
    let cur = clamp((row.currentDurability || 0) + d, 0, row.maxDurability);
    let qty = row.quantity;
    if (cur === 0 && d < 0) {
      // break one item
      qty = Math.max(0, qty - 1);
      if (qty === 0) return onRemove();
      cur = row.maxDurability; // new one
    }
    update({ currentDurability: cur, quantity: qty });
  };

  const incAmmo = (d) => {
    if (!row.maxAmmo) return;
    let cur = clamp((row.currentAmmo || 0) + d, 0, row.maxAmmo);
    update({ currentAmmo: cur });
  };

  const reload = () => {
    if (!row.maxAmmo) return;
    update({ currentAmmo: row.maxAmmo });
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Name selector / label */}
      {row.isCustom ? (
        <div style={{ fontWeight: 600 }}>{row.name}</div>
      ) : (
        <select value={row.name || ''} onChange={handleSelect}>
          <option value="">-- Select Item --</option>
          {selectOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      )}

      {/* Qty */}
      <span style={{ marginLeft: 10 }}>Qty</span>
      <input
        type="number"
        value={row.quantity || 1}
        onChange={qtyChange}
        style={{ width: 60, marginLeft: 6 }}
      />

      {/* Durability controls (if applicable) */}
      {row.maxDurability ? (
        <span style={{ marginLeft: 14 }}>
          <strong>Durability</strong>{' '}
          <button onClick={() => incDur(-1)}>-</button>{' '}
          {row.currentDurability} / {row.maxDurability}{' '}
          <button onClick={() => incDur(+1)}>+</button>
        </span>
      ) : null}

      {/* Ammo controls (if applicable) */}
      {row.maxAmmo ? (
        <span style={{ marginLeft: 14 }}>
          <strong>Ammo</strong>{' '}
          <button onClick={() => incAmmo(-1)}>-</button>{' '}
          {row.currentAmmo} / {row.maxAmmo}{' '}
          <button onClick={() => incAmmo(+1)}>+</button>{' '}
          <button onClick={reload} style={{ marginLeft: 6 }}>Reload</button>
        </span>
      ) : null}

      {/* Stats */}
      <div style={{ marginTop: 6 }}>
        <Stat label="Damage" value={row.damage} />
        <Stat label="Range" value={row.range} />
        <Stat label="Weight" value={row.weight} />
        <Stat label="Max Durability" value={row.maxDurability} />
        <Stat label="Growth time" value={row.growthTime} />
        <Stat label="Yield" value={row.yield} />
      </div>

      {!row.isCustom && (
        <button style={{ marginTop: 6 }} onClick={onRemove}>Remove</button>
      )}
    </div>
  );
}

export default function EquipmentSheet({ equipment, setEquipment }) {
  const rows = Array.isArray(equipment) ? equipment : [];

  const addRow = () => {
    setEquipment([...(rows || []), inflateFromCatalog('')]);
  };

  const addCustom = () => {
    const row = makeCustomRow();
    if (!row) return;
    setEquipment([...(rows || []), row]);
  };

  const updateAt = (idx, updated) => {
    const next = rows.slice();
    next[idx] = updated;
    setEquipment(next);
  };

  const removeAt = (idx) => {
    const next = rows.slice();
    next.splice(idx, 1);
    setEquipment(next);
  };

  return (
    <div>
      {rows.map((row, i) => (
        <Row
          key={i}
          row={row}
          onChange={(u) => updateAt(i, u)}
          onRemove={() => removeAt(i)}
        />
      ))}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={addRow}>+ Add Equipment</button>
        <button onClick={addCustom}>+ Add Custom</button>
      </div>
    </div>
  );
}
