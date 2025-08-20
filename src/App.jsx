import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { races } from "./races";
import { devilFruits } from "./devilFruits";
import { calculateMaxHealth, applyDamage, applyHeal } from "./healthUtils";
import { calculateMaxBar, spendBar, gainBar } from "./barUtils";
import { defaultActions } from "./actionsUtils";
import EquipmentSheet from "./EquipmentSheet";
import { equipmentList } from "./equipmentData";
import { getFruitActions } from "./devilFruitActions";
import Overview from "./Overview";

/* ----------------------------------
   Small helpers
-----------------------------------*/
async function saveCharacter(character) {
  if (!character || !character.id) return;
  const { error } = await supabase.from("characters").upsert({ id: character.id, data: character });
  if (error) console.error("❌ Error saving character:", error);
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toMod(score) {
  // D&D-like: floor((score-10)/2). We already store scores; DM UI edits "mod",
  // so convert back to a plausible score centered on mod.
  // score ~= mod*2 + 10
  return Math.floor((score - 10) / 2);
}
function modToScore(mod) {
  return mod * 2 + 10;
}

/* Recalc HP/Bar/Reflex from race/stats/level */
function recalcDerivedFrom(char) {
  const race = races[char.race] || {};
  const stats = char.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const level = char.level || 1;
  const baseHP = race.hp || 20;
  const baseBar = race.bar || 100;
  const hp = calculateMaxHealth(baseHP, stats.con ?? 10, level);
  const bar = calculateMaxBar(baseBar, stats.int ?? 10, stats.wis ?? 10, level);
  const reflex = (race.reflex || 5) + Math.floor((stats.dex ?? 10) / 5) + Math.floor(level / 3);
  return { hp, bar, reflex };
}

export default function App() {
  // ----- App-level state -----
  const [step, setStep] = useState(1); // 0: Overview, 1: Home, 2: Choose Race, 3: DevTools, 4: Sheet
  const [charList, setCharList] = useState([]);
  const [currentChar, setCurrentChar] = useState(null);

  // creation
  const [newChar, setNewChar] = useState({ name: "", passcode: "", fruit: false });

  // sheet UI
  const [screen, setScreen] = useState("Main");
  const [damageAmount, setDamageAmount] = useState(0);
  const [barAmount, setBarAmount] = useState(0);
  const [actionPoints, setActionPoints] = useState(3);
  const [customActions, setCustomActions] = useState([]);

  // equipment is mirrored locally for smoother UI
  const [equipment, setEquipment] = useState([{ name: "", quantity: 1, customDesc: "" }]);

  // custom action input
  const [newActionName, setNewActionName] = useState("");
  const [newActionBarCost, setNewActionBarCost] = useState(0);

  // persistent effects paid each turn (devil fruit, auras, etc.)
  const [activeEffects, setActiveEffects] = useState([]); // [{name, perTurnCost}]

  // constants
  const initStats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  function calculateDerived(stats, level = 1, race = {}) {
    const baseHP = race.hp || 20;
    const baseBar = race.bar || 100;
    const hp = calculateMaxHealth(baseHP, stats.con ?? 10, level);
    const bar = calculateMaxBar(baseBar, stats.int ?? 10, stats.wis ?? 10, level);
    const reflex = (race.reflex || 5) + Math.floor((stats.dex ?? 10) / 5) + Math.floor(level / 3);
    return { hp, bar, reflex };
  }

  /* ----------------------------------
     Load characters once (no auto-open)
  -----------------------------------*/
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("characters").select("*");
      if (error) {
        console.error("Failed to fetch characters:", error);
        return;
      }
      setCharList((data || []).map((row) => row.data));
    })();
  }, []);

  /* ----------------------------------
     Load a single character
  -----------------------------------*/
  const loadCharacter = async (id) => {
    const { data, error } = await supabase.from("characters").select("*").eq("id", id).single();
    if (error) {
      console.error("❌ Error loading character:", error);
      return;
    }
    if (data?.data) {
      const loaded = data.data;
      setCurrentChar(loaded);
      setEquipment(
        loaded.equipment && Array.isArray(loaded.equipment) && loaded.equipment.length
          ? loaded.equipment
          : [{ name: "", quantity: 1, customDesc: "" }]
      );
      setActionPoints(3);
      setActiveEffects(loaded.activeEffects || []);
      setScreen("Main");
      setStep(4);
    }
  };

  /* ----------------------------------
     Creation flow
  -----------------------------------*/
  const startCreation = (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const passcode = e.target.passcode.value.trim();
    const fruit = !!e.target.fruit.checked;
    if (!name || passcode.length !== 4) {
      alert("Enter a name and a 4-digit passcode");
      return;
    }
    setNewChar({ name, passcode, fruit });
    setStep(2);
  };

  const chooseRace = (raceKey) => {
    const race = races[raceKey];
    const stats = { ...initStats };
    (Object.entries(race.bonuses || {}) || []).forEach(([k, v]) => (stats[k] = (stats[k] || 10) + v));
    const fruit = newChar.fruit ? devilFruits[Math.floor(Math.random() * devilFruits.length)] : null;
    const level = 1;
    const derived = calculateDerived(stats, level, race);
    const char = {
      ...newChar,
      id: Date.now().toString(),
      race: raceKey,
      stats,
      level,
      sp: race.sp, // starting skill points from race data
      ...derived,
      fruit,
      meleeText: "1d6", // editable in DM tools
      meleeFlatBonus: 0, // editable in DM tools (added on top of STR mod if desired)
      currentHp: derived.hp,
      currentBar: derived.bar,
      equipment: [],
      activeEffects: [],
      skills: [],
    };
    setCharList((prev) => [...prev, char]);
    setCurrentChar(char);
    setEquipment([]);
    setActiveEffects([]);
    setActionPoints(3);
    setScreen("Main");
    setStep(4);
    saveCharacter(char);
  };

  /* ----------------------------------
     Enter / delete
  -----------------------------------*/
  const enterChar = async (char) => {
    const pass = prompt("Enter 4-digit passcode");
    if (pass === char.passcode) {
      await loadCharacter(char.id);
    } else {
      alert("Incorrect passcode");
    }
  };

  const deleteCharacter = async (char) => {
    const pass = prompt(`Enter 4-digit passcode to DELETE "${char.name}"`);
    if (pass !== char.passcode) {
      alert("Incorrect passcode");
      return;
    }
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("characters").delete().eq("id", char.id);
    if (error) {
      console.error("❌ Error deleting character:", error);
      alert("Failed to delete character.");
      return;
    }
    setCharList((prev) => prev.filter((c) => c.id !== char.id));
    if (currentChar?.id === char.id) {
      setCurrentChar(null);
      setStep(1);
    }
  };

  /* ----------------------------------
     Stat & level up on sheet
  -----------------------------------*/
  const increaseStat = (statKey) => {
    if (!currentChar || currentChar.sp <= 0) return;
    const updated = { ...currentChar };
    updated.stats = { ...(updated.stats || {}) };
    updated.stats[statKey] = (updated.stats[statKey] ?? 10) + 1;
    updated.sp = (updated.sp ?? 0) - 1;
    const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
    Object.assign(updated, derived);
    updated.currentHp = Math.min(updated.currentHp, updated.hp);
    updated.currentBar = Math.min(updated.currentBar, updated.bar);
    setCurrentChar(updated);
    saveCharacter(updated);
  };

  const levelUp = () => {
    if (!currentChar) return;
    const updated = { ...currentChar };
    updated.level = (updated.level || 1) + 1;
    updated.sp = (updated.sp || 0) + 3; // grant SP
    const derived = calculateDerived(updated.stats, updated.level, races[updated.race]);
    Object.assign(updated, derived);
    updated.currentHp = derived.hp;
    updated.currentBar = derived.bar;
    setCurrentChar(updated);
    saveCharacter(updated);
    setActionPoints(3);
  };

  /* ----------------------------------
     Equipment -> Actions bridge
  -----------------------------------*/
  const equipmentActions = useMemo(() => {
    const names = equipment.filter((it) => it && it.name && it.name !== "").map((it) => it.name);
    const distinct = uniqueBy(names, (n) => n);
    return distinct.map((n) => {
      const meta = equipmentList.find((e) => e.name === n) || {};
      const cost = Number(meta.useCost) || 0;
      return { name: `Use ${n}`, barCost: cost, _kind: "equipment", itemName: n };
    });
  }, [equipment]);

  /* ----------------------------------
     Devil Fruit -> Actions bridge (from data file)
  -----------------------------------*/
  const devilFruitActions = useMemo(() => {
    const fruitName = currentChar?.fruit?.name;
    return fruitName ? getFruitActions(fruitName) : [];
  }, [currentChar]);

  /* Combined actions for sheet */
  const actionsToShow = useMemo(
    () => [...defaultActions, ...equipmentActions, ...devilFruitActions, ...customActions],
    [equipmentActions, devilFruitActions, customActions]
  );

  /* Persistors for equipment/effects */
  const persistEquipment = (updated) => {
    setEquipment(updated);
    if (!currentChar) return;
    const updatedChar = { ...currentChar, equipment: updated };
    setCurrentChar(updatedChar);
    saveCharacter(updatedChar);
  };

  const persistEffects = (updated) => {
    setActiveEffects(updated);
    if (!currentChar) return;
    const updatedChar = { ...currentChar, activeEffects: updated };
    setCurrentChar(updatedChar);
    saveCharacter(updatedChar);
  };

  /* ----------------------------------
     Admin / DM helpers (also used by DevTools)
  -----------------------------------*/
  const adminDelete = async (char) => {
    if (!confirm(`Delete ${char.name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("characters").delete().eq("id", char.id);
    if (error) {
      alert("Delete failed.");
      return;
    }
    setCharList((prev) => prev.filter((c) => c.id !== char.id));
  };

  const adminCopy = async (char) => {
    const clone = {
      ...char,
      id: `${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${char.name} (Copy)`,
    };
    const { error } = await supabase.from("characters").insert({ id: clone.id, data: clone });
    if (error) {
      alert("Copy failed.");
      return;
    }
    setCharList((prev) => [...prev, clone]);
  };

  const adminLevelAdjust = async (char, delta) => {
    const next = { ...char, level: clamp((char.level || 1) + delta, 1, 99) };
    // change SP along with level (±3 per level)
    next.sp = (next.sp || 0) + (delta > 0 ? 3 : -3);
    const derived = recalcDerivedFrom(next);
    Object.assign(next, derived);
    next.currentHp = Math.min(next.currentHp ?? next.hp, next.hp);
    next.currentBar = Math.min(next.currentBar ?? next.bar, next.bar);
    await saveCharacter(next);
    setCharList((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    if (currentChar?.id === next.id) setCurrentChar(next);
  };

  const adminModifyFruit = async (char) => {
    const current = char.fruit?.name || "";
    const names = devilFruits.map((f) => f.name).join(", ");
    const input = prompt(`Enter Devil Fruit name (or 'none' to remove)\nAvailable: ${names}`, current);
    if (input === null) return;
    const trimmed = input.trim();
    const next = { ...char };
    if (!trimmed || trimmed.toLowerCase() === "none") {
      next.fruit = null;
    } else {
      const found = devilFruits.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
      if (!found) {
        alert("Fruit not found.");
        return;
      }
      next.fruit = { name: found.name, ability: found.ability };
    }
    await saveCharacter(next);
    setCharList((prev) => prev.map((c) => (c.id === next.id ? next : c)));
    if (currentChar?.id === next.id) setCurrentChar(next);
  };

  /* ----------------------------------
     Renders
  -----------------------------------*/

  // Overview as its own page
  if (step === 0) return <Overview onBack={() => setStep(1)} />;

  // DevTools page (fully safe & self-contained)
  if (step === 3) {
    const [selectedId, setSelectedId] = useState(null);

    // local editor for selected character
    const selected = useMemo(() => charList.find((c) => c.id === selectedId) || null, [charList, selectedId]);

    const patchAndSave = async (patch) => {
      if (!selected) return;
      const next = { ...selected, ...patch };

      // keep fields safe
      next.stats = { ...(selected.stats || {}), ...(patch.stats || {}) };
      if (patch.level !== undefined || patch.stats) {
        const derived = recalcDerivedFrom(next);
        Object.assign(next, derived);
        next.currentHp = Math.min(next.currentHp ?? next.hp, next.hp);
        next.currentBar = Math.min(next.currentBar ?? next.bar, next.bar);
      }

      await saveCharacter(next);
      setCharList((prev) => prev.map((c) => (c.id === next.id ? next : c)));
      if (currentChar?.id === next.id) setCurrentChar(next);
    };

    // editor controls
    const inc = (key, amount) => patchAndSave({ [key]: clamp((selected?.[key] || 0) + amount, 0, 9999) });

    const setMeleeText = () => {
      const txt = prompt("Enter melee dice text (e.g. 1d6, 1d8, 2d4):", selected?.meleeText || "1d6");
      if (txt === null) return;
      patchAndSave({ meleeText: txt.trim() || "1d6" });
    };
    const setMeleeFlat = () => {
      const n = prompt("Enter melee flat bonus (adds on top of STR mod):", String(selected?.meleeFlatBonus || 0));
      if (n === null) return;
      const v = Number(n);
      if (!Number.isFinite(v)) return;
      patchAndSave({ meleeFlatBonus: v });
    };

    const setMod = (ability, delta) => {
      const scoreNow = selected?.stats?.[ability] ?? 10;
      const modNow = toMod(scoreNow);
      const modNext = modNow + delta;
      const scoreNext = modToScore(modNext);
      patchAndSave({ stats: { [ability]: scoreNext } });
    };

    const setSkillPoints = (delta) => patchAndSave({ sp: clamp((selected?.sp || 0) + delta, 0, 999) });

    return (
      <div style={{ padding: "1rem" }}>
        <button onClick={() => setStep(1)}>← Back</button>
        <h1>Dungeon Master Tools</h1>
        <p style={{ color: "#666" }}>Administer characters below.</p>

        {/* List */}
        <ul>
          {charList.map((c) => (
            <li key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <button
                onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                style={{ minWidth: 280, textAlign: "left" }}
                title="Open editor"
              >
                {c.name} ({c.race}, Lv {c.level || 1})
              </button>
              <button onClick={() => adminDelete(c)} style={{ background: "#fde7e7" }}>
                Delete
              </button>
              <button onClick={() => adminCopy(c)}>Copy</button>
              <button onClick={() => adminLevelAdjust(c, +1)}>Lvl +</button>
              <button onClick={() => adminLevelAdjust(c, -1)}>Lvl -</button>
              <button onClick={() => adminModifyFruit(c)}>Modify DevilFruit</button>
            </li>
          ))}
        </ul>

        {/* Editor */}
        {selected && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", border: "1px solid #ddd", borderRadius: 6 }}>
            <h3 style={{ marginTop: 0 }}>
              Editing: {selected.name} ({selected.race}, Lv {selected.level || 1})
            </h3>

            {/* Core derived stats */}
            <div style={{ display: "grid", gridTemplateColumns: "200px auto", rowGap: 8 }}>
              <div>
                <strong>Max Health:</strong> {selected.hp ?? 0}
              </div>
              <div>
                <button onClick={() => inc("hp", +1)}>+</button>
                <button onClick={() => inc("hp", -1)} style={{ marginLeft: 6 }}>
                  -
                </button>
              </div>

              <div>
                <strong>Max Bar:</strong> {selected.bar ?? 0}
              </div>
              <div>
                <button onClick={() => inc("bar", +1)}>+</button>
                <button onClick={() => inc("bar", -1)} style={{ marginLeft: 6 }}>
                  -
                </button>
              </div>

              <div>
                <strong>Reflex:</strong> {selected.reflex ?? 0}
              </div>
              <div>
                <button onClick={() => inc("reflex", +1)}>+</button>
                <button onClick={() => inc("reflex", -1)} style={{ marginLeft: 6 }}>
                  -
                </button>
              </div>

              <div>
                <strong>Melee:</strong>{" "}
                {(selected.meleeText || "1d6") +
                  " + " +
                  (toMod(selected?.stats?.str ?? 10) + (selected?.meleeFlatBonus || 0))}
              </div>
              <div>
                <button onClick={setMeleeText}>Edit dice</button>
                <button onClick={setMeleeFlat} style={{ marginLeft: 6 }}>
                  Edit flat bonus
                </button>
              </div>
            </div>

            <hr style={{ margin: "1rem 0" }} />

            {/* Ability modifiers (edit as mods) */}
            <div style={{ display: "grid", gridTemplateColumns: "100px auto", rowGap: 6 }}>
              {["cha", "con", "dex", "int", "str", "wis"].map((k) => {
                const score = selected?.stats?.[k] ?? 10;
                const mod = toMod(score);
                return (
                  <React.Fragment key={k}>
                    <div>
                      <strong>{k.toUpperCase()}:</strong> {mod >= 0 ? `+${mod}` : mod}
                    </div>
                    <div>
                      <button onClick={() => setMod(k, +1)}>+</button>
                      <button onClick={() => setMod(k, -1)} style={{ marginLeft: 6 }}>
                        -
                      </button>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <hr style={{ margin: "1rem 0" }} />

            {/* Skill points */}
            <div>
              <strong>Skill Points:</strong> {selected.sp ?? 0}{" "}
              <button onClick={() => setSkillPoints(+1)}>+</button>
              <button onClick={() => setSkillPoints(-1)} style={{ marginLeft: 6 }}>
                -
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Choose race page
  if (step === 2) {
    return (
      <div style={{ padding: "1rem" }}>
        <h2>Choose a Race</h2>
        {Object.entries(races).map(([name, data]) => (
          <div key={name} style={{ marginBottom: "1rem", borderBottom: "1px solid #ddd" }}>
            <h3>{name}</h3>
            <p>{data.description}</p>
            <button onClick={() => chooseRace(name)}>Choose {name}</button>
          </div>
        ))}
      </div>
    );
  }

  // Character sheet
  if (step === 4 && currentChar) {
    const strMod = Math.floor(((currentChar.stats?.str ?? 10) - 10) / 2);
    return (
      <div style={{ padding: "1rem" }}>
        <button onClick={() => { setCurrentChar(null); setStep(1); }}>← Back</button>

        <h2>
          {currentChar.name} (Level {currentChar.level})
        </h2>
        <p>
          <strong>Race:</strong> {currentChar.race}
        </p>

        <p>
          <strong>HP:</strong> {currentChar.currentHp} / {currentChar.hp} |{" "}
          <strong>Bar:</strong> {currentChar.currentBar} / {currentChar.bar} |{" "}
          <strong>Reflex:</strong> {currentChar.reflex} |{" "}
          <strong>Melee:</strong>{" "}
          {(currentChar.meleeText || "1d6") + " + " + (strMod + (currentChar.meleeFlatBonus || 0))}
        </p>

        <button onClick={levelUp}>Level Up (+3 SP & full restore)</button>

        <div style={{ marginTop: "1rem" }}>
          {["Main", "Actions", "Equipment", "Devil Fruit", "Skill Tree"].map((tab) => (
            <button key={tab} onClick={() => setScreen(tab)} style={{ marginRight: "0.5rem" }}>
              {tab}
            </button>
          ))}
        </div>

        {screen === "Main" && (
          <>
            <h3>Main Stats</h3>
            <ul>
              {Object.entries(currentChar.stats).map(([k, v]) => (
                <li key={k}>
                  {k.toUpperCase()}: {v}
                  {currentChar.sp > 0 && (
                    <button onClick={() => increaseStat(k)} style={{ marginLeft: "0.5rem" }}>
                      +
                    </button>
                  )}{" "}
                  Modifier: {(v - 10 >= 0 ? "+" : "") + Math.floor((v - 10) / 2)}
                </li>
              ))}
            </ul>
            <p>Skill Points: {currentChar.sp}</p>

            <h4>Health Management</h4>
            <p>
              Current HP: {currentChar.currentHp} / {currentChar.hp}
            </p>
            <input
              type="number"
              value={damageAmount}
              onChange={(e) => setDamageAmount(Number(e.target.value))}
              placeholder="Amount"
              style={{ width: "60px" }}
            />
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentHp = applyDamage(updated.currentHp, damageAmount);
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
            >
              Take Damage
            </button>
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentHp = applyHeal(updated.currentHp, updated.hp, damageAmount);
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
              style={{ marginLeft: "0.5rem" }}
            >
              Heal
            </button>

            <h4>Bar Management</h4>
            <p>
              Current Bar: {currentChar.currentBar} / {currentChar.bar}
            </p>
            <input
              type="number"
              value={barAmount}
              onChange={(e) => setBarAmount(Number(e.target.value))}
              placeholder="Amount"
              style={{ width: "60px" }}
            />
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentBar = spendBar(updated.currentBar, barAmount);
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
            >
              Use Bar
            </button>
            <button
              onClick={() => {
                const updated = { ...currentChar };
                updated.currentBar = gainBar(updated.currentBar, updated.bar, barAmount);
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
              style={{ marginLeft: "0.5rem" }}
            >
              Regain Bar
            </button>

            {/* Rest buttons */}
            <div style={{ marginTop: "1rem" }}>
              <button
                style={{ color: "crimson", marginRight: "1rem" }}
                onClick={() => {
                  const updated = { ...currentChar };
                  // Long Rest: +10 HP (cap at max), Bar to full
                  updated.currentHp = Math.min(updated.currentHp + 10, updated.hp);
                  updated.currentBar = updated.bar;
                  setCurrentChar(updated);
                  saveCharacter(updated);
                }}
              >
                Long Rest
              </button>
              <button
                style={{ color: "crimson" }}
                onClick={() => {
                  const updated = { ...currentChar };
                  // Short Rest: +50% of max bar (cap at max)
                  const bonus = Math.floor(updated.bar * 0.5);
                  updated.currentBar = Math.min(updated.currentBar + bonus, updated.bar);
                  setCurrentChar(updated);
                  saveCharacter(updated);
                }}
              >
                Short Rest
              </button>
            </div>
          </>
        )}

        {screen === "Actions" && (
          <>
            <h3>Actions</h3>
            <p>Action Points: {actionPoints}</p>
            <button
              onClick={() => {
                // start of turn: reset AP and charge persistent effects
                const totalUpkeep = activeEffects.reduce((sum, e) => sum + (Number(e.perTurnCost) || 0), 0);
                if (currentChar.currentBar < totalUpkeep) {
                  alert(`Not enough Bar to maintain effects (need ${totalUpkeep}). All effects turned off.`);
                  persistEffects([]);
                  setActionPoints(3);
                  return;
                }
                const updated = { ...currentChar, currentBar: currentChar.currentBar - totalUpkeep };
                setCurrentChar(updated);
                saveCharacter(updated);
                setActionPoints(3);
              }}
            >
              Take Turn
            </button>

            {/* Active on Turn */}
            {activeEffects.length > 0 && (
              <div style={{ marginTop: "0.75rem", padding: "0.5rem", border: "1px dashed #aaa" }}>
                <strong>Active on Turn</strong>
                {activeEffects.map((eff, i) => (
                  <div key={`eff-${i}`} style={{ marginTop: "0.25rem" }}>
                    {eff.name} – {eff.perTurnCost} Bar
                    <button
                      style={{ marginLeft: "0.5rem" }}
                      onClick={() => {
                        const next = activeEffects.filter((_, idx) => idx !== i);
                        persistEffects(next);
                      }}
                    >
                      Turn Off
                    </button>
                  </div>
                ))}
              </div>
            )}

            {actionsToShow.map((action, i) => (
              <div key={`${action.name}-${i}`} style={{ marginTop: "0.5rem" }}>
                <strong>{action.name}</strong> – {action.barCost} Bar
                <button
                  onClick={() => {
                    const cost = action.barCost || 0;
                    if (actionPoints <= 0) {
                      alert("No Action Points left!");
                      return;
                    }
                    if (currentChar.currentBar < cost) {
                      alert("Not enough Bar!");
                      return;
                    }
                    const updated = { ...currentChar };
                    updated.currentBar -= cost; // upfront cost
                    setCurrentChar(updated);
                    saveCharacter(updated);
                    setActionPoints((prev) => prev - 1); // spend AP

                    // toggle upkeep effect on
                    if (action.perTurnCost && action.perTurnCost > 0) {
                      const already = activeEffects.some((e) => e.name === action.name);
                      if (!already) persistEffects([...activeEffects, { name: action.name, perTurnCost: action.perTurnCost }]);
                    }
                  }}
                  style={{ marginLeft: "1rem" }}
                >
                  Use
                </button>
              </div>
            ))}

            <h4 style={{ marginTop: "1rem" }}>Add Custom Action</h4>
            <input
              placeholder="Action Name"
              value={newActionName}
              onChange={(e) => setNewActionName(e.target.value)}
              style={{ marginRight: "0.5rem" }}
            />
            <input
              type="number"
              placeholder="Bar Cost"
              value={newActionBarCost}
              onChange={(e) => setNewActionBarCost(Number(e.target.value))}
              style={{ width: "60px", marginRight: "0.5rem" }}
            />
            <button
              onClick={() => {
                if (!newActionName) return;
                setCustomActions((prev) => [...prev, { name: newActionName, barCost: newActionBarCost }]);
                setNewActionName("");
                setNewActionBarCost(0);
              }}
            >
              Add
            </button>
          </>
        )}

        {screen === "Equipment" && <EquipmentSheet equipment={equipment} setEquipment={persistEquipment} />}

        {screen === "Devil Fruit" && (
          <div style={{ marginTop: "0.75rem" }}>
            <h3>Devil Fruit</h3>
            {currentChar.fruit ? (
              <>
                <div>
                  <strong>Name:</strong> {currentChar.fruit.name}
                </div>
                {currentChar.fruit.ability && <p style={{ marginTop: "0.5rem" }}><em>{currentChar.fruit.ability}</em></p>}
                {devilFruitActions.length > 0 && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <strong>Starting Actions</strong>
                    <ul>
                      {devilFruitActions.map((a, i) => (
                        <li key={`dfa-${i}`}>
                          {a.name} – {a.barCost} Bar{a.perTurnCost ? ` + ${a.perTurnCost}/turn` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p>No Devil Fruit.</p>
            )}
          </div>
        )}

        {screen === "Skill Tree" && (
          <div style={{ marginTop: "0.75rem" }}>
            <h3>Skill Tree</h3>
            <p>Skill Points: {currentChar.sp}</p>
            <button
              onClick={() => {
                if (currentChar.sp <= 0) {
                  alert("No Skill Points left.");
                  return;
                }
                const updated = { ...currentChar, sp: currentChar.sp - 1 };
                setCurrentChar(updated);
                saveCharacter(updated);
              }}
            >
              Spend Skill Point
            </button>

            <div style={{ marginTop: "1rem" }}>
              <button
                onClick={() => {
                  const name = prompt("Skill name?");
                  if (!name) return;
                  const desc = prompt("Skill description?") || "";
                  const updated = { ...currentChar };
                  const next = Array.isArray(updated.skills) ? [...updated.skills] : [];
                  next.push({ name, description: desc });
                  updated.skills = next;
                  setCurrentChar(updated);
                  saveCharacter(updated);
                }}
              >
                + Add Skill
              </button>
            </div>

            {Array.isArray(currentChar.skills) && currentChar.skills.length > 0 && (
              <ul style={{ marginTop: "1rem" }}>
                {currentChar.skills.map((s, i) => (
                  <li key={`skill-${i}`}>
                    <strong>{s.name}</strong>
                    {s.description ? ` — ${s.description}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ----------------------------------
     Home
  -----------------------------------*/
  return (
    <div style={{ padding: "1rem", position: "relative", minHeight: "100vh" }}>
      <h1>OPDND</h1>

      {/* Overview button */}
      <div style={{ position: "fixed", right: "1rem", top: "1rem" }}>
        <button style={{ color: "crimson" }} onClick={() => setStep(0)}>
          Overview
        </button>
      </div>

      <form onSubmit={startCreation}>
        <input name="name" placeholder="Character Name" required />
        <input name="passcode" placeholder="4-digit Passcode" maxLength="4" required />
        <label style={{ marginLeft: "1rem" }}>
          <input type="checkbox" name="fruit" /> Start with Devil Fruit?
        </label>
        <button type="submit" style={{ marginLeft: "1rem" }}>
          Create
        </button>
      </form>

      <h2 style={{ marginTop: "2rem" }}>Characters</h2>
      <ul>
        {charList.map((char) => (
          <li
            key={char.id}
            style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}
          >
            <button onClick={() => enterChar(char)}>
              {char.name} ({char.race})
            </button>
            <button
              onClick={() => deleteCharacter(char)}
              style={{ background: "#fbe9e9", border: "1px solid #e57373" }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      {/* Dev button */}
      <div style={{ position: "fixed", left: "1rem", bottom: "1rem" }}>
        <button
          style={{ color: "crimson" }}
          onClick={() => {
            const pin = prompt("Enter Dev PIN");
            if (pin === "5637") setStep(3);
            else alert("Incorrect PIN.");
          }}
        >
          DevTool Mode
        </button>
      </div>
    </div>
  );
}