/* eslint-env node */
"use strict";

// Generates the ID-aware team lookup used by the opponent roster. The input is
// Rudo2204's Radical Red 4.1 min-grind trainer dump:
// https://gist.github.com/Rudo2204/f4a06a37c2320e2b6094958e8dad785c

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var projectRoot = path.resolve(__dirname, "..");
var inputPath = path.resolve(process.argv[2] || path.join(projectRoot, "trainer-data-4.1.txt"));
var verbose = process.argv.indexOf("--verbose") !== -1;
var verboseFilterArg = process.argv.filter(function (arg) { return /^--filter=/.test(arg); })[0];
var verboseFilter = verboseFilterArg ? normalized(verboseFilterArg.substring(9)) : "elitefour";
var modeArg = process.argv.filter(function (arg) { return /^--mode=/.test(arg); })[0];
var mode = modeArg ? modeArg.substring(7) : "normal";
if (mode !== "normal" && mode !== "hardcore") throw new Error("Mode must be normal or hardcore");
var setdexPath = path.join(projectRoot, "src/js/data/sets/" + mode + ".js");
var outputPath = path.join(projectRoot, "src/js/data/sets/trainer-teams-" + mode + ".js");

// Some ordinary trainers reuse the same display name and have sets whose
// moves differ slightly between the calculator data and the trainer dump.
// Pin these ambiguous slots to the encounter confirmed by trainer ID.
var MATCH_OVERRIDES = {
	normal: {
		"0x46|golbat": "Golbat (Team Rocket Grunt Set 7)",
		"0x46|perrserker": "Perrserker (Team Rocket Grunt Set 3)",
		"0x16d|machoke": "Machoke (Team Rocket Grunt Set 1)",
		"0x16d|perrserker": "Perrserker (Team Rocket Grunt Set 1)",
		"0x181|golbat": "Golbat (Team Rocket Grunt Set 4)",
		"0x181|perrserker": "Perrserker (Team Rocket Grunt Set 2)"
	}
};

function normalized(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[.']/g, "")
		.replace(/[^a-z0-9]+/g, "");
}

function displayTrainerName(value) {
	return String(value || "").replace(/\{PK\}\{MN\}/gi, "PkMn");
}

function parseDump(text) {
	var trainers = [];
	var blocks = text.replace(/\r/g, "").split(/^={10,}\s*$/m);
	blocks.forEach(function (block) {
		var lines = block.trim().split("\n");
		var header = lines[0] && lines[0].match(/^(.+?)\s+\(id:\s*(0x[0-9a-f]+)\)$/i);
		if (!header) return;

		var trainer = {id: header[2].toLowerCase(), name: displayTrainerName(header[1].trim()), pokemon: []};
		var current = null;
		lines.slice(1).forEach(function (line) {
			var pokemon = line.match(/^(.+?)(?: \(([^)]+)\))? @ (.+)$/);
			if (pokemon) {
				current = {
					speciesName: pokemon[1].trim(),
					gender: pokemon[2] === "M" || pokemon[2] === "F" ? pokemon[2] : "N",
					item: pokemon[3].trim(),
					moves: []
				};
				trainer.pokemon.push(current);
				return;
			}
			if (!current) return;
			var field = line.match(/^(Ability|Level): (.+)$/);
			if (field) {
				current[field[1].toLowerCase()] = field[2].trim();
				return;
			}
			var nature = line.match(/^(.+) Nature$/);
			if (nature) current.nature = nature[1].trim();
			if (/^- /.test(line)) current.moves.push(line.substring(2).trim());
		});
		if (trainer.pokemon.length) trainers.push(trainer);
	});
	return trainers;
}

function loadSetdex() {
	var context = {};
	vm.createContext(context);
	vm.runInContext(fs.readFileSync(setdexPath, "utf8"), context, {filename: setdexPath});
	return context.SETDEX_SV;
}

function fingerprint(speciesName, set) {
	return [
		normalized(speciesName),
		normalized(set.item || "None"),
		normalized(set.ability),
		normalized(set.nature),
		(set.moves || []).map(normalized).sort().join(",")
	].join("|");
}

