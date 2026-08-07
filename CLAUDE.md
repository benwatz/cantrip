# Cantrip — Suivi de Personnage JDR

PWA de suivi de personnage JDR (PV, emplacements de sorts, ressource de classe, fiche
Personnage/Skills, Grimoire) construite en juillet 2026. Le propriétaire travaille alternativement
sur deux PC (fixe et portable) : ce fichier sert de mémoire portable entre les deux, en
complément du dépôt Git qui est la seule source de vérité partagée entre les machines.

## Stack technique

- Fichier unique `index.html` : HTML/CSS/JS vanilla, **pas de framework, pas de build step**.
- Tailwind CSS via CDN (`<script src="https://cdn.tailwindcss.com">`) — utilisé de façon
  marginale, la majorité du style est en `style=""` inline directement dans les templates JS.
- Police Cinzel (Google Fonts) via `class="font-cinzel"`.
- Persistance : `localStorage`, clé `jdr_character_tracker_state` (conservée telle quelle après
  le renommage de l'app en Cantrip, pour ne pas perdre les sauvegardes existantes). Pas de
  backend.
- PWA : `manifest.json` + `icon.svg` + `sw.js` (service worker, stratégie réseau d'abord avec
  fallback cache — voir section Service Worker ci-dessous).
- Portraits des personnages : `characters/calix.jpg` + `characters/deneor.png`, fichiers statiques
  (pas de base64 inline) référencés depuis `state.characters.*.portrait` — voir section
  Personnages ci-dessous.

## Structure du code (`index.html`)

Application à état unique en IIFE (`(function () { 'use strict'; ... })()`), rendu par
réécriture complète de `innerHTML` à chaque changement (pas de diffing, pas de framework).

- `state` : données persistées (profils de personnage). Sauvegardé via `saveState()` à chaque
  mutation.
- `ui` : état éphémère non persisté (page active, champs en cours d'édition, recherche...).
  Voir `ui.view` pour la page courante.
- `render()` : dispatch vers `renderTracker()` / `renderStats()` / `renderGrimoire()` /
  `renderSettings()` (menu Paramètres) / `renderSettingsCharacter()` /
  `renderSettingsLoadCharacter()` / `renderSettingsCodex()` selon `ui.view`, puis ajoute
  `renderBottomNav()`. Chaque page occupe toute la hauteur disponible (`height:100%`, pas de
  scroll de la page globale — seuls les conteneurs `[data-scroll-root]` scrollent en interne).
- `bindEvents()` : re-attache tous les event listeners après chaque re-render (délégation via
  `data-action` sur les éléments cliquables).

### Pages (barre de navigation basse, 4 onglets)

1. **Tracker** (page par défaut) — portrait du personnage actif (`state.characters[activeCharacterId]
   .portrait`, cercle 38px) à gauche du nom, puis PV (bloc fusionné avec bouclier temporaire,
   boutons −/+ de part et d'autre). Le reste de la page est **entièrement inclus dans la zone
   scrollable** `[data-scroll-root]` plutôt que fixé en bas de l'écran (changement de juillet
   2026), dans cet ordre : bloc "Attaque" (armes uniquement, voir ci-dessous), bloc "Ressources"
   (un bloc de badges/compteur par ressource de classe configurée, voir Paramètres ci-dessous),
   bloc "Emplacements de sorts" (groupés par niveau en badges circulaires), la grille de 6 tuiles
   CA / Initiative / Déplacement / DD Sauv / Sorts / Dés de vie (`profile.combatStats: { ac,
   initiative, speed, spellSaveDc, spellAttackBonus, hitDice }`, juillet 2026 pour les 3 dernières
   — grille `grid-template-columns:repeat(3,1fr)` à 6 tuiles, la 2e rangée se forme par
   l'auto-wrap CSS plutôt qu'un second bloc dédié), puis en tout dernier le bouton "Repos" (ordre
   changé en juillet 2026 pour que Repos suive directement les tuiles de combat) — ce regroupement
   dans le scroll évite qu'ils occupent en permanence de la place à l'écran.
   Éditables directement ici en plus de Paramètres (juillet 2026) : tap sur une valeur d'une tuile
   (`data-action="edit-combat-stat"`) pour la remplacer par un champ texte (`ui.editingCombatStat`,
   même pattern clic-pour-éditer que le max de PV/bouclier temporaire — `combatStatInput`, focus +
   sélection auto, `blur`/Entrée valide et appelle `saveState()` directement, pas de brouillon
   différé contrairement à Paramétrer le Personnage). `ac`/`speed`/`spellSaveDc` sont non signés
   (0-99), `initiative`/`spellAttackBonus` sont signés (-99 à 99, `formatSigned()`), et `hitDice`
   est un champ texte libre (ex. "5d8", pas de calcul/plafond — même esprit que `damageDice` sur
   les attaques) : ces trois familles sont distinguées explicitement dans le handler `blur` de
   `combatStatInput` (Tracker) et dans le listener `data-action="combat-input"` (Paramétrer le
   Personnage), `hitDice` court-circuitant `toInt()`/`clamp()` pour stocker la valeur brute.
   **Blocs pliables/dépliables** (juillet 2026) : "Attaque", "Ressources" et "Emplacements de
   sorts" sont chacun une **carte unifiée** (`renderTrackerBlock()` — même gabarit visuel que le
   bloc Points de vie : `background:var(--bg-card)`, bordure, `border-radius:16px`, padding
   `14px 16px`) englobant l'en-tête et le contenu, plutôt qu'un en-tête nu au-dessus d'un contenu
   à part ; le contenu est simplement omis du rendu (pas de carte vide en dessous) quand le bloc
   est replié. L'en-tête (`renderTrackerBlockHeader()`) place un **bouton chevron** avant le
   libellé — 34×34, `border-radius:8px`, fond/bordure teintés `rgba(var(--border-tint),…)`, même
   gabarit que les boutons −/+ d'édition des compétences dans Paramétrer le Personnage — qui
   pivote de 90° selon l'état (`iconChevronRight(16)`), suivi du libellé agrandi à 14px/700 (au
   lieu de 12px/600 pour les autres labels de section). Togglé via `ui.trackerCollapsed.{attacks|
   resources|spellSlots}` (objet éphémère, un booléen indépendant par bloc, non persisté —
   redémarre entièrement déplié à chaque session), `data-action="toggle-tracker-block"` /
   `data-block` portant la clé. `iconChevronRight()` prend un paramètre `size` optionnel (défaut
   18, comme `iconArrowLeft()`) pour que le SVG rendu corresponde exactement à la taille du
   conteneur qui l'accueille — un mismatch (SVG 18px dans un conteneur 14px) désalignait
   visuellement le chevron par rapport au texte (bug corrigé juillet 2026). Le bloc PV n'a
   volontairement pas été touché par ce traitement (déjà une carte à part entière, non pliable).
   **Bloc Attaque** (`profile.attacks`, tableau 0..n d'objets `{ id, name, melee, rangeMeters,
   attackBonus, damageDice, damageBonus, damageType }`, lecture seule ici — édité dans
   Paramétrer le Personnage) — masqué entièrement si `attacks` est vide (comme les ressources de
   classe). Une ligne compacte par arme (`renderAttackRow()`) : icône épée (`iconSword()`) si
   `melee`, sinon icône arc (`iconBow()`) suivie de la portée entre parenthèses si
   `rangeMeters > 0` ; puis un réticule (`ICON_TARGET`) juste avant le bonus au toucher
   (`attackBonus`, signé, coloré `--accent-blue-text`) ; à droite, les dégâts (`damageDice` +
   `damageBonus` s'il est non nul) et le type (`damageType`), séparés par un point médian,
   tronqués en ellipsis CSS si trop longs plutôt que d'être abrégés en JS. Uniquement des armes :
   pas de notion de sort dans ce bloc (choix explicite — voir Décisions de conception).
   **Rangées de badges** (emplacements de sorts par niveau, ressources de classe de type
   `badges`) : chaque badge est une pastille ronde de 27px (`2px` de bordure ; brièvement doublée à
   40px/3px en août 2026 pour rester facile à toucher, puis rabaissée de 33% après un premier
   retour utilisateur — les emplacements de sorts et les ressources de classe partagent désormais
   la même taille, quel que soit le nombre d'emplacements, ce qui a supprimé l'ancien cas
   particulier `dotSize = crTotal < 3 ? 40 : 20`), séparées par un `gap` de 6px (également réduit
   depuis 8px pour que 4 badges tiennent toujours sur une ligne sans scroll, cas courant côté
   emplacements de sorts comme côté ressources).
   À partir de 3 emplacements, chaque rangée est encadrée par un bouton `−` à gauche et un bouton
   `+` à droite (juillet 2026 ; 44×44, `border-radius:10px`, même
   esprit que le gabarit des boutons −/+ des compétences dans Paramétrer le Personnage mais
   agrandi), en `flex:none` de part et d'autre d'un conteneur `.hscroll` centré
   (`justify-content:safe center`, `flex:1`) qui contient les badges. Les deux boutons sont donc
   toujours à la même position horizontale (bord de la carte) quel que soit le nombre de badges ou
   la largeur du libellé de niveau/ressource au-dessus. Pour les ressources de classe de type
   `badges`, ces boutons ne sont affichés qu'à partir de 3 emplacements (`cr.used.length >= 3` — en
   dessous, le tap direct sur l'unique/les deux badges suffit et les boutons prendraient plus de
   place que la ressource elle-même) ; en dessous de 3, seule la rangée de badges centrée
   (`justify-content:safe center`, sans les boutons) est affichée. `safe center` (plutôt qu'un
   simple `center`) évite un piège CSS classique : dès que les badges dépassent la largeur
   disponible (typiquement 4 emplacements ou plus sur un écran étroit), un `justify-content:center`
   nu centre quand même le contenu qui déborde et rend le premier/dernier badge à moitié coupé et
   hors d'atteinte du scroll ; `safe center` retombe sur un alignement au début dès qu'il y a
   débordement, ce qui garde tous les badges pleinement visibles et atteignables (bug corrigé août
   2026, provoqué par le doublement de taille d'alors). Consommation/restauration de droite à
   gauche (juillet 2026, sens inversé une fois après un premier retour utilisateur) : `−`
   (`data-action="spell-slot-dec"` / `"class-badge-dec"`) consomme le badge disponible le plus à
   droite (`used.lastIndexOf(false)`) ; `+` (`data-action="spell-slot-inc"` / `"class-badge-inc"`)
   restaure le badge utilisé le plus à gauche (`used.indexOf(true)`, c'est-à-dire le dernier
   consommé puisque la consommation part de la droite) ; sans effet si tous les badges sont déjà
   dans l'état ciblé. Le tap
   direct sur un badge (`data-action="toggle-spell"`/`"toggle-class"`) continue de fonctionner en
   parallèle pour (dé)cocher un emplacement précis, y compris pour les ressources à 1 ou 2
   emplacements qui n'ont pas d'autre moyen d'interaction. Les ressources de type `counter` ne sont
   pas concernées par ces boutons dédiés (leurs boutons −/+ existants, `counter-dec`/`counter-inc`,
   34×34, jouent déjà ce rôle, quel que soit `max`), mais le groupe entier (`−`/valeur/`+`) est lui
   aussi centré horizontalement dans la carte (`justify-content:center`, juillet 2026) plutôt
   qu'aligné à gauche, pour rester visuellement cohérent avec les rangées de badges.
   Le libellé de niveau abrège "Niveau N" en **"Niv.N"** (août 2026, plus court) dans une colonne de
   28px de large à gauche de la rangée, avec le compteur "x/x" dans une colonne de 34px à droite
   (assez pour "12/12", le max clampé des emplacements de sorts). Les mêmes deux largeurs (28px puis
   34px) sont reproduites en marges vides sur la rangée de badges des ressources de classe (à partir
   de 3 emplacements) exprès pour que les pastilles des deux blocs restent parfaitement alignées
   verticalement d'une carte à l'autre malgré leurs contenus différents (libellé texte à gauche pour
   les sorts, rien pour les ressources qui ont leur propre libellé centré au-dessus) — capture
   utilisateur à l'appui montrant le désalignement avant ce correctif.
   Deux marqueurs toggle (`profile.concentration`, `profile.inspiration`, booléens indépendants)
   alignés à droite sur la ligne du nom du personnage, dans l'ordre inspiration puis
   concentration : point d'inspiration (icône dé à 20 faces `ICON_D20`, constante SVG plutôt que
   fonction — remplace en août 2026 d'abord l'étoile d'origine, puis un premier essai dessiné à la
   main jugé peu convaincant par l'utilisateur, au profit de l'icône officielle "Dice Twenty Faces
   Twenty" de Delapouite sur [game-icons.net](https://game-icons.net/) (CC BY 3.0, voir
   `README.md`) ; un seul `<path fill="currentColor">` dont les facettes et les chiffres du dé sont
   des trous (contours internes de sens opposé dans le path), donc pas de variante filled/outline
   séparée comme `iconStar` — la couleur du bouton parent, déjà togglée gold/dim selon
   `p.inspiration`, suffit à distinguer les deux états, exactement comme `ICON_CONCENTRATION`) et
   concentration (icône smiley aux sourcils froncés `ICON_CONCENTRATION`, glow
   violet animé via la classe `concentration-active` / `@keyframes concentration-pulse`).
   Concentration active déclenche deux effets supplémentaires sur le bloc PV : un liseret violet
   avec traînée tourne en continu autour du bloc (`hp-concentration-ring`, angle animé via une
   custom property `--hp-ring-angle` déclarée en `@property` — ne jamais faire un
   `transform:rotate()` direct sur la boîte elle-même : le bloc PV est un rectangle large et non
   carré, une rotation physique fait sortir le liseret du cadre) ; et si le joueur retire des PV
   (`data-action="damage"`) pendant que la concentration est active, un toast violet ("Vous êtes
   concentré(e) et venez de subir des dégâts, pensez au jet de sauvegarde !") glisse depuis le haut de
   l'écran (recouvrement léger du bloc PV accepté), reste 10s puis repart, fermable via une croix,
   avec un cooldown de 30s entre deux déclenchements (`maybeShowConcentrationToast()` /
   `ui.concentrationToast`, juillet 2026).
   Pas de swipe entre Suivi et Personnage : un swipe horizontal (`pointerdown`/`pointermove`/
   `pointerup` sur `#app`) a existé un temps mais a été retiré (2026-07-13) après plusieurs
   itérations infructueuses — le geste était systématiquement happé par le scroll natif dès qu'il
   démarrait dans une zone verticalement scrollable (`[data-scroll-root]`), même avec
   `touch-action:pan-y` et un `preventDefault()` sur `pointermove`. Navigation entre ces deux
   pages uniquement via la barre de navigation basse. Les rangées horizontales `.hscroll`
   (badges d'emplacements de sorts, de ressources de classe) sont en `touch-action:pan-x pan-y`
   (pas `pan-x` seul) pour ne pas bloquer le scroll vertical dès qu'un doigt démarre dessus ; sur
   pointeur tactile (`@media (pointer:coarse)`), elles passent même en habillage
   (`flex-wrap:wrap`) plutôt qu'en scroll horizontal, pour supprimer entièrement ce second axe de
   scroll imbriqué (bug corrigé juillet 2026 : le scroll vertical du Tracker ne captait pas
   toujours le doigt de l'utilisateur — l'arbitrage de geste entre deux scrolls imbriqués n'est
   pas fiable à 100% même avec `touch-action` bien réglé).
2. **Personnage** (onglet nav, anciennement "Stats" ; le code interne — `renderStats()`,
   `ui.statsSearch`, `view: 'stats'` — garde le nom `stats`) — caractéristiques (6) et
   compétences (18, D&D 5e, noms français) en lecture seule, avec champ de recherche filtrant
   la liste en direct et la triant par pertinence (`skillMatchRank()` : correspondance exacte,
   puis début de nom, puis contient — ex. taper "H" affiche Histoire avant Athlétisme, corrigé
   juillet 2026). Les valeurs sont saisies manuellement dans Paramètres (l'app ne calcule
   aucun modificateur). Accessible uniquement via la barre de navigation basse, comme le Tracker.
   Le focus du champ de recherche masque volontairement le bloc "Caractéristiques"
   (`#statsAbilitiesBlock`, `style.display = 'none'`) pour laisser plus de place à la liste de
   compétences (et au clavier virtuel sur mobile) ; une croix (`#statsResetBtn`, en haut à droite,
   `iconClose()`) apparaît en même temps pour remettre la page à zéro
   (`data-action="reset-stats-view"` : vide `ui.statsSearch` et appelle `.blur()` sur le champ).
   Les deux sont pilotés directement par des listeners `focus`/`blur` sur `#statsSearchInput` qui
   togglent leur style **sans appeler `render()`** — un `render()` y recréerait l'input et le
   refocaliserait, ce qui redéclencherait `focus` en boucle (même pattern que
   `#grimoireSearchInput`, voir section Grimoire ci-dessous).
3. **Grimoire** (`renderGrimoire()`) — affiche les capacités du personnage (sorts par niveau +
   capacités de classe et dons), regroupées par section avec badge de type d'action coloré
   (Action/Bonus/Réaction/Rituel/Passif...), niveau, portée/durée et note d'usage en italique.
   Contenu **statique, codé en dur** dans `index.html` (pas dans `state`), une constante par
   personnage — `SPELLBOOK` pour Calix Noctavel, `DENEOR_SPELLBOOK` pour Deneor Sentariel —
   sélectionnée via `activeSpellbook()` selon `state.activeCharacterId`. Pas d'UI d'édition du
   contenu lui-même ; voir `specifications_jdr_mobile_v2.md` section 7.3 pour la spec d'origine
   (obsolète sur plusieurs points depuis, notamment la préparation de sorts, voir Historique en
   fin de section).
   Calix et Deneor affichent tous les deux l'intégralité de leur grimoire en lecture seule, de la
   même façon (aucune spécificité par personnage niveau navigation) : la seule façon de mettre un
   sort en avant est le système de **favoris** (étoile par sort, propre à chaque personnage),
   décrit plus bas.
   Pas de titre "Grimoire" en tête de page (retiré en août 2026 pour remonter le champ de
   recherche tout en haut, gagner une ligne verticale) — contrairement à la plupart des autres
   pages qui gardent leur titre `font-cinzel` en première position.
   **Barre de sélection** (`#grimoireChromeBlock`) sous le champ de recherche, à 5 zones : un
   bouton **"Tous"** (à gauche, collé au bord de la carte), une **flèche gauche** puis un
   **bouton central** affichant le niveau courant ("-" en mode Tous, "Niv.N" pour un niveau,
   "Classe", ou "Favoris" — police 13px) et une **flèche droite** (au centre,
   `data-action="grimoire-step" data-delta="-1"/"1"`), puis un bouton **étoile "Favoris"** (à
   droite, collé au bord de la carte). Boutons à 58×58 (agrandis de 44×44 en août 2026), bouton
   central en `flex:1` pour occuper tout l'espace restant entre les deux flèches. Les flèches
   réutilisent `iconArrowLeft()` — la droite via `transform:scaleX(-1)` sur son conteneur, même
   technique que les flèches du carrousel "Charger un personnage".
   **Tous et Favoris bornent la chaîne de navigation** des flèches -/+ (août 2026) : la séquence
   complète est `['tous'].concat(grimoireTabs()).concat(['favoris'])` (`grimoireTabs()` renvoie
   les niveaux réels ascendants + `'classe'`). Depuis "Tous", la flèche droite mène au premier
   niveau (0 ou 1 selon si le personnage a des sorts mineurs), la flèche gauche est désactivée.
   Depuis "Favoris", la flèche gauche mène au dernier onglet ("Classe"), la flèche droite est
   désactivée. Un tap sur le bouton central (`data-action="toggle-grimoire-level-menu"`, état
   `ui.grimoireLevelMenuOpen`) ouvre une grille de sélection directe de tous les niveaux +
   "Classe" (cellules 46×46, avec un `margin-top:8px` pour ne pas coller à la barre au-dessus),
   qui se referme au choix d'une entrée. `ui.grimoireTab` accepte en plus des niveaux réels deux
   valeurs propres à cette page, `'tous'` et `'favoris'` (jamais renvoyées par `grimoireTabs()`,
   qui reste la seule source pour le cycle -/+ et le menu déroulant).
   **Recherche** (`#grimoireSearchInput`, `ui.grimoireSearch`, placeholder "Rechercher") : même
   pattern d'interaction que `#statsSearchInput` sur la page Personnage — filtre en direct sur le
   nom du sort (pas la description), tri par pertinence (exact, préfixe, contient), présélection
   du contenu exclue au focus (c'est un filtre, pas une valeur à remplacer). Le focus masque
   `#grimoireChromeBlock` et affiche une croix de réinitialisation (`#grimoireResetBtn`,
   `data-action="reset-grimoire-search"`), pilotés directement en JS sans `render()` (même raison
   qu'ailleurs : un `render()` re-focaliserait l'input, ce qui redéclencherait `focus` en boucle).
   Un filet de sécurité identique à celui de Personnage existe aussi dans le listener
   `visualViewport.resize` pour les claviers Android qui se ferment sans déclencher de `blur`.
   Tant qu'une recherche est active, elle ignore le mode courant (niveau/Tous/Favoris) et affiche
   les résultats de **tout** le grimoire, groupés par section comme d'habitude (la puce de niveau
   déjà affichée sur chaque ligne de sort suffit à resituer chaque résultat). Revenir en arrière
   (croix ou `blur` avec champ vide) réaffiche exactement le mode/niveau qui était sélectionné
   avant la recherche.
   **Favoris** : étoile cliquable au début de chaque ligne de sort
   (`data-action="toggle-favorite-spell"`), toggle instantané (pas de brouillon/validation)
   persisté dans `profile().favoriteSpells` (tableau de noms, migré par `sanitizeProfile()`,
   propre à chaque personnage). Le clic sur l'étoile appelle `e.stopPropagation()` pour ne pas
   aussi déclencher l'ouverture de la popup de détail (ligne et étoile portent chacune leur propre
   `data-action`, donc chacune son propre listener de clic). Le mode "Favoris" les affiche tous
   niveaux confondus ; aucun sort favori affiche un message dédié plutôt que "Aucun sort à ce
   niveau". Le profil par défaut de Deneor a des favoris pré-remplis (migrés depuis l'ancienne
   liste de sorts préparés lors du retrait de ce système, voir Historique).
   **Popup de détail d'un sort** : tap sur une ligne de sort (hors étoile,
   `data-action="open-spell-detail"`) pour ouvrir une popup plein contenu (nom complet, niveau,
   type, portée, description et note, sans troncature ni ellipsis — utile car le nom du sort dans
   la ligne est tronqué en ellipsis CSS s'il est trop long). `findSpellDetail()` recherche le
   sort par nom dans tout `characterGrimoire(state.activeCharacterId)` (toutes sections
   confondues) plutôt que de sérialiser ses infos dans des attributs `data-*`. Même principe
   d'animation enter/leave que le portrait agrandi du Codex (`ui.spellDetail = { spell, levelTag,
   leaving }` / `ui.spellDetailEnterPending`, classes CSS
   `spell-detail-backdrop/card-enter/leave`, `startLeavingSpellDetail()` avec un `setTimeout` dont
   la durée matche l'animation de sortie avant de vider l'état). Fermeture au tap sur le fond ou
   sur la croix (les deux déclenchent `close-spell-detail` puisque tout le contenu de la popup
   bubble jusqu'au fond, aucun `stopPropagation` — même comportement que la prévisualisation du
   Codex).

   **Historique (code retiré, pas seulement désactivé)** — deux évolutions majeures ont disparu
   du Grimoire en août 2026 :
   - Une **navigation par onglets de niveau en filtres combinables** (plusieurs niveaux affichés
     empilés à la fois, avec des chips de filtre par type Action/Bonus/Réaction) a précédé la
     barre à 5 zones actuelle, jugée plus lisible. Gardée un temps intacte-mais-jamais-appelée
     (`renderGrimoireV1()`) comme filet de rollback, elle a fini par diverger de la version
     courante (pas de recherche, pas de favoris) au point de ne plus être un filet de sécurité
     valable, et a été supprimée pour de bon.
   - Un **système de préparation de sorts quotidienne** existait pour Deneor (Paladin) :
     `profile().preparedSpells`, une page dédiée de sélection, un bouton flottant sur le Grimoire
     et une option dans la modale Repos ("Se reposer et préparer des sorts"). Retiré au profit du
     système de favoris ci-dessus — Deneor voit désormais tout son grimoire comme Calix, sans
     restriction de visibilité par sort.

4. **Paramètres** — `renderSettings()` affiche un menu de trois boutons (`data-action="nav"`,
   réutilise le pattern générique de navigation) qui renvoient chacun vers une sous-page dédiée :
   "Paramétrer les statistiques", "Gestion des personnages", "Codex" (pas de "Paramétrer le
   Grimoire" — cette sous-page a été retirée en août 2026 en même temps que le système de
   préparation de sorts de Deneor, le Grimoire n'ayant plus rien à y paramétrer). Chaque sous-page
   a son propre `view` (`settings-character` / `settings-load-character` / `settings-codex`) et
   affiche en haut un bouton retour (`renderSettingsHeader()`) qui repositionne `ui.view =
   'settings'` (retour au menu, pas au Tracker). Dans la barre de navigation basse, l'onglet
   Paramètres reste en surbrillance tant que `ui.view` commence par `"settings"` (menu ou
   n'importe quelle sous-page). Le deuxième bouton du menu, "Gestion des personnages" (libellé ;
   la vue interne garde le nom `settings-load-character`), renvoie directement à
   `renderSettingsLoadCharacter()` (voir section Personnages ci-dessous) — il n'y a plus de niveau
   intermédiaire "Paramétrer l'application" depuis juillet 2026 (l'écran ne servait plus qu'à ça
   après le retrait de l'export/import JSON, voir plus bas).
   - **Paramétrer les statistiques** (`renderSettingsCharacter()`, libellé renommé depuis
     "Paramétrer le Personnage" en août 2026 — la vue interne garde le nom `settings-character`,
     tout comme les identifiants de code cités ci-dessous) — nom du personnage,
     CA/Initiative/Déplacement/DD Sauv/Bonus aux sorts/Dés de vie (`data-action="combat-input"`,
     Initiative et Bonus aux sorts signés via `formatSigned()`, CA/Déplacement/DD Sauv non signés,
     Dés de vie en texte libre, ex. "5d8"), liste d'attaques (voir ci-dessous), config des
     emplacements de sorts et des ressources de classe, saisie des caractéristiques/compétences.
     Contenu en flux continu, sans titres de sous-section, séparé par de simples `<hr>` légers
     (`SETTINGS_SEPARATOR`) entre les blocs.
     **Verrou d'édition** : la page démarre verrouillée (lecture seule, tous les champs `disabled`
     ou `pointer-events:none`, valeurs affichées = `profile()`) avec un bouton "Modifier" en bas
     (hors zone de scroll, `flex:none`). Le tap dessus
     (`data-action="start-edit-character"`) clone le profil actif dans
     `ui.settingsCharacterDraft` (`cloneDeep()`) et passe `ui.settingsCharacterEditing = true` :
     tous les champs se déverrouillent et éditent ce brouillon via
     `settingsCharacterProfile()` (= le brouillon si `ui.settingsCharacterEditing`, sinon
     `profile()`) — aucun `saveState()` n'est appelé pendant l'édition. Le bouton "Modifier" est
     remplacé par deux boutons fixes "Annuler"/"Valider" (même emplacement hors-scroll) :
     "Annuler" (`cancel-edit-character`) abandonne le brouillon sans y toucher ; "Valider"
     (`confirm-edit-character`) le passe dans `sanitizeProfile()` puis remplace
     `state.profiles[state.activeProfileIndex]` par ce brouillon et appelle `saveState()`. Sortir
     de la page en édition sans passer par l'un des deux (ex. flèche retour) déclenche le même
     abandon que "Annuler", via un filet de sécurité dans le cas générique `'nav'` de `onAction()`.
     Les emplacements de sorts s'activent dans l'ordre croissant : impossible d'activer un niveau
     si un niveau inférieur est désactivé (message d'erreur `ui.settingsLevelError`, pas
     d'auto-activation en cascade). Désactiver un niveau qui a des niveaux supérieurs actifs ouvre
     une dialog de confirmation (`ui.disableLevelDialog`) car ces niveaux supérieurs seront
     désactivés en cascade ; désactiver le niveau actif le plus haut ne demande pas de
     confirmation.
     **Ressource(s) de classe** : `profile.classResources` est un tableau (0..n éléments, pas de
     limite) d'objets `{ id, label, max, type, used[], current? }` — chacun avec son propre
     libellé et son propre nombre d'emplacements, éditables en ligne
     (`data-action="class-resource-label"` / `"class-resource-max"`). Deux types (`cr.type`,
     `makeClassResource(label, max, type)`) :
     - `'badges'` (défaut, historique) — une rangée de badges à cocher (`used[]`), comme les
       emplacements de sorts.
     - `'counter'` — un compteur `current`/`max` avec boutons −/+ (`data-action="counter-dec"`/
       `"counter-inc"`), même principe que les PV mais en plus petit, sans rangée de badges
       (`used` reste `[]`). `current` est clampé à `[0, max]` à chaque changement (inc/dec, édition
       du max en Paramètres, migration `sanitizeProfile()`). Plafond de `max` différent selon le
       type : 20 pour `badges` (déjà beaucoup à afficher en rangée de cases), 99 pour `counter`
       (juste un nombre affiché, pas de limite d'affichage).
     Deux boutons "+ Ajouter une ressource" (`data-action="add-class-resource"`, type `badges`) et
     "+ Ajouter un compteur" (`data-action="add-class-counter"`, type `counter`), tous deux créés
     via `makeClassResource()`/`generateId()` ; un bouton de suppression par ligne
     (`data-action="remove-class-resource"`). Il n'y a plus de notion d'« activer » : une ressource
     existe dans le tableau ou n'existe pas. La modale Repos réinitialise chaque ressource selon son
     type (`used[]` à `false` pour `badges`, `current = max` pour `counter`) d'un coup (case
     "Restaurer les ressources de classe").
     **Attaque(s)** : `profile.attacks` est un tableau (0..n éléments) d'objets `{ id, name,
     melee, rangeMeters, attackBonus, damageDice, damageBonus, damageType }`, créés via
     `makeAttack()`/`generateId()`, réordonnables (`data-action="move-attack-up"`/`"-down"`,
     même pattern que les ressources de classe) et supprimables individuellement
     (`data-action="remove-attack"`). Chaque ligne est une petite carte multi-champs (pas une
     simple ligne à un champ comme les ressources de classe, faute de place) : nom, toggle
     Mêlée/Distance (`data-action="toggle-attack-melee"`, pilote l'icône épée/arc du Tracker),
     portée en mètres (`rangeMeters`, champ désactivé tant que Mêlée est sélectionné — même
     pattern que les champs Max désactivés hors contexte), bonus au toucher signé
     (`attackBonus`), dégâts en deux champs (`damageDice` texte libre type "1d8" + `damageBonus`
     signé), et type de dégâts (`damageType`, texte libre). Un seul bouton "+ Ajouter une arme"
     (`data-action="add-attack"`). Volontairement **armes uniquement** : pas de notion de sort
     dans ce système (écarté explicitement lors de la conception, voir Décisions de conception) —
     ne pas réintroduire un axe "sort" sans en rediscuter avec l'utilisateur.
     `sanitizeProfile()` migre automatiquement l'ancien format mono-ressource
     (`profile.classResource: { enabled, label, max, used }`) vers `classResources` — appliqué à
     chaque chargement, aussi bien au profil actif (`state.profiles[]`) qu'aux instantanés
     `savedProfile` de chaque personnage (voir section Personnages ci-dessous).
   - **Gestion des personnages** (`renderSettingsLoadCharacter()`, deuxième bouton du menu
     Paramètres) — voir section Personnages ci-dessous. Pas de toggle de thème ici : le thème suit
     le personnage chargé, voir section Thèmes (Calix / Deneor) plus bas.
   - **Codex** (`renderSettingsCodex()`, troisième bouton du menu Paramètres) — répertoire de PNJ
     (`CODEX_PNJ`, objets `{ prenom, nom, occupation, faction, lieu, portrait, ... }`) avec un
     champ de recherche live (`ui.codexSearch`) triant par pertinence sur prénom/nom/occupation/
     lieu (`codexMatchRank()`, même principe exact > préfixe > contient que Personnage et
     Grimoire). Chaque ligne (portrait rond, nom, occupation, faction/lieu) ouvre au tap une popup
     portrait agrandi (`ui.codexPreview`, `data-action="open-codex-preview"`), même principe
     d'animation enter/leave que la popup de détail de sort du Grimoire.

## Personnages (Calix / Deneor)

Système à **deux emplacements de personnage fixes** (pas de CRUD générique, pas d'ajout/suppression
de personnage) : `state.characters` est un objet `{ calix: {...}, deneor: {...} }`, chaque entrée
`{ id, name, subtitle, level, portrait, theme, savedProfile }` où `savedProfile` est un instantané
complet d'un profil (même forme que `defaultProfile()`) et `theme` (`'calix'` | `'deneor'`) est le
thème visuel associé à ce personnage (voir section Thèmes (Calix / Deneor) plus bas).
`state.activeCharacterId` (`'calix'` | `'deneor'`) indique lequel des deux est actuellement
**chargé**. `CHARACTER_ORDER = ['calix', 'deneor']` fixe l'ordre d'affichage.

Le profil réellement affiché/édité dans toute l'app reste `state.profiles[state.activeProfileIndex]`
(inchangé, lu via `profile()`) : c'est une **copie de travail**, distincte des instantanés
`savedProfile`. Les deux ne sont jamais le même objet en mémoire (clonage systématique via
`cloneDeep()`, un round-trip JSON) pour permettre un aller-retour explicite :

- **Gestion des personnages** (`renderSettingsLoadCharacter()`, `view: 'settings-load-character'`,
  deuxième bouton du menu Paramètres — le header de la page garde le titre "Charger un
  personnage") — carrousel plein écran (un personnage affiché à la fois, portrait + nom +
  sous-titre + niveau si défini, les deux personnages ont un niveau depuis juillet 2026) avec
  navigation par flèches
  (`data-action="character-carousel-step"`) ou glissé façon "carte à jouer" sur
  `#characterCarouselSwipe`, implémenté via Pointer Events (souris **et** tactile, pas seulement
  tactile) dans `bindEvents()` : la carte suit le curseur/doigt 1:1 pendant le drag (rotation +
  fondu proportionnels à la distance), avec de la résistance si on dépasse le premier/dernier
  personnage. Au relâché, au-delà d'un seuil de 90px la carte part en vol vers le bord (transition
  de 360ms) puis `characterCarouselStep()` s'exécute et la carte suivante entre avec l'animation
  CSS `character-anim-next`/`-prev` (650ms, plus lente que celle du Grimoire à 420ms, pour un effet
  de feuilletage posé) ; en dessous du seuil, la carte revient se recaler avec la même transition
  de 360ms. Un badge "Personnage chargé" s'affiche sur la carte si `state.activeCharacterId`
  correspond au personnage affiché.
  Sous la carte, dans cet ordre : le bouton **Charger ce personnage** (`data-action=
  "fb-load-character"`, toujours actif) puis, uniquement si le personnage affiché est déjà
  actif (`isActive`), **Sauvegarder ce personnage** (`data-action="fb-save-character"`) — puis
  la rangée flèches/pastilles du carrousel. Les flèches gauche/droite
  (`data-action="character-carousel-step"`) sont volontairement à la même taille que les boutons
  −/+ du bloc PV du Tracker (80×76px, icône 36px, via `iconArrowLeft(size)`) plutôt que la taille
  généraliste 36×36 des autres boutons de navigation (`navBackButtonHtml()`), pour rester faciles
  à toucher (juillet 2026).
  Les deux boutons passent par **Firebase Realtime Database** (nœud `cantrip`, mêmes fonctions
  `fbLoadBdd()`/`fbSaveBdd()` que dans `cantrip-admin.html`, voir section Outil admin plus bas —
  migré depuis Google Drive en août 2026, voir Historique en fin de section) plutôt que par une
  simple copie locale de `character.savedProfile` — un tap ouvre d'abord une modale de
  confirmation (`renderFbConfirmModal()`, état `ui.fbConfirm = { action: 'load'|'save',
  charId? }`, même gabarit visuel que `renderDisableLevelModal()`) rappelant que l'opération
  écrase soit la sauvegarde locale sur cet appareil, soit celle sur Firebase ; valider déclenche
  `performFbLoad()`/`performFbSave()`, qui posent `ui.fbBusy` (désactive les boutons,
  affiche "Synchronisation avec Firebase…") puis, en cas de succès, mettent à jour
  `character.savedProfile`, appliquent le thème (`applyTheme()`) et le profil actif, et affichent
  un toast de confirmation (`showFbToast()`/`ui.fbToast`) ; en cas d'échec, `ui.fbError`
  s'affiche sous les boutons. `character.savedProfile` de chaque personnage reste donc modifiable
  depuis l'app elle-même via cette synchro Firebase (contrairement aux valeurs par défaut codées en
  dur, voir section Outil admin plus bas).
  Le Grimoire affiché dépend de `state.activeCharacterId` (`activeSpellbook()`, voir section
  Grimoire plus haut) : charger Deneor bascule sur `DENEOR_SPELLBOOK`, indépendant du contenu de
  Calix.

