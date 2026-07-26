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
  `renderSettings()` (menu Paramètres) / `renderSettingsCharacter()` / `renderSettingsGrimoire()` /
  `renderSettingsLoadCharacter()` selon `ui.view`, puis ajoute
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
   bloc "Emplacements de sorts" (groupés par niveau en badges circulaires), la ligne de 3 tuiles
   CA / Initiative / Déplacement (`profile.combatStats: { ac, initiative, speed }`), puis en tout
   dernier le bouton "Repos" (ordre changé en juillet 2026 pour que Repos suive directement les
   tuiles de combat) — ce regroupement dans le scroll évite qu'ils occupent en permanence de la
   place à l'écran.
   Éditables directement ici en plus de Paramètres (juillet 2026) : tap sur une valeur des tuiles
   CA/Initiative/Déplacement (`data-action="edit-combat-stat"`) pour la remplacer par un champ
   texte (`ui.editingCombatStat`, même pattern clic-pour-éditer que le max de PV/bouclier
   temporaire — `combatStatInput`, focus + sélection auto, `blur`/Entrée valide et appelle
   `saveState()` directement, pas de brouillon différé contrairement à Paramétrer le Personnage).
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
   Deux marqueurs toggle (`profile.concentration`, `profile.inspiration`, booléens indépendants)
   alignés à droite sur la ligne du nom du personnage, dans l'ordre inspiration puis
   concentration : point d'inspiration (icône étoile
   `iconStar(filled)`, se remplit — `fill:currentColor` — quand actif, simple surbrillance ambre,
   pas de glow) et concentration (icône smiley aux sourcils froncés `ICON_CONCENTRATION`, glow
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
   `#grimoirePrepareFab`).
