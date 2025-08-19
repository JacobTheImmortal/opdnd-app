import React, { useMemo, useState } from 'react';
import { equipmentList } from './equipmentData';

/**
 * EquipmentSheet
 * - Shows one editable equipment slot at a time (like before)
 * - Adds Durability controls for items that define `durability`
 * - Adds Ammo controls + Reload for items that define `ammo`
 * - On durability reaching 0: decrease quantity; if qty>0 reset currentDurability to max; if qty hits 0, remove row
 * - Ammo reaching 0 does NOT remove; player may Reload to max
 */
export default function EquipmentSheet({ equipment, setEquipment }) {
  // Local projection of a single editable row (index 0)
  const items = useMemo(() => equipmentList.map(e => e.name), []);
  const [rowIndex] = useState(0);

  // Ensure at least one row exists
  const rows = equipment && equipment.length ? equipment : [{ name: '', quantity: 1 }];
  const row = rows[rowIndex] || { name: '', quantity: 1 };

  const meta = useMemo(() => equipmentList.find(e => e.name === row.name) || {}, [row.name]);
  const maxDur = Number(meta.durability) || 0;
  const maxAmmo = Number(meta.ammo) || 0;

  const ensureDefaults = (obj, m) => {
    const next = { ...obj };
    if (m && m.durability && (next.currentDurability == null || next.name !== obj.name)) {
      next.currentDurability = Number(m.durability);
    }
    if (m && m.ammo && (next.currentAmmo == null || next.name !== obj.name)) {
      next.currentAmmo = Number(m.ammo);
    }
    return next;
  };

  const updateRow = (patch) => {
    const next = [...rows];
    next[rowIndex] = ensureDefaults({ ...row, ...patch }, meta);
    setEquipment(next);
  };

  const removeRow = () => {
    const next = [...rows];
    next.splice(rowIndex, 1);
    setEquipment(next);
  };

  const addAnother = () => {
    const next = [...rows, { name: '', quantity: 1 }];
    setEquipment(next);
  };

  // Quantity change
  const onQtyChange = (qtyStr) => {
    const q = Math.max(0, Number(qtyStr) || 0);
    if (q === 0) return removeRow();
    updateRow({ quantity: q });
  };

  // Durability +/-
  const changeDurability = (delta) => {
    if (!maxDur) return;
    let cur = Math.max(0, Math.min(maxDur, Number(row.currentDurability ?? maxDur)) + delta);

    // broke item
    if (cur <= 0) {
      const newQty = Math.max(0, (row.quantity || 1) - 1);
      if (newQty <= 0) {
        removeRow();
        return;
      }
      // reset durability for next piece
      updateRow({ quantity: newQty, currentDurability: maxDur });
      return;
    }
    updateRow({ currentDurability: cur });
  };

  // Ammo +/- and Reload
  const changeAmmo = (delta) => {
    if (!maxAmmo) return;
    const cur = Math.max(0, Math.min(maxAmmo, Number(row.currentAmmo ?? maxAmmo) + delta));
    updateRow({ currentAmmo: cur });
  };
  const reload = () => {
    if (!maxAmmo) return;
    updateRow({ currentAmmo: maxAmmo });
  };

  const onNameChange = (e) => {
    const name = e.target.value;
    const m = equipmentList.find(x => x.name === name) || {};
    // Reset currentDurability / currentAmmo to max when choosing an item
    updateRow({ name, currentDurability: m.durability || undefined, currentAmmo: m.ammo || undefined });
  };

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <h3>Equipment</h3>

      {/* Row controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select value={row.name || ''} onChange={onNameChange} style={{ minWidth: 200 }}>
          <option value="">-- Select Item --</option>
          {items.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span>Qty</span>
        <input style={{ width: 60 }} type="number" value={row.quantity || 1} onChange={(e) => onQtyChange(e.target.value)} />

        {/* Durability controls (only when item has durability) */}
        {maxDur > 0 && (
          <>
            <span style={{ marginLeft: 8 }}>Durability</span>
            <button onClick={() => changeDurability(-1)}>-</button>
            <span style={{ padding: '0 6px' }}>{Math.min(maxDur, Number(row.currentDurability ?? maxDur))} / {maxDur}</span>
            <button onClick={() => changeDurability(+1)}>+</button>
          </>
        )}

        {/* Ammo controls (only when item has ammo) */}
        {maxAmmo > 0 && (
          <>
            <span style={{ marginLeft: 12 }}>Ammo</span>
            <button onClick={() => changeAmmo(-1)}>-</button>
            <span style={{ padding: '0 6px' }}>{Math.min(maxAmmo, Number(row.currentAmmo ?? maxAmmo))} / {maxAmmo}</span>
            <button onClick={() => changeAmmo(+1)}>+</button>
            <button onClick={reload} style={{ marginLeft: 8 }}>Reload</button>
          </>
        )}

        <button onClick={removeRow} style={{ marginLeft: 'auto' }}>Remove</button>
      </div>

      {/* Item details */}
      {row.name && (
        <div style={{ marginTop: 8 }}>
          {meta.damage && (<div><strong>Damage:</strong> {meta.damage}</div>)}
          {meta.range && (<div><strong>Range:</strong> {meta.range}</div>)}
          {maxDur > 0 && (<div><strong>Max Durability:</strong> {maxDur}</div>)}
          {maxAmmo > 0 && (<div><strong>Max Ammo:</strong> {maxAmmo}</div>)}
          {meta.weight && (<div><strong>Weight:</strong> {meta.weight}</div>)}
          {meta.description && (
            <p style={{ fontStyle: 'italic', marginTop: 6 }}>{meta.description}</p>
          )}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button onClick={addAnother}>+ Add Equipment</button>
      </div>
    </div>
  );
}