`loadState()` migre automatiquement toute sauvegarde antérieure à ce système (`parsed.characters`
absent) : le profil unique existant devient l'instantané de Calix (aucune perte de données) et
Deneor démarre sur un `defaultProfile()` vierge ; `activeCharacterId` est alors mis à `'calix'`.

## Décisions de conception (à respecter, divergent parfois du cahier des charges)

Le développement s'est appuyé sur deux sources parfois contradictoires : le cahier des charges
(`specifications_jdr_mobile_v2.md`) et une maquette visuelle Claude Design ("2a — Parchemin
révisé"). En cas de divergence, les arbitrages suivants ont été retenus :

- **Dégâts/soins** : tap direct sur `−`/`+` (1 point par tap), **pas** de champ de saisie de
  quantité — choix explicite, contrairement au doc de specs qui décrivait un champ + bouton.
- **Modale "Repos" unique** (pas de Repos Court/Long séparés) : la case "Restaurer les points de
  vie", si cochée, restaure réellement les PV au max (comportement actif, pas juste un
  aide-mémoire).
  Ce point diverge du doc de specs et n'a pas été explicitement re-confirmé par l'utilisateur —
  à surveiller si retour futur.
- Les cases à cocher de la modale Repos sont toutes décochées par défaut à chaque ouverture.
- Les champs "Max" (sorts, ressource de classe) sont désactivés visuellement tant que le niveau
  correspondant n'est pas activé.
