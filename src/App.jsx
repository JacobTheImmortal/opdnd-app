import React, { useState } from 'react';
import { races } from './races';
import { devilFruits } from './devilFruits';
import { defaultActions } from './actionsUtils';
import EquipmentSheet from './EquipmentSheet';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [characters, setCharacters] = useState([]);
  const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(null);
  const [creatingCharacter, setCreatingCharacter] = useState(false);
  const [newChar, setNewChar] = useState({ name: '', passcode: '', withFruit: false });
  const [equipment, setEquipment] = useState([{ name: '', quantity: 1, customDesc: '' }]);

  const [currentChar, setCurrentChar] = useState(null);
  const [skillPoints, setSkillPoints] = useState(0);
  const [actionPoints, setActionPoints] = useState(3);
  const [customActions, setCustomActions] = useState([]);

  const modifier = (stat) => Math.floor((stat - 10) / 2);
  const meleeText = () => `1d6 + ${modifier(currentChar.str || 10)}`;

  const levelUp = () => {
    const updated = { ...currentChar };
    updated.level += 1;
    updated.maxHp += Math.floor(updated.maxHp * 0.25) + modifier(updated.con);
    updated.hp = updated.maxHp;
    updated.maxBar += 10 + modifier(updated.int) + modifier(updated.wis);
    updated.currentBar = updated.maxBar;
    updated.reflex += 1;
    setSkillPoints(prev => prev + 3);
    setActionPoints(3);
    setCurrentChar(updated);
  };

  const updateStat = (stat) => {
    if (skillPoints <= 0) return;
    const updated = { ...currentChar };
    updated[stat] += 1;
    setSkillPoints(prev => prev - 1);
    setCurrentChar(updated);
  };

  const takeDamage = (amount) => {
    const updated = { ...currentChar };
    updated.hp = Math.max(0, updated.hp - amount);
    setCurrentChar(updated);
  };

  const heal = (amount) => {
    const updated = { ...currentChar };
    updated.hp = Math.min(updated.maxHp, updated.hp + amount);
    setCurrentChar(updated);
  };

  const reduceBar = (amount) => {
    const updated = { ...currentChar };
    updated.currentBar = Math.max(0, updated.currentBar - amount);
    setCurrentChar(updated);
  };

  const restoreBar = (amount) => {
    const updated = { ...currentChar };
    updated.currentBar = Math.min(updated.maxBar, updated.currentBar + amount);
    setCurrentChar(updated);
  };

  // ... All other functions like chooseRace, checkPasscode, etc. remain unchanged

  return (
    <div>
      <h1>OP DND</h1>

      {screen === 'Main' && currentChar && (
        <>
          <h2>{currentChar.name} (Lvl {currentChar.level})</h2>
          <p>HP: {currentChar.hp} / {currentChar.maxHp}</p>
          <p>Bar: {currentChar.currentBar} / {currentChar.maxBar}</p>
          <p>Reflex: {currentChar.reflex}</p>
          <p><strong>Melee:</strong> {meleeText()}</p>

          <h3>Stats</h3>
          {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(stat => (
            <div key={stat}>
              {stat.toUpperCase()}: {currentChar[stat]}{' '}
              <button onClick={() => updateStat(stat)}>+</button>{' '}
              Modifier: {modifier(currentChar[stat]) >= 0 ? '+' : ''}{modifier(currentChar[stat])}
            </div>
          ))}
          <p>Skill Points: {skillPoints}</p>
          <button onClick={levelUp}>Level Up</button>

          <h3>Health Management</h3>
          <input type="number" placeholder="Amount" id="dmgInput" />
          <button onClick={() => takeDamage(parseInt(document.getElementById('dmgInput').value))}>Take Damage</button>
          <button onClick={() => heal(parseInt(document.getElementById('dmgInput').value))}>Heal</button>

          <h3>Bar Management</h3>
          <input type="number" placeholder="Amount" id="barInput" />
          <button onClick={() => reduceBar(parseInt(document.getElementById('barInput').value))}>Use Bar</button>
          <button onClick={() => restoreBar(parseInt(document.getElementById('barInput').value))}>Regain Bar</button>
        </>
      )}

      {screen === 'Equipment' && (
        <EquipmentSheet equipment={equipment} setEquipment={setEquipment} />
      )}
    </div>
  );
}
