import { useEffect, useState } from 'react'; import { supabase } from './supabaseClient'; import races from './races'; import devilFruits from './devilFruits'; import calculateDerived from './calculateDerived'; import EquipmentSheet from './EquipmentSheet'; import ActionSheet from './ActionSheet'; import './App.css';

const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

export default function App() { const [step, setStep] = useState(1); const [charList, setCharList] = useState([]); const [currentChar, setCurrentChar] = useState(null); const [newChar, setNewChar] = useState({ name: '', pin: '', fruit: false }); const [enteredPin, setEnteredPin] = useState(''); const [actionPoints, setActionPoints] = useState(3);

useEffect(() => { fetchCharacters(); }, []);

const fetchCharacters = async () => { const { data, error } = await supabase.from('characters').select('*'); if (error) { console.error('❌ Failed to fetch characters:', error); } else { const parsedCharacters = data.map(entry => entry.data); setCharList(parsedCharacters); } };

const saveCharacter = async (character) => { if (!character || !character.id) return; const { data, error } = await supabase .from('characters') .upsert({ id: character.id, data: character });

if (error) {
  console.error('❌ Error saving character:', error);
} else {
  console.log('✅ Character saved:', data);
}

};

const chooseRace = (raceKey) => { const race = races[raceKey]; const stats = { ...initStats }; Object.entries(race.bonuses || {}).forEach(([k, v]) => (stats[k] += v)); const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null; const level = 1; const derived = calculateDerived(stats, level, race); const char = { ...newChar, id: Date.now().toString(), race: raceKey, stats, level, sp: race.sp, ...derived, fruit, currentHp: derived.hp, currentBar: derived.bar, }; setCharList((prev) => [...prev, char]); saveCharacter(char); setCurrentChar(char); setActionPoints(3); setStep(4); };

const enterChar = (char) => { if (enteredPin === char.pin) { setCurrentChar(char); setActionPoints(3); setStep(4); } else { alert('❌ Incorrect PIN'); } };

const levelUp = () => { const updated = { ...currentChar, level: currentChar.level + 1, sp: currentChar.sp + 3, hp: currentChar.hp + Math.floor(currentChar.hp * 0.1), bar: currentChar.bar + Math.floor(currentChar.bar * 0.1), reflex: currentChar.reflex + 1, }; updated.currentHp = updated.hp; updated.currentBar = updated.bar; setCurrentChar(updated); saveCharacter(updated); };

return ( <div className="App"> {step === 1 && ( <div> <h1>OPDND</h1> <ul> {charList.map((char, i) => ( <li key={i}> <button onClick={() => enterChar(char)}> {char.name} ({char.race}) </button> </li> ))} </ul> <button onClick={() => setStep(2)}>Create New</button> </div> )}

{step === 2 && (
    <div>
      <h2>New Character</h2>
      <input
        placeholder="Name"
        value={newChar.name}
        onChange={(e) => setNewChar({ ...newChar, name: e.target.value })}
      />
      <input
        placeholder="4-digit PIN"
        value={newChar.pin}
        onChange={(e) => setNewChar({ ...newChar, pin: e.target.value })}
      />
      <label>
        <input
          type="checkbox"
          checked={newChar.fruit}
          onChange={(e) =>
            setNewChar({ ...newChar, fruit: e.target.checked })
          }
        />
        Assign Devil Fruit
      </label>
      <button onClick={() => setStep(3)}>Next</button>
    </div>
  )}

  {step === 3 && (
    <div>
      <h2>Choose Race</h2>
      <ul>
        {Object.keys(races).map((key) => (
          <li key={key}>
            <button onClick={() => chooseRace(key)}>{key}</button>
          </li>
        ))}
      </ul>
    </div>
  )}

  {step === 4 && currentChar && (
    <div>
      <button onClick={() => setStep(1)}>Back</button>
      <h2>{currentChar.name} ({currentChar.race})</h2>
      <p>Level: {currentChar.level}</p>
      <p>HP: {currentChar.currentHp} / {currentChar.hp}</p>
      <p>Bar: {currentChar.currentBar} / {currentChar.bar}</p>
      <p>Reflex: {currentChar.reflex}</p>
      <p>Melee: 1d6 + {Math.floor((currentChar.stats.str - 10) / 2)}</p>
      <button onClick={levelUp}>Level Up</button>

      <h3>Stats</h3>
      <ul>
        {Object.entries(currentChar.stats).map(([k, v]) => (
          <li key={k}>
            {k.toUpperCase()}: {v} Modifier: {Math.floor((v - 10) / 2)}
          </li>
        ))}
      </ul>

      <ActionSheet
        char={currentChar}
        setChar={setCurrentChar}
        saveCharacter={saveCharacter}
        actionPoints={actionPoints}
        setActionPoints={setActionPoints}
      />

      <EquipmentSheet
        char={currentChar}
        setChar={setCurrentChar}
        saveCharacter={saveCharacter}
      />
    </div>
  )}

  {step === 1 && (
    <div>
      <input
        placeholder="Enter PIN"
        value={enteredPin}
        onChange={(e) => setEnteredPin(e.target.value)}
      />
    </div>
  )}
</div>

); }