- **Bloc Attaque (`profile.attacks`) : armes uniquement, pas de sorts.** Écarté explicitement en
  cours de conception (2026-07-19) après plusieurs itérations avec l'utilisateur — un premier jet
  incluait un bonus de sort distinct et une icône dédiée aux attaques de sort, simplifié à la
  demande pour ne garder que les armes (mêlée/distance). Le bonus au toucher est propre à chaque
  arme (pas un bonus unique partagé), car deux armes peuvent avoir des bonus différents (arme
  magique, don...).
- Tout `<input type="text">` voit son contenu présélectionné au focus (listener délégué global
  `focusin` sur `#app`, tape directement pour remplacer la valeur), **sauf** le champ de
  recherche des compétences (`#statsSearchInput`) qui reste un filtre en direct.

## Thèmes (Calix / Deneor)

Il n'y a plus de toggle clair/sombre manuel : le thème visuel est une propriété de chaque
personnage (`state.characters[id].theme`, `'calix'` | `'deneor'`) et s'applique automatiquement
au chargement de ce personnage (`applyTheme()`, appelé au démarrage depuis `loadState()`/
`defaultState()` et lors de l'action `data-action="load-character"`). `activeTheme()` lit
`state.characters[state.activeCharacterId].theme` (repli sur `'calix'` si absent) ;
`applyTheme()` pose cette valeur sur l'attribut `data-theme` de `<html>` et met à jour le
`<meta name="theme-color">` via la table `THEME_COLOR_META`.
- **Thème Calix** (`:root`, valeurs par défaut sans attribut) — ocre/parchemin clair, hérité de
  l'ancien thème clair unique (pas blanc, pour garder l'aspect médiéval).
