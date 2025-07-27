import React, { useState } from 'react';
import { equipmentList } from './equipmentData';

export default function EquipmentSheet({ equipment, setEquipment }) {
  const addSlot = () => {
    setEquipment([...equipment, { name: '', quantity: 1, customDesc: '' }]);
  };

  const updateSlot = (index, field, value) => {
    const updated = [...equipment];
    updated[index][field] = value;
    setEquipment(updated);
  };

  const getItemDetails = (name) => {
    return equipmentList.find(item => item.name === name);
  };

  return (
    <div>
      <h3>Equipment</h3>
      {equipment.map((item, index) => {
        const details = getItemDetails(item.name);
        const isCustom = item.name === 'Other' || details?.custom;
        return (
          <div key={index} style={{ marginBottom: '1rem' }}>
            <select
              value={item.name}
              onChange={e => updateSlot(index, 'name', e.target.value)}
            >
              <option value="">-- Select Item --</option>
              {equipmentList.map(eq => (
                <option key={eq.name} value={eq.name}>{eq.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Qty"
              value={item.quantity}
              onChange={e => updateSlot(index, 'quantity', parseInt(e.target.value))}
              style={{ width: '60px', marginLeft: '0.5rem' }}
            />
            <div style={{ marginTop: '0.5rem' }}>
              {item.name && (
                isCustom ? (
                  <textarea
                    placeholder="Describe item..."
                    value={item.customDesc}
                    onChange={e => updateSlot(index, 'customDesc', e.target.value)}
                    rows={2}
                    style={{ width: '100%' }}
                  />
                ) : (
                  <>
                    {details.damage && <p><strong>Damage:</strong> {details.damage}</p>}
                    {details.range && <p><strong>Range:</strong> {details.range}</p>}
                    {details.durability && <p><strong>Durability:</strong> {details.durability}</p>}
                    {details.value && <p><strong>Value:</strong> {details.value} berries</p>}
                  </>
                )
              )}
            </div>
          </div>
        );
      })}
      <button onClick={addSlot}>+ Add Equipment</button>
    </div>
  );
}