3. **Grimoire** — affiche les capacités du personnage (sorts par niveau + capacités de classe et
   dons), regroupées par section avec badge de type d'action coloré (Action/Bonus/Réaction/
   Rituel/Passif...), niveau, portée/durée et note d'usage en italique. Contenu **statique,
   codé en dur** dans `index.html` (pas dans `state`), une constante par personnage —
   `SPELLBOOK` pour Calix Noctavel, `DENEOR_SPELLBOOK` pour Deneor Sentariel — sélectionnée via
   `activeSpellbook()` selon `state.activeCharacterId`. Pas d'UI d'édition du contenu lui-même
   (CRUD depuis Paramètres, multi-personnage générique) ; voir `specifications_jdr_mobile_v2.md`
   section 7.3 pour la spec d'origine.
   **Grimoire de Deneor (Paladin, Serment des Anciens)** : système de préparation de sorts
   quotidienne, voir sous-section dédiée plus bas.
   Pagination par onglets sous le titre "Grimoire" : un onglet par niveau de sort de 0 à
   `maxEnabledSpellLevel()` (le plus haut niveau d'emplacement activé dans Paramètres) — l'onglet
   0 est omis si le grimoire actif (`activeSpellbook()`) n'a aucun sort de niveau 0 (cas de Deneor,
   qui n'a pas de sorts mineurs de Paladin) —, plus un onglet "Classe" en dernière position pour la
   section "Capacités de classe et dons" (non liée à un niveau). Navigation par tap sur un onglet
   (`data-action="grimoire-tab"`) ou par swipe
   horizontal sur la zone de contenu (`#grimoireSwipe`, listeners `touchstart`/`touchend` dans
   `bindEvents()`) : swipe vers la gauche = niveau suivant, swipe vers la droite = niveau
   précédent, sans effet de bord aux extrémités (`grimoireStep()`). Le swipe (mais pas le tap sur
   un onglet) déclenche une animation de glissement directionnelle sur `#grimoireSwipe`
   (`ui.grimoireAnimDirection`, classes CSS `grimoire-anim-next`/`-prev`, consommée une seule
   fois par `renderGrimoire()` pour ne pas se rejouer aux re-renders suivants). L'onglet actif
   (`ui.grimoireTab`, état éphémère, vaut `0` par défaut en début de session) est recalé sur
   `tabs[0]` (premier onglet réellement disponible, **pas** un `0` en dur) si le niveau affiché
   n'existe plus parmi les onglets courants — que ce soit après un changement de config dans
   Paramètres (ex. désactivation du niveau en cours de visionnage) ou simplement parce que `0`
   n'est jamais un onglet valide chez Deneor (pas de sorts de niveau 0) : sans ce recalage sur
   `tabs[0]`, le Grimoire de Deneor s'ouvrait sur un onglet invalide au premier chargement de
   session et affichait "Aucun sort à ce niveau" malgré des sorts existants (bug corrigé
   2026-07-13). Même logique dans `renderGrimoirePrepare()`.
   Filtres par type sur la même ligne que le titre "Grimoire", alignés à droite : Action / Bonus
   / Réaction (`GRIMOIRE_FILTERS`, chips `data-action="toggle-grimoire-filter"`). Plusieurs
   filtres actifs se combinent en OR (`spellMatchesGrimoireFilters()`) ; aucun filtre actif =
   tout afficher. L'état (`ui.grimoireFilters`, éphémère) est conservé en changeant d'onglet de
   niveau puisqu'il n'est jamais réinitialisé par `renderGrimoire()`/`grimoireStep()`.

   **Préparation de sorts (Deneor uniquement)** — contrairement à Calix, le Grimoire de Deneor
   n'affiche pas tout `DENEOR_SPELLBOOK` en lecture seule : dans `renderGrimoire()`, les sections
   autres que `classe` sont filtrées aux sorts ayant `alwaysAvailable: true` (sorts de serment,
   toujours disponibles) ou présents dans `profile().preparedSpells` (tableau de noms de sorts,
   persistant, migré par `sanitizeProfile()`) ; la section `classe` (capacités de classe, de
   serment, et la card `SERMENT` de résumé des préceptes) reste toujours affichée en entier.
   Une page dédiée `renderGrimoirePrepare()` (`view: 'grimoire-prepare'`) permet de choisir les
   sorts préparés, sans plafond imposé : elle réutilise les onglets de niveau
   (`grimoireTabs()`/`ui.grimoireTab`/`grimoireStep()`, y compris le swipe, `#grimoireSwipe`
   partagé puisque les deux pages ne sont jamais montées en même temps) **sans l'onglet Classe**,
   filtré (`tabs.filter(t => t !== 'classe')`) puisque les capacités de classe/serment ne sont pas
   préparables — elles n'apparaissent que dans le Grimoire normal. Pour chaque niveau, affiche
   uniquement les sorts préparables (`!spell.alwaysAvailable`) ; les sorts de serment toujours
   disponibles n'apparaissent jamais sur cette page non plus. Rendus par `renderGrimoireSection
   (section, spells, true)`, chaque sort toggle sa présence au tap
   (`data-action="toggle-prepared-spell"`) avec une mise en évidence volontairement appuyée (fond
   vert teinté, bordure gauche verte pleine, et un badge circulaire à coche à gauche du nom) car
   la version précédente — un simple liseré `border-tint` — se distinguait trop peu du reste de
   la liste. Un badge rond mis en valeur (fond plein, juste le chiffre) affiche le nombre total de
   sorts sélectionnés (tous niveaux confondus) en haut à droite de l'en-tête ; comme la liste
   affichée ne couvre que le niveau de l'onglet courant, une pastille verte est aussi ajoutée sur
   chaque onglet de niveau contenant au moins un sort préparé (`grimoireTabsHtml(tabs, dotLevels)`,
   paramètre optionnel calculé dans `renderGrimoirePrepare()` uniquement) pour repérer d'un coup
   d'oeil où se trouvent les sorts comptés dans le badge. Filtres dédiés `PREPARE_FILTERS` (état
   `ui.prepareFilters`, éphémère) : Action / Bonus (pas de Réaction — aucun sort de ce type chez
   Deneor — ni de Classe), plus deux filtres "Préparé"/"Non préparé" (juillet 2026) qui ne testent
   pas le type du sort mais sa présence (ou absence) dans `ui.draftPreparedSpells` (traités à part
   de la correspondance par préfixe de type dans `spellMatchesPrepareTypeFilters()`) ; comme les
   autres filtres du Grimoire, chaque chip togglé indépendamment au clic
   (`data-action="toggle-prepare-filter"`) et combiné en OR avec les autres filtres actifs — activer
   à la fois "Préparé" et "Non préparé" affiche donc tous les sorts (union des deux), pas
   l'intersection vide.
   **Brouillon non destructif** : les sélections ne modifient pas directement
   `profile().preparedSpells` mais une copie de travail éphémère `ui.draftPreparedSpells`
   (initialisée à l'entrée sur la page, dans les trois points d'entrée ci-dessous). La flèche
   retour en haut à gauche (`data-action="nav"`) ferme la page sans rien valider — le brouillon est
   simplement abandonné. Seul le bouton "Valider" en bas de page
   (`data-action="confirm-grimoire-prepare"`) répercute `ui.draftPreparedSpells` dans
   `profile().preparedSpells`, sauvegarde (`saveState()`) et revient à `ui.grimoirePrepareBackView`.
   Trois points d'entrée vers cette page, chacun fixant `ui.grimoirePrepareBackView` (pour que le
   bouton retour/Valider revienne au bon endroit) et `ui.draftPreparedSpells` : le bouton flottant
   `#grimoirePrepareFab` en bas du Grimoire (visible seulement en haut de la liste, listener de
   scroll sur `#grimoireSwipe` dans `bindEvents()` qui bascule directement
   `style.opacity`/`pointerEvents` sans `render()`), le bouton "Préparer mes sorts" de
   `renderSettingsGrimoire()` (qui bascule aussi sur son contenu Deneor selon
   `state.activeCharacterId`), et le bouton "Se reposer et préparer des sorts" de la modale Repos
   (Deneor uniquement, `confirmRestAndPrepare()` — factorisé avec `confirmRest()` via
   `applyRestChecks()` commun).