- **Thème Deneor** (`:root[data-theme="deneor"]`) — palette sombre vert forêt construite autour
  de Pantone 3435 C (`#154734`, utilisé comme `--border-strong`), cohérente avec le thème de
  Paladin sous Serment des Anciens de Deneor Sentariel.
Les deux jeux de variables CSS custom properties (fonds, bordures, textes, couleurs d'accent des
badges) sont définis en tête de fichier dans le bloc `<style>`. **Toute nouvelle couleur ajoutée
dans un template JS doit utiliser `var(--...)` plutôt qu'un hex en dur** pour rester compatible
avec les deux thèmes.
Le `<meta name="theme-color">` initial dans `<head>` et `background_color`/`theme_color` dans
`manifest.json` reflètent la teinte Calix par défaut (`#ecdcb0`), puisque Calix reste le
personnage chargé par défaut sur un état vierge.

## Clavier virtuel mobile (`visualViewport`)

`#app` est en `height:100dvh` (fallback `100vh`), et le meta viewport porte
`interactive-widget=resizes-content` — mais sur certains navigateurs/OS (Safari iOS en
particulier), l'ouverture du clavier virtuel ne redimensionne pas la layout viewport, ce qui
masquerait les éléments `flex:none` en bas de page (boutons Annuler/Valider de Paramétrer le
Personnage...) sous le clavier. Un listener global sur `window.visualViewport.resize`
(attaché une seule fois en fin de script) recale `app.style.height` sur
`visualViewport.height`, qui reflète toujours la zone réellement visible. Le même listener sert de
filet de sécurité pour `#statsAbilitiesBlock`/`#statsResetBtn` (page Personnage) : si le clavier se
referme sans déclencher de `blur` sur `#statsSearchInput` (arrive avec certains claviers Android
via leur propre bouton de fermeture, qui ne retire pas toujours le focus DOM), la hauteur de
viewport revenue proche de son maximum observé (`viewportMaxHeight`, mis à jour dynamiquement)
force le retour du bloc Caractéristiques et le masquage de la croix de réinitialisation.