function setSignature(set) {
	return [
		normalized(set.item || "None"),
		normalized(set.ability),
		normalized(set.nature),
		set.level || 100,
		(set.moves || []).map(normalized).sort().join(",")
	].join("|");
}

function sameSpeciesFamily(first, second) {
	var a = normalized(first);
	var b = normalized(second);
	if (a.indexOf("aegislash") === 0 && b.indexOf("aegislash") === 0) return true;
	return a.indexOf(b) === 0 || b.indexOf(a) === 0;
}

function interchangeableBattleForm(first, second) {
	if (!sameSpeciesFamily(first, second)) return false;
	var family = normalized(first);
	return family.indexOf("aegislash") === 0 || family.indexOf("kyurem") === 0;
}

function baseSetName(setName) {
	return normalized(String(setName || "").replace(/^\*/, "").replace(/ Set \d+$/, ""));
}

function matchScore(pokemon, candidate, trainerName) {
	var set = candidate.set;
	var pokemonMoves = (pokemon.moves || []).map(normalized);
	var setMoves = (set.moves || []).map(normalized);
	var sharedMoves = pokemonMoves.filter(function (move) { return setMoves.indexOf(move) !== -1; }).length;
	var score = sharedMoves * 2;
	if (normalized(pokemon.item || "None") === normalized(set.item || "None")) score += 3;
	if (normalized(pokemon.ability) === normalized(set.ability)) score += 2;
	if (normalized(pokemon.nature) === normalized(set.nature)) score += 1;
	if (baseSetName(candidate.setName) === normalized(trainerName)) score += 3;
	return score;
}

function speciesCandidates(pokemon) {
	var names = [pokemon.speciesName];
	var item = normalized(pokemon.item);
	if (/ite$/.test(item)) names.push(pokemon.speciesName + "-Mega");
	if (item === "charizarditex") names.push(pokemon.speciesName + "-Mega-X");
	if (item === "charizarditey") names.push(pokemon.speciesName + "-Mega-Y");
	if (pokemon.speciesName === "Kyogre" && item === "blueorb") names.push("Kyogre-Primal");
	if (pokemon.speciesName === "Groudon" && item === "redorb") names.push("Groudon-Primal");
	if (pokemon.speciesName === "Dialga" && item === "adamantorb") names.push("Dialga-Primal");
	if (pokemon.speciesName.indexOf("Necrozma-") === 0 && item === "necroziumz") names.push("Necrozma-Ultra");
	return names;
}

function numericLevel(value) {
	return /^\d+$/.test(String(value || "")) ? Number(value) : null;
}

function median(values) {
	if (!values.length) return null;
	var sorted = values.slice().sort(function (a, b) { return a - b; });
	return sorted[Math.floor(sorted.length / 2)];
}

function asMember(match, gender) {
	return {
		selection: match.selection,
		speciesName: match.speciesName,
		setName: match.setName,
		level: match.level,
		gender: gender === "M" || gender === "F" || gender === "N" ? gender : undefined
	};
}

