# 12 – Content-Bibliothek (Referenz-Seed)

> **Status: Referenz/Post-MVP.** Diese Tabellen sind **Befüllungs- und
> Balancing-Vorlage** für die Schemas aus [08 – Daten-Schemas](08-data-schemas.md),
> abgeleitet aus dem externen Recherche-Report. Sie sind **kein MVP-Scope** — der
> Vertical Slice nutzt nur eine kleine Teilmenge (siehe [11 – Roadmap](11-roadmap-and-mvp.md)).
>
> **IP-Hinweis ([ADR-012](decisions.md)):** Namen sind **eigenständig** gewählt
> (Spiritual Successor). Übernommen werden nur Struktur und Balancing-Logik, nicht
> die Klartextnamen des Vorbilds.

Alle Werte gelten als **Vorschlagsbasis** und werden empirisch getunt
([10 – Balancing](10-content-pipeline-and-balancing.md)).

---

## Skalierungsformeln (Gegner)
Basiswerte gelten für **Kapitel 1, Welle 1**.

- **HP** = `BaseHP × 1.11^(Kapitel−1) × (1 + 0.07 × (Welle−1))`
- **DMG** = `BaseDMG × 1.09^(Kapitel−1) × (1 + 0.05 × (Welle−1))`
- **Elite** = HP × 2.2, DMG × 1.5
- **Boss** = HP × 10, DMG × 2.0
- **Resistenz-Cap** = 60 % normal, 75 % Boss

Bewusst flacher als die Power-Spikes des Vorbilds → Spieler scheitern an
**Build-Checks**, nicht an reiner Statistikmauer. Als `ScalingProfile` in den
Content-Daten hinterlegt.

---

## Gegner — Normal & Elite
(→ `EnemyDef`, [08](08-data-schemas.md) §3.1)

| Gegner | Tier | Base HP | Base DMG | Resistenzen | Verhalten |
|---|---|---:|---:|---|---|
| Mug Gremlin | Normal | 45 | 10 | – | schneller Nahkämpfer, greift zuerst |
| Shambler | Normal | 80 | 9 | Gift 50 % | langsamer Tank, Frontlinie |
| Bone Archer | Normal | 55 | 12 | – | Backline-Fernkämpfer |
| Split Slime | Normal | 70 | 8 | Phys 20 % | zerfällt beim Tod in 2 Mini-Slimes |
| Fuse Imp | Normal | 40 | 18 | Feuer 50 % | explodiert nach 2 Runden / beim Tod |
| Shell Beetle | Normal | 95 | 10 | Front-Armor 40 % | blockt die ersten 2 Treffer |
| Flutter Swarm | Normal | 50 | 11 | Dodge 20 % | zwei kleine Treffer pro Runde |
| Hex Acolyte | Normal | 60 | 8 | Schatten 25 % | senkt Helden-ATK um 10 % |
| Fang Rider | Normal | 75 | 14 | – | Charge auf niedrigstes HP-% |
| Rime Shaman | Elite | 85 | 11 | Frost 50 % | 25 % Freeze-Chance, stützt Backline |
| Tomb Knight | Elite | 180 | 22 | Phys 25 %, Schatten 50 % | Cleave, priorisiert Front |
| Geode Mender | Elite | 140 | 10 | Arkan 25 % | heilt alle 2 Runden den schwächsten Verbündeten |
| Cinder Brute | Elite | 165 | 24 | Feuer 75 % | Burn-Cleave alle 3 Runden |

---

## Bosse
(→ `EnemyDef`, `role: 'boss'`)