## Service Worker (`sw.js`)

Stratégie réseau d'abord avec fallback cache (pas de stale-while-revalidate). `CACHE_NAME` est
versionné (`cantrip-vNN`, voir `sw.js` pour la valeur actuelle) — **incrémenter cette constante
à chaque changement significatif des assets statiques** (`index.html`, `manifest.json`,
`icon.svg`, `characters/*.jpg|png`) pour forcer l'invalidation du cache côté client.

## Déploiement

- Dépôt : https://github.com/benwatz/cantrip (public, compte GitHub "benwatz" — renommé depuis
  "Nerdash" en juillet 2026, même compte/ID sous-jacent)
- **Prod** (GitHub Pages, HTTPS, installable en PWA) : https://benwatz.github.io/cantrip/ —
  déploiement automatique à chaque push sur `master`, qui sert directement `index.html` à la
  racine (pas de pipeline CI, pas de dossier `dist`). `.nojekyll` présent pour désactiver le
  traitement Jekyll.
- **Preprod** (Netlify) : https://ben-cantrip.netlify.app/ — déploiement automatique à chaque
  push sur `preprod`, configuré depuis le dashboard Netlify (pas de `netlify.toml` dans le
  dépôt).

## Synchronisation cloud (Firebase)

Stockage cloud des personnages (profil + Grimoire), utilisé par les pages "Charger un personnage"
(`index.html`) et le panneau Personnage de l'outil admin (voir sections précédentes) via un mode
"Charger/Sauvegarder" explicite (pas de synchro live automatique). Remplace depuis août 2026 une
première implémentation basée sur l'API Google Drive (voir Historique ci-dessous).

