// src/EquipmentSheet.jsx
import React, { useMemo } from 'react';
import { equipmentList } from './equipmentData';

/**
 * Helpers
 */
const isBlank = (v) =>
  v === undefined || v === null || v === '' || String(v).toLowerCase() === 'n/a';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Build a full row from a catalog item name */
const inflateFromCatalog = (name) => {
  const meta = (equipmentList || []).find((e) => e.name === name) || {};
  const hasDur = Number(meta.durability) > 0;
  const hasAmmo = Number(meta.ammo) > 0;
  return {
    name,
    quantity: 1,
    // metadata shown
    damage: meta.damage,
    range: meta.range,
    weight: meta.weight,
    growthTime: meta.growthTime,
    yield: meta.yield,
    // actions integration
    useCost: Number(meta.useCost) || 0,
    // durability/ammo
    maxDurability: hasDur ? Number(meta.durability) : undefined,
    currentDurability: hasDur ? Number(meta.durability) : undefined,
    maxAmmo: hasAmmo ? Number(meta.ammo) : undefined,
    currentAmmo: hasAmmo ? Number(meta.ammo) : undefined,
    // flag to distinguish custom vs premade
    isCustom: false,
  };
};

/** Build a custom row via prompts (keeps original UX) */
const makeCustomRow = () => {
  const askNum = (q) => {
    const v = prompt(q);
    if (!v) return undefined;
    const s = String(v).trim().toLowerCase();
    if (s === 'n/a') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const askTxt = (q) => {
    const v = prompt(q);
    if (!v) return undefined;
    const s = String(v).trim().toLowerCase();
    if (s === 'n/a') return undefined;
    return v;
  };

  const name = prompt('Item name?');
  if (!name) return null;

  const damage = askTxt('Damage (text) or n/a');
  const range = askTxt('Range (text) or n/a');
  const weight = askTxt('Weight (text) or n/a');
  const growthTime = askTxt('Growth time (text) or n/a');
  const yld = askTxt('Yield (text) or n/a');
  const useCost = askNum('Bar usage cost (number) or n/a') || 0;
  const durability = askNum('Max Durability (number) or n/a');
  const ammo = askNum('Max Ammo (number) or n/a');

  return {
    name,
    isCustom: true,
    quantity: 1,
    damage,
    range,
    weight,
    growthTime,
    yield: yld,
    useCost: Number(useCost) || 0,
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
      <strong>{label}:</strong> {String(value)}
    </div>
  );
};

/** Single equipment row renderer */
function Row({ row, onChange, onRemove }) {
  const isCustom = !!row.isCustom || (!(equipmentList || []).some(e => e.name === row.name) && !isBlank(row.name));

  const onSelect = (e) => {
    const name = e.target.value;
    if (!name) {
      onChange({ name: '', quantity: 1, isCustom: false });
      return;
    }
    onChange(inflateFromCatalog(name));
  };

  const setQty = (e) => {
    const v = Number(e.target.value || 0);
    onChange({ ...row, quantity: v });
  };

  const incDur = (d) => {
    if (!row.maxDurability) return;
    const cur = Number(row.currentDurability ?? row.maxDurability);
    onChange({
      ...row,
      currentDurability: clamp(cur + d, 0, Number(row.maxDurability)),
    });
  };

  const incAmmo = (d) => {
    if (!row.maxAmmo) return;
    const cur = Number(row.currentAmmo ?? row.maxAmmo);
    onChange({
      ...row,
      currentAmmo: clamp(cur + d, 0, Number(row.maxAmmo)),
    });
  };

  const meta = useMemo(() => {
    if (isCustom) return {};
    return (equipmentList || []).find((e) => e.name === row.name) || {};
  }, [row.name, isCustom]);

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Header: premade has select; custom shows name */}
      {!isCustom ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select value={row.name || ''} onChange={onSelect}>
            <option value="">— Select —</option>
            {(equipmentList || []).map((e) => (
              <option key={e.name} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
          <span>
            Qty{' '}
            <input
              type="number"
              value={row.quantity || 1}
              onChange={setQty}
              style={{ width: 60 }}
            />
          </span>
          {/* Keep Remove for premade */}
          <button onClick={onRemove}>Remove</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong>{row.name || 'Custom Item'}</strong>
          <span>
            Qty{' '}
            <input
              type="number"
              value={row.quantity || 1}
              onChange={setQty}
              style={{ width: 60 }}
            />
          </span>
          {/* NEW: Remove for custom items */}
          <button onClick={onRemove}>Remove</button>
        </div>
      )}

      {/* Details */}
      {!isCustom ? (
        <>
          <Stat label="Damage" value={meta.damage} />
          <Stat label="Range" value={meta.range} />
          <Stat label="Weight" value={meta.weight ?? 'light'} />
          <Stat label="Growth Time" value={meta.growthTime} />
          <Stat label="Yield" value={meta.yield} />
          {!isBlank(meta.useCost) && <Stat label="Use Cost" value={`${meta.useCost} Bar`} />}
        </>
      ) : (
        <>
          <Stat label="Damage" value={row.damage} />
          <Stat label="Range" value={row.range} />
          <Stat label="Weight" value={row.weight} />
          <Stat label="Growth Time" value={row.growthTime} />
          <Stat label="Yield" value={row.yield} />
          {!isBlank(row.useCost) && <Stat label="Use Cost" value={`${row.useCost} Bar`} />}
        </>
      )}

      {/* Durability controls if present */}
      {(row.maxDurability || (!isCustom && meta.durability)) ? (
        <div style={{ marginTop: 6 }}>
          <strong>Durability</strong>{' '}
          <button onClick={() => incDur(-1)}>-</button>{' '}
          {Number(row.currentDurability ?? row.maxDurability ?? meta.durability ?? 0)} /{' '}
          {Number(row.maxDurability ?? meta.durability ?? 0)}{' '}
          <button onClick={() => incDur(+1)}>+</button>
        </div>
      ) : null}

      {/* Ammo controls if present */}
      {(row.maxAmmo || (!isCustom && meta.ammo)) ? (
        <div style={{ marginTop: 6 }}>
          <strong>Ammo</strong>{' '}
          <button onClick={() => incAmmo(-1)}>-</button>{' '}
          {Number(row.currentAmmo ?? row.maxAmmo ?? meta.ammo ?? 0)} /{' '}
          {Number(row.maxAmmo ?? meta.ammo ?? 0)}{' '}
          <button onClick={() => incAmmo(+1)}>+</button>
        </div>
      ) : null}
    </div>
  );
}

export default function EquipmentSheet({ equipment = [], setEquipment }) {
  const rows = equipment || [];

  const updateAt = (idx, patch) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setEquipment(next);
  };

  const removeAt = (idx) => {
    const next = rows.filter((_, i) => i !== idx);
    setEquipment(next);
  };

  const addRow = () => {
    setEquipment([
      ...rows,
      { name: '', quantity: 1, isCustom: false },
    ]);
  };

  const addCustom = () => {
    const row = makeCustomRow();
    if (!row) return;
    setEquipment([...(rows || []), row]);
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      {rows.map((row, i) => (
        <Row
          key={i}
          row={row}
          onChange={(u) => updateAt(i, u)}
          onRemove={() => removeAt(i)}
        />
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={addRow}>+ Add Equipment</button>
        <button onClick={addCustom}>+ Add Custom</button>
      </div>
    </div>
  );
}