4. **Paramètres** — `renderSettings()` affiche un menu de trois boutons (`data-action="nav"`,
   réutilise le pattern générique de navigation) qui renvoient chacun vers une sous-page dédiée.
   Chaque sous-page a son propre `view` (`settings-character` / `settings-grimoire` /
   `settings-load-character`) et affiche en haut un bouton retour (`renderSettingsHeader()`) qui
   repositionne `ui.view = 'settings'` (retour au menu, pas au Tracker). Dans la barre de
   navigation basse, l'onglet Paramètres reste en surbrillance tant que `ui.view` commence par
   `"settings"` (menu ou n'importe quelle sous-page). Le troisième bouton du menu, "Gestion des
   personnages" (libellé ; la vue interne garde le nom `settings-load-character`), renvoie
   directement à `renderSettingsLoadCharacter()` (voir section Personnages ci-dessous) — il n'y a
   plus de niveau intermédiaire "Paramétrer l'application" depuis juillet 2026 (l'écran ne servait
   plus qu'à ça après le retrait de l'export/import JSON, voir plus bas).
   - **Paramétrer le Personnage** (`renderSettingsCharacter()`) — nom du personnage,
     CA/Initiative/Déplacement (`data-action="combat-input"`, Initiative signée via
     `formatSigned()`, CA/Déplacement non signés), liste d'attaques (voir ci-dessous), config des
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
   - **Paramétrer le Grimoire** (`renderSettingsGrimoire()`) — branché sur
     `state.activeCharacterId` : pour Calix, contenu inchangé et non éditable (`SPELLBOOK` fixe,
     emplacement UI "à venir" pour un futur sélecteur connus/préparés côté Calix — non développé).
     Pour Deneor, affiche un résumé du système de préparation et un bouton "Préparer mes sorts"
     vers `renderGrimoirePrepare()` (voir section Grimoire plus haut).
   - **Gestion des personnages** (`renderSettingsLoadCharacter()`, troisième bouton du menu
     Paramètres) — voir section Personnages ci-dessous. Pas de toggle de thème ici : le thème suit
     le personnage chargé, voir section Thèmes (Calix / Deneor) plus bas.

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
  troisième bouton du menu Paramètres — le header de la page garde le titre "Charger un
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
  "drive-load-character"`, toujours actif) puis, uniquement si le personnage affiché est déjà
  actif (`isActive`), **Sauvegarder ce personnage** (`data-action="drive-save-character"`) — puis
  la rangée flèches/pastilles du carrousel. Les flèches gauche/droite
  (`data-action="character-carousel-step"`) sont volontairement à la même taille que les boutons
  −/+ du bloc PV du Tracker (80×76px, icône 36px, via `iconArrowLeft(size)`) plutôt que la taille
  généraliste 36×36 des autres boutons de navigation (`navBackButtonHtml()`), pour rester faciles
  à toucher (juillet 2026).
  Les deux boutons passent par `bdd.json` sur Google Drive (mêmes fonctions `driveLoadBdd()`/
  `driveSaveBdd()` que dans `cantrip-admin.html`, voir section Outil admin plus bas) plutôt que par
  une simple copie locale de `character.savedProfile` — un tap ouvre d'abord une modale de
  confirmation (`renderDriveConfirmModal()`, état `ui.driveConfirm = { action: 'load'|'save',
  charId? }`, même gabarit visuel que `renderDisableLevelModal()`) rappelant que l'opération
  écrase soit la sauvegarde locale sur cet appareil, soit celle sur Drive ; valider déclenche
  `performDriveLoad()`/`performDriveSave()`, qui posent `ui.driveBusy` (désactive les boutons,
  affiche "Synchronisation avec Drive…") puis, en cas de succès, mettent à jour
  `character.savedProfile`, appliquent le thème (`applyTheme()`) et le profil actif, et affichent
  un toast de confirmation (`showDriveToast()`/`ui.driveToast`) ; en cas d'échec, `ui.driveError`
  s'affiche sous les boutons. `character.savedProfile` de chaque personnage reste donc modifiable
  depuis l'app elle-même via cette synchro Drive (contrairement aux valeurs par défaut codées en
  dur, voir section Outil admin plus bas).
  Le Grimoire affiché dépend de `state.activeCharacterId` (`activeSpellbook()`, voir section
  Grimoire plus haut) : charger Deneor bascule sur `DENEOR_SPELLBOOK` et son système de
  préparation de sorts, indépendant du contenu de Calix.

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
  **"Charger"** / **"Sauvegarder"** (`#btnDriveLoad`/`#btnDriveSave`, branchés dans `render()` donc
  disponibles quel que soit le mode affiché). Le panneau "Personnage" reproduit tout ce qui est
  éditable dans "Paramétrer le Personnage" en jeu (PV, Combat, Attaques, Emplacements de sorts,
  Ressources de classe, Caractéristiques, Jets de sauvegarde, Compétences, Sorts préparés pour
  Deneor, Or) ; le panneau "Grimoire" reproduit le rendu du Grimoire de l'app (thème, filtres,
  onglets de niveau) pour éditer les sorts.

