// src/Overview.js
import React from 'react';

export default function Overview({ onBack }) {
  return (
    <div style={{ padding: '1rem' }}>
      <button onClick={onBack}>← Back</button>
      <h2>One Piece DND Campaign Overview</h2>

      <p>
        Welcome to the One Piece DND campaign! While it draws inspiration from
        standard DND, the mechanics here have been heavily reworked to fit the
        One Piece world. In many ways, this plays like an entirely new system.
        This guide is meant to explain what remains the same, outline all the new
        rules, and provide context for how to play.
      </p>

      <h3>What Stays the Same</h3>
      <ul>
        <li>
          <strong>Core Stats:</strong> Your six main stats (Strength, Dexterity,
          Constitution, Intelligence, Wisdom, Charisma) remain unchanged.
        </li>
        <li>
          <strong>Checks & Saves:</strong> When the DM asks for an Athletics
          check, Perception check, or a Constitution saving throw, you roll just
          like in normal DND.
        </li>
        <li>
          <strong>Rests:</strong> Short rests and long rests still exist. The
          process for taking them is unchanged, though the recovery math is
          different in this system.
        </li>
      </ul>
      <p>That’s essentially the full list of similarities. Everything else works differently.</p>

      <h3>Character Creation</h3>
      <ol>
        <li>
          <strong>Starting a Character:</strong> On the home screen, type in a
          name, choose a custom 4-digit PIN (example: 1234), decide whether to
          start with a random Devil Fruit, then click <em>Create</em>.
        </li>
        <li>
          <strong>Choosing a Race:</strong> After creating, you will be prompted
          to select a race. Once selected, your character sheet is ready.
        </li>
        <li>
          <strong>Character Sheet Layout:</strong> At the top of your sheet
          you’ll see your character name, race, and basic stats, along with a
          <em> Level Up</em> button. Below that are five tabs: Main, Actions,
          Equipment, Devil Fruit, and Skill Tree.
        </li>
      </ol>

      <h3>Tabs Explained</h3>
      <h4>Main Tab</h4>
      <p>
        Shows your six core stats, displays your total skill points, and lets
        you manage Health and Bar (explained later).
      </p>

      <h4>Actions Tab</h4>
      <p>
        This is where you take actions during your turn. You start each turn
        with <strong>3 action points</strong>. The <em>Take Turn</em> button
        resets your action points back to 3. At the bottom, you can create
        custom actions with custom Bar costs.
      </p>

      <h4>Equipment Tab</h4>
      <p>
        Lets you add and manage items. Each item has stats (damage, weight,
        durability, ammo). When you add equipment, the system automatically
        creates a corresponding action for it.
      </p>

      <h4>Devil Fruit Tab</h4>
      <p>
        Displays your Devil Fruit type (if you have one) and lists basic
        abilities and starting actions tied to that fruit.
      </p>

      <h4>Skill Tree Tab</h4>
      <p>
        Lets you spend skill points and track upgrades. Values are tracked here,
        but any new actions must be <strong>manually added</strong> in the
        Actions tab.
      </p>

      <h3>Unique Stats</h3>
      <h4>Bar</h4>
      <ul>
        <li>Bar is the most important unique stat.</li>
        <li>Almost every action consumes Bar.</li>
        <li>When Bar reaches 0, you pass out.</li>
        <li>Bar increases when you level up.</li>
        <li>It also scales with Wisdom and Intelligence.</li>
      </ul>

      <h4>Reflex</h4>
      <ul>
        <li>Reflex replaces AC in many cases.</li>
        <li>
          Used when blocking, dodging, or avoiding damage. Example: during a
          dodge, two characters roll Dexterity checks; higher roll wins. Ties
          require a reroll (including advantage/disadvantage effects).
        </li>
        <li>
          For ranged attacks (bows, guns, ship cannons), attackers roll against
          your Reflex stat instead of AC.
        </li>
        <li>
          When sailing, a ship uses the Reflex of its current pilot. Enemy ships
          firing at you roll against your ship’s Reflex.
        </li>
      </ul>

      <h3>Item Rules</h3>
      <h4>Durability</h4>
      <p>
        Some items (like shields or fishing rods) have durability. Using the
        item lowers its durability. If the DM doesn’t specify how much, reduce
        it by 1.
      </p>
      <ul>
        <li>
          Example: A shield loses durability equal to the damage it blocks.
        </li>
        <li>
          Example: A fishing rod normally loses 1 durability when used, but bad
          rolls can cause greater loss.
        </li>
      </ul>

      <h4>Ammo</h4>
      <p>
        Ranged weapons track ammo. Each shot lowers ammo by 1. At 0, you must
        reload, which costs 1 action point.
      </p>

      <h3>Currency</h3>
      <p>
        <strong>Berries</strong> are the in-world currency. Items may have
        preset prices, but the DM can always adjust costs and payouts.
      </p>

      <h3>Final Notes</h3>
      <p>
        This overview explains the foundation of the One Piece DND system.
        Anything not detailed here will either be clarified by the DM during
        play or added into the system later as new rules.
      </p>
    </div>
  );
}
