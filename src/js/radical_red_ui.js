/* global getSetOptions, pokedex, setdex, RR_TRAINER_TEAMS, RR_TRAINER_TEAM_INDEX */

(function () {
	"use strict";

	var RR_ROSTER_STORAGE_KEY = "radicalRedSaveRoster";
	var RR_SPRITE_ALIASES = {
		"aegislash-both": "aegislash",
		"necrozma-dusk-mane": "necrozma-duskmane",
		"pikachu-flying": "pikachu",
		"pikachu-surfing": "pikachu",
		"sizzlipede-sevii": "sizzlipedie-sevii",
		"toxtricity-low-key": "toxtricity-lowkey",
		"zebstrika-sevii": "zebrastrika-sevii"
	};

	function rrSpriteSlug(speciesName) {
		return (speciesName || "")
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[’']/g, "")
			.replace(/[^a-zA-Z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.toLowerCase();
	}

	function rrSpriteCandidates(speciesName) {
		var slug = rrSpriteSlug(speciesName);
		var candidates = [slug];
		if (RR_SPRITE_ALIASES[slug]) candidates.push(RR_SPRITE_ALIASES[slug]);
		var compactSlug = slug.replace(/-/g, "");
		if (compactSlug !== slug) candidates.push(compactSlug);

		var base = slug
			.replace(/-sevii(?:-mega)?$/, "")
			.replace(/-mega(?:-[xy])?$/, "")
			.replace(/-(?:alola|galar|hisui|paldea)$/, "");
		if (base && candidates.indexOf(base) === -1) candidates.push(base);
		return candidates;
	}

	function rrSetSprite(img, speciesName) {
		var candidates = rrSpriteCandidates(speciesName);
		img.dataset.spriteCandidates = JSON.stringify(candidates);
		img.dataset.spriteIndex = "0";
		img.alt = speciesName;
		img.title = speciesName;
		img.hidden = false;
		img.src = "./img/pokesprite/" + candidates[0] + ".png";
	}

	function rrCreateSprite(speciesName, className) {
		var img = document.createElement("img");
		img.className = className || "rr-mini-sprite";
		img.addEventListener("error", function () {
			var candidates = JSON.parse(img.dataset.spriteCandidates || "[]");
			var next = parseInt(img.dataset.spriteIndex || "0") + 1;
			if (next < candidates.length) {
				img.dataset.spriteIndex = String(next);
				img.src = "./img/pokesprite/" + candidates[next] + ".png";
			} else {
				img.hidden = true;
			}
		});
		rrSetSprite(img, speciesName);
		return img;
	}

	function rrSetBattleSprite(img, speciesName) {
		var candidates = rrSpriteCandidates(speciesName);
		img.dataset.spriteCandidates = JSON.stringify(candidates);
		img.dataset.spriteIndex = "0";
		img.alt = speciesName;
		img.title = speciesName;
		img.hidden = false;
		img.src = "./img/front/" + candidates[0] + ".gif";
	}

	function rrCreateBattleSprite(speciesName) {
		var img = document.createElement("img");
		img.className = "rr-battle-sprite";
		img.addEventListener("error", function () {
			var candidates = JSON.parse(img.dataset.spriteCandidates || "[]");
			var next = parseInt(img.dataset.spriteIndex || "0") + 1;
			if (next < candidates.length) {
				img.dataset.spriteIndex = String(next);
				img.src = "./img/front/" + candidates[next] + ".gif";
			} else {
				img.hidden = true;
			}
		});
		rrSetBattleSprite(img, speciesName);
		return img;
	}

	function rrParseSetSelection(value) {
		var selected = value || "";
		var separator = selected.indexOf(" (");
		return {
			speciesName: separator >= 0 ? selected.substring(0, separator) : selected,
			setName: separator >= 0 ? selected.substring(separator + 2, selected.lastIndexOf(")")) : ""
		};
	}

	function rrSelectSet(side, speciesName, setName) {
		var selector = $(side + " input.set-selector");
		var value = speciesName + " (" + setName + ")";
		var option = null;
		var options = getSetOptions();
		for (var i = 0; i < options.length; i++) {
			if (options[i].id === value) {
				option = options[i];
				break;
			}
		}

		if (!option) return;

		// Give Select2 the whole option so the chosen Pokémon and set stay in sync.
		selector.select2("data", option, true);
	}

	function rrApplyRosterGender(side, gender) {
		var genderControl = $(side + " .gender");
		if (!genderControl.length) return;
		var value = gender === "F" ? "Female" : gender === "M" ? "Male" : "";
		genderControl.val(value).change();
	}

	function rrMakeRosterButton(mon, setName, targetSide) {
		var importedSet = typeof setdex !== "undefined" && setdex[mon.speciesName] &&
			setdex[mon.speciesName][setName];
		var formeAbilities = mon.formeAbilities || null;
		var gender = mon.gender || importedSet && importedSet.gender || "";
		var button = document.createElement("button");
		button.type = "button";
		button.className = "rr-roster-mon";
		button.title = mon.speciesName + " · Level " + mon.level + " · Click for Pokémon 1, Shift-click for Pokémon 2";
		button.setAttribute("aria-label", button.title);
		button.dataset.speciesName = mon.speciesName;
		button.dataset.setName = setName;
		button.dataset.formeAbilities = JSON.stringify(formeAbilities || {});
		button.appendChild(rrCreateSprite(mon.speciesName));

		var level = document.createElement("span");
		level.className = "rr-roster-level";
		level.textContent = "Lv" + mon.level;
		button.appendChild(level);
		button.addEventListener("click", function (event) {
			var selectedSide = event.shiftKey ? "#p2" : targetSide;
			rrSelectSet(selectedSide, mon.speciesName, setName);
			$(selectedSide).attr("data-forme-abilities", JSON.stringify(formeAbilities || {}));
			rrApplyRosterGender(selectedSide, gender);
			rrUpdateCardSprite(document.querySelector(selectedSide), mon.speciesName);
		});
		return button;
	}

	function rrRenderRosterGroup(container, title, mons, setName, targetSide) {
		if (!mons || !mons.length) return;
		var group = document.createElement("div");
		group.className = "rr-roster-group";

		var heading = document.createElement("strong");
		heading.textContent = title;
		group.appendChild(heading);

		var sprites = document.createElement("div");
		sprites.className = "rr-roster-sprites";
		mons.forEach(function (mon) {
			sprites.appendChild(rrMakeRosterButton(mon, setName, targetSide));
		});
		group.appendChild(sprites);
		container.appendChild(group);
	}

	function rrEnsureSaveRoster() {
		var roster = document.getElementById("rr-save-roster");
		if (roster) return roster;

		var fieldset = document.createElement("fieldset");
		fieldset.className = "rr-save-box";
		var legend = document.createElement("legend");
		legend.setAttribute("align", "center");
		legend.textContent = "My Team / Box";
		fieldset.appendChild(legend);

		roster = document.createElement("section");
		roster.id = "rr-save-roster";
		roster.className = "rr-roster-panel";
		roster.setAttribute("aria-label", "Imported save party and PC");
		fieldset.appendChild(roster);

		var p1 = document.getElementById("p1");
		if (p1 && p1.parentNode) {
			p1.parentNode.classList.add("rr-player-panel");
			p1.parentNode.appendChild(fieldset);
		}
		return roster;
	}

	function rrRenderEmptySaveRoster() {
		var roster = rrEnsureSaveRoster();
		if (roster.children.length) return;
		var message = document.createElement("span");
		message.className = "rr-roster-empty";
		message.textContent = "Import a .sav to show your party and PC Pokémon here.";
		roster.appendChild(message);
	}

	function rrSerializeMons(mons) {
		return (mons || []).map(function (mon) {
			return {
				speciesName: mon.speciesName,
				level: mon.level,
				gender: mon.gender,
				formeAbilities: mon.formeAbilities
			};
		});
	}

	function renderRadicalRedSaveRoster(result, importName) {
		var roster = rrEnsureSaveRoster();
		roster.textContent = "";
		rrRenderRosterGroup(roster, "Team", result.parsedParty, importName, "#p1");
		rrRenderRosterGroup(roster, "Box", result.parsedBoxes, importName, "#p1");
		if (!roster.children.length) rrRenderEmptySaveRoster();

		try {
			localStorage.setItem(RR_ROSTER_STORAGE_KEY, JSON.stringify({
				importName: importName,
				party: rrSerializeMons(result.parsedParty),
				boxes: rrSerializeMons(result.parsedBoxes)
			}));
		} catch (_error) {}
	}

	function rrRestoreSaveRoster() {
		try {
			var saved = JSON.parse(localStorage.getItem(RR_ROSTER_STORAGE_KEY) || "null");
			if (!saved) return;
			renderRadicalRedSaveRoster({parsedParty: saved.party, parsedBoxes: saved.boxes}, saved.importName);
		} catch (_error) {}
	}

	function rrEnsureCardSprite(pokeInfo) {
		var oldSprite = pokeInfo.querySelector(".rr-card-sprite");
		if (oldSprite) oldSprite.parentNode.removeChild(oldSprite);

		var details = pokeInfo.querySelector(".info-group.top");
		if (!details) return null;
		var sprite = details.querySelector(".rr-battle-sprite");
		if (!sprite) {
			var wrapper = document.createElement("div");
			wrapper.className = "rr-battle-sprite-wrap";
			wrapper.setAttribute("aria-hidden", "true");
			sprite = rrCreateBattleSprite("");
			wrapper.appendChild(sprite);
			details.appendChild(wrapper);
		}
		return sprite;
	}

	function rrUpdateCardSprite(pokeInfo, selectedSpeciesName) {
		if (!pokeInfo) return;
		var selection = rrParseSetSelection($(pokeInfo).find("input.set-selector").val());
		var forme = $(pokeInfo).find("select.forme").val();
		var spriteSpeciesName = selectedSpeciesName || selection.speciesName;
		var selectedSpecies = typeof pokedex !== "undefined" && pokedex[selection.speciesName];
		var formeSpecies = typeof pokedex !== "undefined" && pokedex[forme];
		var selectedFamily = selectedSpecies && selectedSpecies.baseSpecies || selection.speciesName;
		var formeFamily = formeSpecies && formeSpecies.baseSpecies || forme;
		// Only use the Forme value when it belongs to the Pokémon we just selected.
		if (!selectedSpeciesName && forme && selectedFamily === formeFamily) spriteSpeciesName = forme;
		var sprite = rrEnsureCardSprite(pokeInfo);
		if (sprite && spriteSpeciesName) rrSetBattleSprite(sprite, spriteSpeciesName);
	}

	function rrEnsureOpponentRoster() {
		var roster = document.getElementById("rr-opponent-roster");
		if (roster) return roster;
		roster = document.createElement("section");
		roster.id = "rr-opponent-roster";
		roster.className = "rr-roster-panel rr-opponent-roster";
		roster.setAttribute("aria-label", "Opposing trainer team");
		document.getElementById("p2").appendChild(roster);
		return roster;
	}

	function rrRenderOpponentTeamGroup(roster, title, mons, defaultSetName) {
		var group = document.createElement("div");
		group.className = "rr-roster-group";
		var heading = document.createElement("strong");
		heading.textContent = title;
		group.appendChild(heading);
		var sprites = document.createElement("div");
		sprites.className = "rr-roster-sprites";
		mons.forEach(function (mon) {
			sprites.appendChild(rrMakeRosterButton(mon, mon.setName || defaultSetName, "#p2"));
		});
		group.appendChild(sprites);
		roster.appendChild(group);
	}

	function rrRenderOpponentRoster(selection) {
		var roster = rrEnsureOpponentRoster();
		roster.textContent = "";
		if (!selection.setName || typeof setdex === "undefined") return;

		var selectionKey = selection.speciesName + " (" + selection.setName + ")";
		var teamIndexes = typeof RR_TRAINER_TEAM_INDEX === "undefined" ? [] : RR_TRAINER_TEAM_INDEX[selectionKey];
		var teams = [];
		if (teamIndexes && typeof RR_TRAINER_TEAMS !== "undefined") {
			teamIndexes.forEach(function (teamIndex) { teams.push(RR_TRAINER_TEAMS[teamIndex]); });
		}
		if (teams.length) {
			var selectedGenders = [];
			teams.forEach(function (team, index) {
				var title = "Opposing team · " + selection.setName;
				if (teams.length > 1) title += " · Team " + (index + 1);
				rrRenderOpponentTeamGroup(roster, title, team.members, selection.setName);
				team.members.forEach(function (member) {
					if (member.selection === selectionKey && selectedGenders.indexOf(member.gender) === -1) {
						selectedGenders.push(member.gender);
					}
				});
			});
			if (selectedGenders.length === 1) rrApplyRosterGender("#p2", selectedGenders[0]);
			return;
		}

		// Older trainer data can still be grouped when it looks like one full team.
		var mons = [];
		Object.keys(setdex).forEach(function (speciesName) {
			if (setdex[speciesName] && setdex[speciesName][selection.setName]) {
				mons.push({
					speciesName: speciesName,
					setName: selection.setName,
					level: setdex[speciesName][selection.setName].level || 100
				});
			}
		});
		if (mons.length > 6) mons = [];
		if (!mons.length) return;
		rrRenderOpponentTeamGroup(roster, "Opposing team · " + selection.setName, mons, selection.setName);
	}

	window.renderRadicalRedSaveRoster = renderRadicalRedSaveRoster;
	window.updateRadicalRedCardSprite = function (pokeInfo) {
		rrUpdateCardSprite(pokeInfo);
	};

	$(function () {
		if (document.title.indexOf("Radical Red") < 0) return;
		rrEnsureSaveRoster();
		rrRestoreSaveRoster();
		rrRenderEmptySaveRoster();
		$(".poke-info").each(function () { rrUpdateCardSprite(this); });
		rrRenderOpponentRoster(rrParseSetSelection($("#p2 input.set-selector").val()));
		$(document).on("change.rrSprites select2-selected.rrSprites", "input.set-selector", function () {
			var pokeInfo = $(this).closest(".poke-info")[0];
			if (!pokeInfo) return;
			rrUpdateCardSprite(pokeInfo);
			if (pokeInfo.id === "p2") rrRenderOpponentRoster(rrParseSetSelection($(this).val()));
		});
		$(document).on("change.rrSprites", "select.forme", function () {
			var pokeInfo = $(this).closest(".poke-info")[0];
			if (pokeInfo) rrUpdateCardSprite(pokeInfo);
		});
	});
})();