function generate(trainers, setdex) {
	var exactSets = Object.create(null);
	var speciesSets = Object.create(null);
	var allCandidates = [];
	Object.keys(setdex).forEach(function (speciesName) {
		Object.keys(setdex[speciesName] || {}).forEach(function (setName) {
			var set = setdex[speciesName][setName];
			var key = fingerprint(speciesName, set);
			if (!exactSets[key]) exactSets[key] = [];
			var candidate = {
				selection: speciesName + " (" + setName + ")",
				speciesName: speciesName,
				setName: setName,
				level: set.level || 100,
				set: set
			};
			exactSets[key].push(candidate);
			allCandidates.push(candidate);
			if (!speciesSets[normalized(speciesName)]) speciesSets[normalized(speciesName)] = [];
			speciesSets[normalized(speciesName)].push(candidate);
		});
	});

	var teams = [];
	var index = Object.create(null);
	var incompleteTeams = 0;
	trainers.forEach(function (trainer) {
		var slots = [];
		var knownOffsets = [];
		trainer.pokemon.forEach(function (pokemon) {
			var candidateNames = speciesCandidates(pokemon);
			var matches = [];
			candidateNames.forEach(function (speciesName) {
				matches = matches.concat(exactSets[fingerprint(speciesName, pokemon)] || []);
			});
			var overrideSelection = (MATCH_OVERRIDES[mode] || {})[
				trainer.id + "|" + normalized(pokemon.speciesName)
			];
			var match = overrideSelection ? allCandidates.filter(function (candidate) {
				return candidate.selection === overrideSelection;
			})[0] : (matches.length === 1 ? matches[0] : null);
			var forcedMatch = Boolean(overrideSelection && match);
			var possibleSets = [];
			candidateNames.forEach(function (speciesName) {
				possibleSets = possibleSets.concat(speciesSets[normalized(speciesName)] || []);
			});
			Object.keys(speciesSets).forEach(function (speciesKey) {
				if (sameSpeciesFamily(speciesKey, pokemon.speciesName)) {
					possibleSets = possibleSets.concat(speciesSets[speciesKey]);
				}
			});
			possibleSets = possibleSets.filter(function (candidate, candidateIndex, candidates) {
				return candidates.map(function (entry) { return entry.selection; }).indexOf(candidate.selection) ===
					candidateIndex;
			});
			var scored = possibleSets.map(function (candidate) {
				return {candidate: candidate, score: matchScore(pokemon, candidate, trainer.name)};
			}).sort(function (a, b) { return b.score - a.score; });
			if (!forcedMatch && match && scored.length && scored[0].score > matchScore(pokemon, match, trainer.name)) {
				match = scored[0].candidate;
			}
			if (!forcedMatch && !match) {
				if (scored.length && scored[0].score >= 8 && (!scored[1] || scored[0].score > scored[1].score)) {
					match = scored[0].candidate;
				}
			}
			var dumpLevel = numericLevel(pokemon.level);
			if (match && dumpLevel !== null) knownOffsets.push(match.level - dumpLevel);
			slots.push({pokemon: pokemon, match: match, scored: scored});
		});

		var expectedOffset = median(knownOffsets);
		var expectedTeamLevel = median(slots.filter(function (slot) { return slot.match; }).map(function (slot) {
			return slot.match.level;
		}));
		slots.forEach(function (slot) {
			if (slot.match || !slot.scored.length || slot.scored[0].score < 8) return;
			var dumpLevel = numericLevel(slot.pokemon.level);
			slot.scored.sort(function (a, b) {
				if (b.score !== a.score) return b.score - a.score;
				if (dumpLevel === null || expectedOffset === null) {
					if (expectedTeamLevel === null) return 0;
					return Math.abs(a.candidate.level - expectedTeamLevel) -
						Math.abs(b.candidate.level - expectedTeamLevel);
				}
				var aDistance = Math.abs((a.candidate.level - dumpLevel) - expectedOffset);
				var bDistance = Math.abs((b.candidate.level - dumpLevel) - expectedOffset);
				return aDistance - bDistance;
			});
			var best = slot.scored[0];
			var second = slot.scored[1];
			var levelBreaksTie = second && ((dumpLevel !== null && expectedOffset !== null &&
				Math.abs((best.candidate.level - dumpLevel) - expectedOffset) <
				Math.abs((second.candidate.level - dumpLevel) - expectedOffset)) ||
				((dumpLevel === null || expectedOffset === null) && expectedTeamLevel !== null &&
				Math.abs(best.candidate.level - expectedTeamLevel) <
				Math.abs(second.candidate.level - expectedTeamLevel)));
			if (!second || best.score > second.score || levelBreaksTie) slot.match = best.candidate;
		});

		var members = slots.filter(function (slot) { return slot.match; }).map(function (slot) {
			return asMember(slot.match, slot.pokemon.gender);
		});
		var unmatched = slots.filter(function (slot) { return !slot.match; }).map(function (slot) {
			return slot.pokemon.speciesName;
		});
		if (verbose && unmatched.length && normalized(trainer.name).indexOf(verboseFilter) !== -1) {
			console.warn(trainer.id + " " + trainer.name + " unmatched: " + unmatched.join(", "));
		}

		// A partial team is more misleading than no preview.
		if (!members.length || members.length !== trainer.pokemon.length) {
			incompleteTeams++;
			return;
		}
		var teamIndex = teams.length;
		teams.push({id: trainer.id, name: trainer.name, members: members});
		members.forEach(function (member) {
			if (!index[member.selection]) index[member.selection] = [];
			index[member.selection].push(teamIndex);
		});
	});

	// Some selectable forms share one in-game party slot (Aegislash stances,
	// Schooling, Zen Mode, etc.). Point equivalent form entries at the same team.
	allCandidates.forEach(function (candidate) {
		if (index[candidate.selection]) return;
		var donorIndexes = [];
		allCandidates.forEach(function (donor) {
			if (!index[donor.selection] || donor.setName !== candidate.setName ||
				!sameSpeciesFamily(donor.speciesName, candidate.speciesName) ||
				(setSignature(donor.set) !== setSignature(candidate.set) &&
				!interchangeableBattleForm(donor.speciesName, candidate.speciesName))) return;
			donorIndexes.push(JSON.stringify(index[donor.selection]));
		});
		donorIndexes = donorIndexes.filter(function (value, valueIndex, values) {
			return values.indexOf(value) === valueIndex;
		});
		if (donorIndexes.length === 1) index[candidate.selection] = JSON.parse(donorIndexes[0]);
	});

	// A few documented post-game teams are present in the calculator set data
	// but absent from the ROM dump. Their starred label is unique, so preserve
	// that complete group as a synthetic team instead of relying on UI guessing.
	var starredGroups = Object.create(null);
	allCandidates.forEach(function (candidate) {
		if (candidate.setName.charAt(0) !== "*") return;
		if (!starredGroups[candidate.setName]) starredGroups[candidate.setName] = [];
		starredGroups[candidate.setName].push(candidate);
	});
	Object.keys(starredGroups).forEach(function (setName) {
		var candidates = starredGroups[setName];
		if (candidates.length > 6 || candidates.some(function (candidate) {
			return index[candidate.selection];
		})) return;
		var teamIndex = teams.length;
		var members = candidates.map(asMember);
		teams.push({id: "set-" + normalized(setName), name: setName.substring(1), members: members});
		members.forEach(function (member) { index[member.selection] = [teamIndex]; });
	});

	return {teams: teams, index: index, incompleteTeams: incompleteTeams};
}