- **Backend** : Firebase **Realtime Database**, projet `cantrip-e90fd`, région `europe-west1`. Un
  seul nœud racine `cantrip` contenant `{ calix: { profile, grimoire }, deneor: { profile,
  grimoire }, _meta: {...} }` — équivalent direct de l'ancien `bdd.json` sur Drive, même schéma
  imbriqué.
- **Auth** : Firebase Authentication, provider Google (`signInWithPopup`), session persistée par
  le SDK (IndexedDB) — pas de ré-authentification à chaque lancement contrairement à l'ancien
  jeton OAuth Drive qui expirait au bout d'une heure.
- **Règles de sécurité RTDB** : `{ ".read": "auth != null", ".write": "auth != null" }` — tout
  utilisateur connecté avec un compte Google peut lire/écrire (choix délibéré pour permettre à
  plusieurs joueurs, ex. Deneor, de synchroniser depuis leur propre compte sans configuration
  d'UID individuelle).
- **Config client** (`FIREBASE_CONFIG`, dupliquée dans `index.html` et `cantrip-admin.html`,
  même convention que le reste des constantes de sync) : n'est pas un secret, comme l'ancien
  Client ID OAuth Drive — les règles RTDB ci-dessus sont la vraie barrière d'accès, pas la config.
- **SDK** : `firebase-app-compat.js` / `firebase-auth-compat.js` / `firebase-database-compat.js`
  via CDN (`gstatic.com/firebasejs`), API namespacée `firebase.*` plutôt que les imports ES
  modules du SDK v9+ — choisi pour rester cohérent avec le style `<script>` classique du projet
  (pas de build step, pas de `type="module"`).
- Fonctions bas niveau : `fbEnsureAuth()` (popup Google si pas déjà connecté), `fbLoadBdd()`
  (lecture simple du nœud), `fbSaveBdd(mutateFn)` (écriture via `transaction()` RTDB plutôt qu'un
  read-then-write manuel, pour fusionner avec l'autre personnage et rester correct en cas
  d'écriture concurrente depuis un autre appareil) — dupliquées dans les deux fichiers, comme le
  reste de la synchro.

**Historique : migration depuis Google Drive (2026-08-07).** L'implémentation initiale (2026-07-23)
stockait `bdd.json` sur Google Drive via l'API REST + OAuth (`drive` scope, dossier "Cantrip"
auto-créé). Remplacée par Firebase à la demande explicite de l'utilisateur. Toutes les fonctions et
identifiers ont été renommés `drive*` → `fb*` en même temps (`driveLoadBdd`→`fbLoadBdd`,
`ui.driveBusy`→`ui.fbBusy`, `data-action="drive-load-character"`→`"fb-load-character"`, etc.) pour
que le code reste cohérent avec le backend réel plutôt que de garder une terminologie Drive
obsolète. `sw.js` (`CACHE_NAME`) incrémenté en conséquence.

## Outil admin (`cantrip-admin.html`)

Page statique **indépendante** de l'app (pas de logique partagée, pas de `state` commun),
ajoutée à la racine du dépôt et servie sur GitHub Pages à
https://benwatz.github.io/cantrip/cantrip-admin.html. Renommée depuis `cantrip-admin-grimoire.html`
(juillet 2026) quand l'outil s'est étendu de l'édition du Grimoire à celle des personnages
(stats). Sauvegarde locale automatique (`localStorage`, clé `cantrip_admin_grimoire_v1`,
indépendante de `jdr_character_tracker_state`).

Barre du haut en 2 zones (`.topbar`, flex simple `justify-content:space-between` — pas de
CSS Grid, pas de zone centrée) :
- **Gauche** (`.topbar-left`) : titre + deux boutons de personnage
  (`#btnCharCalix`/`#btnCharDeneor`, `ui.activeChar`) à la place d'un ancien menu déroulant.
- **Droite** (`.topbar-right`), dans l'ordre : deux boutons de mode (`ui.mode`,
  `'personnage'` | `'grimoire'`) — **"Personnage"** puis **"Grimoire"** — qui affichent l'un ou
  l'autre panneau (`#personPanel` / `#phone`) sans jamais montrer les deux à la fois ; puis
  **"Charger"** / **"Sauvegarder"** (`#btnFbLoad`/`#btnFbSave`, branchés dans `render()` donc
  disponibles quel que soit le mode affiché). Le panneau "Personnage" reproduit tout ce qui est
  éditable dans "Paramétrer le Personnage" en jeu (PV, Combat, Attaques, Emplacements de sorts,
  Ressources de classe, Caractéristiques, Jets de sauvegarde, Compétences, Sorts préparés pour
  Deneor, Or) ; le panneau "Grimoire" reproduit le rendu du Grimoire de l'app (thème, filtres,
  onglets de niveau) pour éditer les sorts.