| Boss | Base HP | Base DMG | Resistenzen | Mechanik | Welt |
|---|---:|---:|---|---|---|
| Brigand Lord | 820 | 25 | – | beschwört Gremlins bei 70 % & 40 % HP | Waldpfad |
| Grave Sovereign | 850 | 28 | Phys 25 %, Schatten 50 % | beschwört Skelette, cleavet Front | Katakomben |
| Ash Wyrm | 900 | 30 | Feuer 75 % | Brandlinie alle 3 Züge | Feuergrat |
| Rime Matron | 880 | 26 | Frost 75 % | globaler Slow/Freeze-Impuls | Frostpass |
| Null Regent | 950 | 32 | Schatten 75 % | Spiegelbilder bei 50 % HP | Schwarze Zitadelle |

> Bosse: **Telegraphing zwingend**, resistent gegen Execute/%-True-Damage/Reflect
> (Caps in [08 §1.1a](08-data-schemas.md)), **garantierter Item-Drop**.

---

## Welt- & Wellenstruktur
5 Welten × 6 Kapitel = **30 Launch-Kapitel**. Jedes Kapitel: 15 Wellen
(14 + Boss), eigenes Seed-Set, Drop-Tabellen, Weltmodifikator.

| Welt | Thema | Umweltregel | Boss |
|---|---|---|---|
| Waldpfad | Einstieg | +10 % BallDrop auf Normals | Brigand Lord |
| Feuergrat | Burn | jeder 4. Kampf mit Feuer-Hazard | Ash Wyrm |
| Katakomben | Undead | Heilung −20 % für beide Seiten | Grave Sovereign |
| Frostpass | Kontrolle | +10 % Slow-Empfindlichkeit | Rime Matron |
| Schwarze Zitadelle | Elite | Elites erhalten +1 Sondermodifikator | Null Regent |

### Wellenbudget & Ziel-Ökonomie
| Block | Gefühl | Spawnbudget | Komposition | Ziel-Bälle |
|---|---|---:|---|---:|
| Welle 1–4 | Aufbau | 6–10 | nur Normals | 80–140 |
| Welle 5–9 | Verdichtung | 11–17 | Normals, selten 1 Elite | 110–190 |
| Welle 10–14 | Druck | 18–25 | 1–2 Elites, Anti-Synergie | 150–260 |
| Welle 15 | Prüfung | Boss-only | 1 Boss (+ Phasen-Adds) | 220+ Bossbonus |

---

## Gear-Sets (Meta)
(→ `ItemBaseDef`/`ItemInstance`, [08](08-data-schemas.md) §3.4;
Slots & Merge in [07](07-meta-progression-and-equipment.md))

