import { useState, useEffect } from 'react'; import { supabase } from './supabaseClient'; import races from './data/races'; import devilFruits from './data/devilFruits'; import equipmentData from './data/equipment';

const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }; const calcMod = (stat) => Math.floor((stat - 10) / 2);

export default function App() { const [step, setStep] = useState(1); const [newChar, setNewChar] = useState({ name: '', passcode: '', fruit: false }); const [currentChar, setCurrentChar] = useState(null); const [charList, setCharList] = useState([]); const [actionPoints, setActionPoints] = useState(3);

useEffect(() => { fetchCharacters(); }, []);

const fetchCharacters = async () => { const { data, error } = await supabase.from('characters').select('*'); if (error) { console.error("Failed to fetch characters:", error); } else if (data) { const parsedCharacters = data.map(entry => entry.data); setCharList(parsedCharacters); } };

async function saveCharacter(character) { if (!character || !character.id) return; const { data, error } = await supabase .from('characters') .upsert({ id: character.id, data: character });

if (error) {
  console.error('❌ Error saving character:', error);
} else {
  console.log('✅ Character saved:', data);
}

}

const createChar = () => { if (!newChar.name || !newChar.passcode) return; setStep(2); };

const chooseRace = (raceKey) => { const race = races[raceKey]; const stats = { ...initStats }; Object.entries(race.bonuses || {}).forEach(([k, v]) => (stats[k] += v)); const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null; const level = 1; const derived = calculateDerived(stats, level, race); const char = { ...newChar, id: Date.now().toString(), race: raceKey, stats, level, sp: race.sp, ...derived, fruit, currentHp: derived.hp, currentBar: derived.bar, }; setCharList((prev) => [...prev, char]); saveCharacter(char); setCurrentChar(char); setActionPoints(3); setStep(4); };

const calculateDerived = (stats, level, raceObj) => { const hp = 20 + calcMod(stats.con) + (level - 1) * 5; const bar = 100 + calcMod(stats.int) + calcMod(stats.wis); const reflex = calcMod(stats.dex) + level; const melee = 1d6 + ${calcMod(stats.str)}; return { hp, bar, reflex, melee }; };

const levelUp = () => { if (!currentChar) return; const level = currentChar.level + 1; const derived = calculateDerived(currentChar.stats, level, races[currentChar.race]); const updated = { ...currentChar, level, sp: currentChar.sp + 3, ...derived, currentHp: derived.hp, currentBar: derived.bar, }; setCurrentChar(updated); saveCharacter(updated); };

const increaseStat = (stat) => { if (!currentChar || currentChar.sp <= 0) return; const stats = { ...currentChar.stats, [stat]: currentChar.stats[stat] + 1 }; const derived = calculateDerived(stats, currentChar.level, races[currentChar.race]); const updated = { ...currentChar, stats, sp: currentChar.sp - 1, ...derived, }; setCurrentChar(updated); saveCharacter(updated); };

const takeDamage = (val) => { if (!currentChar) return; const updated = { ...currentChar, currentHp: Math.max(0, currentChar.currentHp - val) }; setCurrentChar(updated); saveCharacter(updated); };

const heal = (val) => { if (!currentChar) return; const updated = { ...currentChar, currentHp: Math.min(updated.hp, currentChar.currentHp + val) }; setCurrentChar(updated); saveCharacter(updated); };

const enterChar = (char) => { const input = prompt('Enter 4-digit passcode'); if (input === char.passcode) { setCurrentChar(char); setActionPoints(3); setStep(4); } else { alert('Incorrect passcode.'); } };

// UI Screens

if (step === 1) return ( <div> <h1>OPDND</h1> <input placeholder="Character Name" onChange={(e) => setNewChar({ ...newChar, name: e.target.value })} /> <input placeholder="4-digit Passcode" onChange={(e) => setNewChar({ ...newChar, passcode: e.target.value })} /> <label><input type="checkbox" onChange={(e) => setNewChar({ ...newChar, fruit: e.target.checked })} /> Start with Devil Fruit?</label> <button onClick={createChar}>Create</button>

<h2>Characters</h2>
  <ul>
    {charList.map((char, i) => (
      <li key={i}><button onClick={() => enterChar(char)}>{char.name} ({char.race})</button></li>
    ))}
  </ul>
</div>

);

if (step === 2) return ( <div> <h2>Select a Race</h2> {Object.entries(races).map(([key, race]) => ( <button key={key} onClick={() => chooseRace(key)}> {key}: {race.description} </button> ))} </div> );

if (step === 4 && currentChar) return ( <div> <button onClick={() => setStep(1)}>← Back</button> <h2>{currentChar.name} (Level {currentChar.level})</h2> <p><strong>Race:</strong> {currentChar.race}</p> {currentChar.fruit && ( <> <p><strong>Devil Fruit:</strong> {currentChar.fruit.name}</p> <em>{currentChar.fruit.ability}</em> </> )} <p><strong>HP:</strong> {currentChar.currentHp} / {currentChar.hp} | <strong>Bar:</strong> {currentChar.currentBar} / {currentChar.bar} | <strong>Reflex:</strong> {currentChar.reflex} <strong>Melee:</strong> {currentChar.melee}</p> <button onClick={levelUp}>Level Up (+3 SP & full restore)</button> <br /> <button onClick={() => setStep(4)}>Main</button> <button onClick={() => setStep(5)}>Actions</button> <button onClick={() => setStep(6)}>Equipment</button>

<h3>Main Stats</h3>
  <ul>
    {Object.entries(currentChar.stats).map(([stat, value]) => (
      <li key={stat}>{stat.toUpperCase()}: {value} + Modifier: {calcMod(value)} <button onClick={() => increaseStat(stat)}>+</button></li>
    ))}
  </ul>
  <p>Skill Points: {currentChar.sp}</p>
  <h4>Health Management</h4>
  <input type="number" id="hpVal" defaultValue={0} />
  <button onClick={() => takeDamage(parseInt(document.getElementById('hpVal').value))}>Take Damage</button>
  <button onClick={() => heal(parseInt(document.getElementById('hpVal').value))}>Heal</button>
</div>

);

return <div>Loading...</div>; }