**Synchronisation Firebase (Realtime Database, nœud `cantrip`)** — "Charger" (`fbLoadPersonnage()`)
/ "Sauvegarder" (`fbSavePersonnage()`) sont les **mêmes fonctions que dans `index.html`, dupliquées**
(même config `FIREBASE_CONFIG`, même base RTDB — voir section Firebase ci-dessous pour l'historique
et la config complète). "Sauvegarder" écrit dans le nœud `cantrip/<charId>` le personnage actif
(`ui.activeChar`) : à la fois son profil (`deriveFullProfile()`, un profil "frais" — PV au max,
rien d'utilisé, tel qu'édité dans le panneau Personnage) **et** son Grimoire (tel qu'édité dans le
panneau Grimoire) — ça écrase la progression sauvegardée par un joueur en jeu. "Charger" fait
l'inverse : récupère dans les deux panneaux ce qu'un joueur a sauvegardé en jeu (page "Charger un
personnage" de l'app). Une confirmation (`confirm()` natif, cohérent avec le reste de cet outil —
désactivation de niveau, suppression de sort, réinitialisation...) est demandée avant "Charger"
**et** "Sauvegarder" vu le caractère destructif des deux sens.

Ancien flux retiré (juillet 2026) : l'outil publiait auparavant directement sur GitHub (bouton
"Publier", token GitHub PAT stocké en `localStorage`, commit direct sur `master` via l'API GitHub
Contents) pour réécrire les blocs `SPELLBOOK`/`DENEOR_SPELLBOOK` et
`calixDefaultProfile()`/`deneorDefaultProfile()` codés en dur dans `index.html` (le contenu par
défaut des nouvelles installations/réinitialisations). Ce flux a été retiré au profit de la seule
synchronisation cloud ci-dessus (Google Drive à l'origine, migrée vers Firebase en août 2026 — voir
section Firebase), qui couvre le besoin réel (mettre à jour le personnage utilisé en jeu) sans
passer par un commit Git. **Conséquence** : les valeurs par défaut codées en dur
(`calixDefaultProfile`/`deneorDefaultProfile`/`SPELLBOOK`/`DENEOR_SPELLBOOK` dans `index.html`) ne
sont plus modifiables depuis l'outil admin — seule une édition manuelle de `index.html` (ou la
resynchro cloud au premier lancement) les fait évoluer désormais.