Slots: Waffe, Ring, Handschuhe, Helm, Brust, Stiefel. **5 Raritäten** (an den Report
angeglichen, [ADR-013](decisions.md)): **Common · Rare · Epic · Legendary · Mythic**
(kein „Uncommon"). Skalierung auf den Basiseffekt: **1.0 / 1.25 / 1.6 / 2.0 / 2.4**
(Common→Mythic). **Original-Setnamen** (nicht die des Vorbilds):

| Set | Fokus | Beispiel-Setboni (2er / 4er / 6er) |
|---|---|---|
| **Bulwark** | Defense/Reflect | +Armor / +Reflect / erster Treffer pro Welle halbiert |
| **Berserker** | Offense/Lifesteal | +ATK / +Lifesteal / Berserk unter 35 % HP |
| **Shadow** | Crit/Execute | +Crit / erster Crit/Runde ricochets / Execute nur auf Primärtreffer |
| **Tinkerer** | Board/Draft-Ökonomie | +1 Reroll / +1 Draft-Option & +BallYield / erstes Board pro Run nicht unter Input |
| **Hoarder** | Gold/Rewards | +Rewards / Gratis-Draft Welle 1 / +1 Boss-Chest-Wahl |

> Set-Synergien bewusst **weniger degenerativ** als im Vorbild: Execute eingeschränkt,
> Ökonomie-Sets cap-gebunden.

---

## Run-Blessings (Shop-Upgrades)
(→ `UpgradeDef`, [08](08-data-schemas.md) §3.3) — run-lokal, Draft = 3 Karten.
Kostenbasis je Rarität: **40 / 90 / 180 / 320 / 500 Bälle**.

| Name | Typ | Rarität | Effekt | Stacking |
|---|---|---|---|---|
| Startkapital | Passiv | Common | Run startet mit +6 Bällen | max 3 |
| Beutezug | Passiv | Common | +1 Ball je Kill | max 5 |
| Abpraller | Passiv | Common | Bounce +1 | max 4 |
| Vitalstrom | Passiv | Common | +25 % MaxHP | max 4 |
| Preisnachlass | Passiv | Common | nächster Draft −20 % | 1× speicherbar |
| Verstärkerfächer | Passiv | Selten | 3 zufällige Board-Lanes +0,5× | max +2,0×/Lane |
| Salve | Passiv | Selten | ExtraAttack +20 % | cap 60 % |
| Schwachstelle | Passiv | Selten | 1. Treffer/Gegner: Vulnerable +15 % (2 Runden) | refreshbar |
| Nebelschritt | Passiv | Selten | +8 % Dodge | cap 35 % |
| Stahlhaut | Passiv | Episch | +30 Armor, −10 % eingehender Schaden | bis DR-Cap |
| Lebensraub | Passiv | Episch | +8 % Lifesteal | cap 20 % |
| Scharfrichter | Passiv | Legendär | +3 % Execute (Non-Boss); Boss: +2 % MaxHP als True Dmg / Runde | max 9 % |
| Heilkrug | Aktiv | Common | heilt 25 % MaxHP | 2 Charges/Run |
| Schutzbanner | Aktiv | Selten | Shield = 35 % MaxHP (2 Runden) | 1×/Welle |
| Frostglocke | Aktiv | Episch | friert Normals 1 Runde; Boss: Tempo −50 % | 1× / 3 Wellen |
| Brandbombe | Aktiv | Episch | Burn (3 Runden, 20 % ATK) auf alle | 1× / 3 Wellen |
| Zeitanker | Aktiv | Legendär | überspringt nächste Gegner-Aktionsphase | 1×/Boss |

---

## Helden-Roster (Referenz, Post-MVP)
MVP: **ein** Held (`HeroDef`, [ADR-006](decisions.md)). Spätere Archetypen als
Referenz — **eigene Namen**:

| Held | Rolle | Signaturmotiv |
|---|---|---|
| Fletcher (MVP) | Ranger-Starter | jeder 3. Zug Split Shot; Bounce/Crit-Einstieg |
| Gunslinger | Burst/Execute | Magazin-System, Deadeye |
| Ravager | Tank/Reflect | Rage pro Treffer, kontrolliertes Reflect |
| Spellweaver | Swarm-Mage | Wisps, End-of-Turn-Hits |
| Pyrekin | DoT/Boss-Killer | Burn, gecappter Hellfire |
| Beastwarden | Beastmaster | Begleiter-Tier, Pack-Synergien |
| Grovekeeper | Summon/Control | Ents, Roots, Natur-Shields |
| Hollow | Drain-Bruiser | Life Drain, Risk/Reward |

---

## Asset-Mengen (Launch-Referenz)
| Asset | Spez | Menge |
|---|---|---:|
| Held-Sprites | 96² oder 128², Idle/Attack/Hit/Death/Cast | 1 (MVP) … 8 |
| Gegner-Sprites | 96², 4–6 Animationen | ~13 |
| Boss-Sprites | 160²–256², Phasensets | ~5 |
| Hintergründe | 3 Parallax-Layer/Welt, WebP/AVIF | 5 Welten |
| Effekt-Sprites | Burn/Freeze/Crit/Heal/Execute/Shield/Summon | 40–60 |
| Audio SFX | UI/Treffer/Status/Boss/Reward | 120–180 |
| Musik | Home + 5 Welt- + 5 Boss-Loops | 11 |
| Lokalisierung | ICU-Strings | de-DE, en-US |