**Synchronisation Google Drive (`bdd.json`)** — "Charger" (`driveLoadPersonnage()`) / "Sauvegarder"
(`driveSavePersonnage()`) sont les **mêmes fonctions que dans `index.html`, dupliquées** (mêmes
constantes `GOOGLE_CLIENT_ID`/`DRIVE_SCOPE`/`DRIVE_META_KEY`, même fichier `bdd.json` sur Drive).
"Sauvegarder" écrit dans `bdd.json` le personnage actif (`ui.activeChar`) : à la fois son profil
(`deriveFullProfile()`, un profil "frais" — PV au max, rien d'utilisé, tel qu'édité dans le
panneau Personnage) **et** son Grimoire (tel qu'édité dans le panneau Grimoire) — ça écrase la
progression sauvegardée par un joueur en jeu. "Charger" fait l'inverse : récupère dans les deux
panneaux ce qu'un joueur a sauvegardé en jeu (page "Charger un personnage" de l'app). Une
confirmation (`confirm()` natif, cohérent avec le reste de cet outil — désactivation de niveau,
suppression de sort, réinitialisation...) est demandée avant "Charger" **et** "Sauvegarder" vu le
caractère destructif des deux sens.

Ancien flux retiré (juillet 2026) : l'outil publiait auparavant directement sur GitHub (bouton
"Publier", token GitHub PAT stocké en `localStorage`, commit direct sur `master` via l'API GitHub
Contents) pour réécrire les blocs `SPELLBOOK`/`DENEOR_SPELLBOOK` et
`calixDefaultProfile()`/`deneorDefaultProfile()` codés en dur dans `index.html` (le contenu par
défaut des nouvelles installations/réinitialisations). Ce flux a été retiré au profit de la seule
synchronisation Drive ci-dessus, qui couvre le besoin réel (mettre à jour le personnage utilisé en
jeu) sans passer par un commit Git. **Conséquence** : les valeurs par défaut codées en dur
(`calixDefaultProfile`/`deneorDefaultProfile`/`SPELLBOOK`/`DENEOR_SPELLBOOK` dans `index.html`) ne
sont plus modifiables depuis l'outil admin — seule une édition manuelle de `index.html` (ou la
resynchro Drive au premier lancement) les fait évoluer désormais.

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

- Sélecteur connus/préparés pour le Grimoire de Calix : emplacement UI réservé dans
  `renderSettingsGrimoire()` mais logique non développée (Deneor a son propre système de
  préparation de sorts, voir section Grimoire plus haut — indépendant de celui-ci).
- Personnages : système actuellement limité à deux emplacements fixes (Calix/Deneor), pas de CRUD
  générique (ajout/suppression d'un personnage) — voir section Personnages plus haut.
- Génération d'un `.apk` installable : voie recommandée — passer l'URL GitHub Pages dans
  PWABuilder.com pour générer un APK signé sans installer Android Studio.

## Fichiers sources du brief original

- `specifications_jdr_mobile_v2.md` (à la racine du dépôt) : cahier des charges fonctionnel
  complet, y compris la section 7 (évolution V3 : navigation, Stats/Skills, Grimoire) — à
  relire avant toute évolution fonctionnelle.