Le thème visuel (`data-theme`, voir section Thèmes plus haut) est posé sur `document.documentElement`
(pas sur `<body>`) pour matcher les sélecteurs CSS `:root[data-theme="deneor"]` — bug corrigé
juillet 2026 (le thème Deneor ne s'appliquait jamais visuellement avant ce correctif, même si les
données du personnage changeaient bien).

## Git — spécifique à cette machine, à reconfigurer sur toute nouvelle installation

L'identité Git de ce dépôt est configurée **localement** (pas globalement), pour ne pas exposer
l'email réel dans l'historique public :
```
git config user.name "benwatz"
git config user.email "124379495+benwatz@users.noreply.github.com"
```
Cette config est dans `.git/config`, donc **pas transmise par un `git clone`** — à relancer sur
toute nouvelle machine avant de committer. Compte GitHub renommé "Nerdash" → "benwatz" en
juillet 2026 (même compte/ID, `124379495`) : les anciens commits signés avec l'ancien
`user.email` restent correctement attribués au compte (GitHub associe par ID, pas par nom), mais
toute nouvelle machine doit utiliser le nouveau nom ci-dessus.

## Reste à faire / pistes non traitées

- Personnages : système actuellement limité à deux emplacements fixes (Calix/Deneor), pas de CRUD
  générique (ajout/suppression d'un personnage) — voir section Personnages plus haut.
- Génération d'un `.apk` installable : voie recommandée — passer l'URL GitHub Pages dans
  PWABuilder.com pour générer un APK signé sans installer Android Studio.

## Fichiers sources du brief original

- `specifications_jdr_mobile_v2.md` (à la racine du dépôt) : cahier des charges fonctionnel
  complet, y compris la section 7 (évolution V3 : navigation, Stats/Skills, Grimoire) — à
  relire avant toute évolution fonctionnelle.