var setdex = loadSetdex();
var generated = generate(parseDump(fs.readFileSync(inputPath, "utf8")), setdex);
var starredSelections = [];
Object.keys(setdex).forEach(function (speciesName) {
	Object.keys(setdex[speciesName]).forEach(function (setName) {
		if (setName.charAt(0) === "*") starredSelections.push(speciesName + " (" + setName + ")");
	});
});
var missingStarredSelections = starredSelections.filter(function (selection) {
	return !generated.index[selection];
});
var source = [
	"// Generated by scripts/generate-trainer-teams.js from the Radical Red 4.1 " + mode + " trainer dump.",
	"var RR_TRAINER_TEAMS = " + JSON.stringify(generated.teams) + ";",
	"var RR_TRAINER_TEAM_INDEX = " + JSON.stringify(generated.index) + ";",
	""
].join("\n");
fs.writeFileSync(outputPath, source);
console.log("Generated " + generated.teams.length + " complete " + mode + " teams (" +
	generated.incompleteTeams + " incomplete) in " + outputPath);
console.log("Mapped " + (starredSelections.length - missingStarredSelections.length) + "/" +
	starredSelections.length + " starred " + mode + " selections.");
if (missingStarredSelections.length) {
	console.warn("Unmapped starred selections:\n" + missingStarredSelections.join("\n"));
	process.exitCode = 1;
}
