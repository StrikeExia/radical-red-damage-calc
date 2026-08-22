/* eslint-disable */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(
      require("./save_constants/radical_red_constants.js"),
      require("./save_constants/radical_red_randomizer_constants.js"),
      require("./save_constants/radical_red_dex_ability_constants.js"),
      require("./save_constants/radical_red_item_constants.js"),
      require("./save_constants/radical_red_growth_rate_constants.js")
    );
    return;
  }

  var api = factory(
    root.radicalRedSaveConstants || null,
    root.radicalRedRandomizerConstants || null,
    root.radicalRedDexAbilityConstants || null,
    root.radicalRedItemConstants || null,
    root.radicalRedGrowthRateConstants || null
  );
  root.radicalRedSaveReader = api;
  root.parseRadicalRedSaveFile = api.parseRadicalRedSaveFile;
})(typeof globalThis !== "undefined" ? globalThis : this, function (constants, randomizerConstants, dexAbilityConstants, itemConstants, growthRateConstants) {
  "use strict";

  if (!constants) {
    throw new Error("Radical Red save constants are required.");
  }
  if (!randomizerConstants) {
    throw new Error("Radical Red randomizer constants are required.");
  }
  if (!dexAbilityConstants) {
    throw new Error("Radical Red dex ability constants are required.");
  }
  if (!itemConstants) {
    throw new Error("Radical Red item constants are required.");
  }
  if (!growthRateConstants) {
    throw new Error("Radical Red growth-rate constants are required.");
  }

  var RR_SAVE_BLOCK_SIZE = 0xE000;
  var RR_CORE_SAVE_SIZE = 131072;
  var RR_MGBA_RTC_SAVE_SIZE = RR_CORE_SAVE_SIZE + 16;
  var RR_ACTIVE_SLOT_SIZE = 57344;
  var RR_SAVE_INDEX_A_OFFSET = 0x0FFC;
  var RR_SAVE_INDEX_B_OFFSET = RR_SAVE_BLOCK_SIZE + RR_SAVE_INDEX_A_OFFSET;
  var RR_MAGIC_A = 0x02;
  var RR_MAGIC_B = 0x02;
  var RR_PARTY_STRUCT_SIZE = 100;
  var RR_BOX_STRUCT_SIZE = 58;
  var RR_PARTY_DATA_LENGTH = 600;
  var RR_BOX_COUNT = 9;
  var RR_BOX_DATA_LENGTH = 4096;
  var RR_PARTY_OFFSET_BASE = 4096 + 0x38;
  var RR_BOX_OFFSET_BASE = 20480 + 4;
  var RR_MAX_LEVEL = 100;

  var RR_FIND_SECTOR_LIMIT = 0x1C000;
  var RR_SECTOR_SIZE = 0x1000;
  var RR_TRAINER_ID_OFFSET = 0x00A;
  var RR_HARDMODE_BITFLAG = 0xDB2;
  var RR_RESTRICTED_BITFLAG = 0xDC3;
  var RR_SCALED_SPECIES_BITFLAG = 0xF2B;
  var RR_RANDOMIZATION_BITFLAG = 0xF2C;

  var rrMons = constants.mons || [];
  // Radical Red 4.1 uses this internal slot for the Fairy Arceus forme.
  // Older tables left it as an unused species, which also caused the old
  // mixed party/PC scanner to lose synchronization after encountering it.
  rrMons[834] = "Arceus-Fairy";
  var rrMoves = constants.moves || [];
  var rrAbilitiesBySpecies = constants.abilitiesBySpecies || {};
  var rrNormalAbilityPool = randomizerConstants.normalAbilityPool || [];
  var rrRestrictedAbilityPool = randomizerConstants.restrictedAbilityPool || [];
  var rrAbilityIdsBySpeciesId = dexAbilityConstants.abilityIdsBySpeciesId || [];
  var rrItems = itemConstants.items || [];
  var rrGrowthRatesBySpeciesId = growthRateConstants.growthRatesBySpeciesId || [];
  // Radical Red 4.1 changes several experience curves from their canonical
  // values. These overrides were verified against the patched ROM's species
  // table; without them, valid boxed Pokémon can resolve to the wrong level.
  var RR_41_GROWTH_RATE_OVERRIDES = {
    482: 4, // Mismagius
    494: 0, // Chatot
    776: 3, // Pyroar
    831: 3, // Pyroar
    835: 4, // Varoom
    836: 4, // Revavroom
    840: 0, // Tinkatink
    841: 0, // Tinkatuff
    842: 0, // Tinkaton
    843: 5, // Pawmi
    844: 5, // Pawmo
    845: 5, // Pawmot
    850: 0, // Gimmighoul
    851: 0, // Gimmighoul-Roaming
    852: 0, // Gholdengo
    859: 5, // Greavard
    860: 5, // Houndstone
    861: 5, // Tadbulb
    862: 5, // Bellibolt
    863: 4, // Finizen
    864: 4, // Palafin
    865: 4, // Palafin-Hero
    934: 0, // Ceruledge
    935: 0, // Armarouge
    938: 0, // Charcadet
    990: 5, // Silvally
    994: 4, // Togedemaru
    996: 3, // Bruxish
    1101: 0, // Cyclizar
    1186: 4, // Lokix-Sevii
    1198: 5, // Toedscool
    1199: 5, // Toedscruel
    1200: 4, // Nymble-Sevii
    1230: 0, // Iron Thorns
    1231: 0, // Iron Bundle
    1232: 0, // Iron Valiant
    1237: 0, // Great Tusk
    1243: 0, // Brute Bonnet
    1244: 0, // Sandy Shocks
    1245: 0, // Scream Tail
    1246: 0, // Flutter Mane
    1247: 0, // Iron Moth
    1255: 0, // Slither Wing
    1257: 0, // Roaring Moon
    1258: 0, // Iron Treads
    1262: 0, // Iron Hands
    1263: 0, // Iron Jugulis
    1314: 4, // Tarountula
    1315: 4, // Spidops
    1316: 4, // Nymble
    1317: 4, // Lokix
    1318: 0, // Rellor
    1319: 0, // Rabsca
    1320: 0, // Flittle
    1321: 0, // Espathra
    1322: 2, // Dondozo
    1323: 2, // Veluza
    1327: 3, // Capsakid
    1328: 3, // Scovillain
    1332: 0, // Cetoddle
    1333: 0, // Cetitan
    1334: 0, // Tatsugiri
    1335: 5, // Wattrel
    1336: 5, // Kilowattrel
    1338: 5, // Squawkabilly
    1339: 5, // Flamigo
    1343: 0, // Glimmet
    1344: 0, // Glimmora
    1345: 0, // Shroodle
    1346: 0, // Grafaiai
    1347: 4, // Fidough
    1348: 4, // Dachsbun
    1349: 4, // Maschiff
    1350: 4, // Mabosstiff
    1355: 5, // Squawkabilly-White
    1357: 0, // Ogerpon
    1358: 0, // Ogerpon-Wellspring
    1359: 0, // Ogerpon-Hearthflame
    1360: 0, // Ogerpon-Cornerstone
    1364: 0, // Fezandipiti
    1365: 0, // Munkidori
    1366: 0, // Okidogi
  };
  Object.keys(RR_41_GROWTH_RATE_OVERRIDES).forEach(function (speciesId) {
    rrGrowthRatesBySpeciesId[speciesId] = RR_41_GROWTH_RATE_OVERRIDES[speciesId];
  });
  var rrAbilityIdNameMapCache = null;
  var rrAbilityNameIdMapCache = null;
  var rrWatchTimer = null;
  var rrWatchHandle = null;
  var rrLastWatchedSignature = null;
  var RR_ABILITY_DISPLAY_NAME_ALIASES = {
    "As One (Glastrier)": "As One",
    "As One (Spectrier)": "As One"
  };
  var RR_ABILITY_NAME_ALIASES = {
    airlock: "cloudnine",
    asoneglastrier: "asone",
    asonespectrier: "asone",
    clearbody: "clearbody",
    dazzling: "dazzling",
    emergencyexit: "emergencyexit",
    gooey: "gooey",
    grimneigh: "moxie",
    hugepower: "hugepower",
    insomnia: "insomnia",
    ironbarbs: "roughskin",
    libero: "protean",
    moldbreaker: "moldbreaker",
    powerofalchemy: "receiver",
    propellertail: "stalwart",
    propellortail: "stalwart",
    protean: "protean",
    purepower: "hugepower",
    queenlymajesty: "dazzling",
    receiver: "receiver",
    roughskin: "roughskin",
    solidrock: "filter",
    stalwart: "stalwart",
    tanglinghair: "gooey",
    teravolt: "moldbreaker",
    turboblaze: "moldbreaker",
    vitalspirit: "insomnia",
    whitesmoke: "clearbody",
    wimpout: "emergencyexit"
  };
  var rrNatures = [
    "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
    "Bold", "Docile", "Relaxed", "Impish", "Lax",
    "Timid", "Hasty", "Serious", "Jolly", "Naive",
    "Modest", "Mild", "Quiet", "Bashful", "Rash",
    "Calm", "Gentle", "Sassy", "Careful", "Quirky"
  ];

  function rrReadU8(bytes, offset) {
    return bytes[offset] >>> 0;
  }

  function rrReadU16LE(bytes, offset) {
    return ((bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8)) >>> 0;
  }

  function rrReadU32LE(bytes, offset) {
    return (((bytes[offset] || 0))
      | ((bytes[offset + 1] || 0) << 8)
      | ((bytes[offset + 2] || 0) << 16)
      | ((bytes[offset + 3] || 0) << 24)) >>> 0;
  }

  function rrGetGlobalValue(name) {
    if (typeof globalThis !== "undefined" && typeof globalThis[name] !== "undefined") {
      return globalThis[name];
    }
    if (typeof window !== "undefined" && typeof window[name] !== "undefined") {
      return window[name];
    }
    return undefined;
  }

  function rrGetLearnsets(options) {
    if (options && options.learnsets) {
      return options.learnsets;
    }
    return rrGetGlobalValue("learnsets");
  }

  function rrGetExpTables(options) {
    if (options && options.expTables) {
      return options.expTables;
    }
    return rrGetGlobalValue("expTables");
  }

  function rrGetLevelFunction(options) {
    if (options && typeof options.getLevelFn === "function") {
      return options.getLevelFn;
    }
    var getLevelFn = rrGetGlobalValue("get_level");
    return typeof getLevelFn === "function" ? getLevelFn : null;
  }

  function rrLocalStorageFlag(key) {
    if (typeof localStorage === "undefined") {
      return false;
    }
    try {
      return localStorage.getItem(key) === "1";
    } catch (_err) {
      return false;
    }
  }

  function rrRandomizedAbilitiesEnabled(options, saveInfo) {
    if (saveInfo && saveInfo.randomAbilities) {
      return true;
    }
    if (options && typeof options.randomizedAbilitiesEnabled === "boolean") {
      return options.randomizedAbilitiesEnabled;
    }
    return rrLocalStorageFlag("randomized");
  }

  function rrNormalizeLookupCandidates(name) {
    if (!name) {
      return [];
    }

    var candidates = [String(name)];
    candidates.push(candidates[0].replace(/'/g, "\u2019"));
    candidates.push(candidates[0].replace(/\u2019/g, "'"));

    if (candidates[0].indexOf("-") >= 0) {
      candidates.push(candidates[0].split("-").slice(0, 2).join("-"));
      candidates.push(candidates[0].split("-")[0]);
    }

    var seen = Object.create(null);
    return candidates.filter(function (candidate) {
      if (!candidate || seen[candidate]) {
        return false;
      }
      seen[candidate] = true;
      return true;
    });
  }

  function rrGetAbilityList(speciesName) {
    var candidates = rrNormalizeLookupCandidates(speciesName);
    for (var i = 0; i < candidates.length; i++) {
      var abilityList = rrAbilitiesBySpecies[candidates[i]];
      if (Array.isArray(abilityList) && abilityList.length) {
        return abilityList;
      }
    }
    return [];
  }

  function rrGetAbilityIdsForSpeciesId(speciesId) {
    var abilityIds = rrAbilityIdsBySpeciesId[speciesId];
    return Array.isArray(abilityIds) ? abilityIds : [];
  }

  function rrNormalizeAbilityNameKey(abilityName) {
    if (!abilityName) {
      return "";
    }

    var normalized = String(abilityName)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();

    return RR_ABILITY_NAME_ALIASES[normalized] || normalized;
  }

  function rrBuildAbilityNameMaps() {
    if (rrAbilityIdNameMapCache && rrAbilityNameIdMapCache) {
      return {
        idToName: rrAbilityIdNameMapCache,
        nameToId: rrAbilityNameIdMapCache
      };
    }

    var candidatesById = Object.create(null);
    var frequenciesById = Object.create(null);
    var speciesCount = Math.min(rrMons.length, rrAbilityIdsBySpeciesId.length);

    for (var speciesId = 1; speciesId < speciesCount; speciesId++) {
      var speciesName = rrMons[speciesId];
      if (!rrIsValidSpeciesName(speciesName)) {
        continue;
      }

      var abilityNames = rrGetAbilityList(speciesName).filter(function (abilityName) {
        return Boolean(abilityName && abilityName !== "None");
      });
      var abilityIds = rrGetAbilityIdsForSpeciesId(speciesId).filter(function (abilityId) {
        return Boolean(abilityId);
      });

      if (!abilityNames.length || !abilityIds.length) {
        continue;
      }

      var uniqueNames = Array.from(new Set(abilityNames));
      var uniqueIds = Array.from(new Set(abilityIds));

      for (var idIndex = 0; idIndex < uniqueIds.length; idIndex++) {
        var abilityId = uniqueIds[idIndex];
        if (!candidatesById[abilityId]) {
          candidatesById[abilityId] = new Set(uniqueNames);
        } else {
          candidatesById[abilityId] = new Set(uniqueNames.filter(function (name) {
            return candidatesById[abilityId].has(name);
          }));
        }

        if (!frequenciesById[abilityId]) {
          frequenciesById[abilityId] = Object.create(null);
        }
        for (var nameIndex = 0; nameIndex < uniqueNames.length; nameIndex++) {
          var abilityName = uniqueNames[nameIndex];
          frequenciesById[abilityId][abilityName] = (frequenciesById[abilityId][abilityName] || 0) + 1;
        }
      }
    }

    var idToName = Object.create(null);
    var nameToId = Object.create(null);

    var unresolved = Object.keys(candidatesById).map(function (id) {
      return Number(id);
    });
    var keepResolving = true;

    while (keepResolving) {
      keepResolving = false;
      for (var unresolvedIndex = 0; unresolvedIndex < unresolved.length; unresolvedIndex++) {
        var unresolvedId = unresolved[unresolvedIndex];
        if (idToName[unresolvedId]) {
          continue;
        }

        var candidateSet = candidatesById[unresolvedId];
        if (!candidateSet || candidateSet.size !== 1) {
          continue;
        }

        var onlyName = Array.from(candidateSet)[0];
        if (nameToId[onlyName] && nameToId[onlyName] !== unresolvedId) {
          continue;
        }

        idToName[unresolvedId] = onlyName;
        nameToId[onlyName] = unresolvedId;
        keepResolving = true;

        for (var otherIndex = 0; otherIndex < unresolved.length; otherIndex++) {
          var otherId = unresolved[otherIndex];
          if (otherId !== unresolvedId && candidatesById[otherId]) {
            candidatesById[otherId].delete(onlyName);
          }
        }
      }
    }

    for (var frequencyIdText in frequenciesById) {
      if (!Object.prototype.hasOwnProperty.call(frequenciesById, frequencyIdText)) {
        continue;
      }

      var frequencyId = Number(frequencyIdText);
      if (idToName[frequencyId]) {
        continue;
      }

      var entries = Object.entries(frequenciesById[frequencyId]).sort(function (left, right) {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      });

      for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
        var candidateName = entries[entryIndex][0];
        if (nameToId[candidateName] && nameToId[candidateName] !== frequencyId) {
          continue;
        }
        idToName[frequencyId] = candidateName;
        nameToId[candidateName] = frequencyId;
        break;
      }
    }

    rrAbilityIdNameMapCache = idToName;
    rrAbilityNameIdMapCache = nameToId;
    return {
      idToName: idToName,
      nameToId: nameToId
    };
  }

  function rrResolveAbilityNameById(abilityId) {
    if (!abilityId) {
      return null;
    }
    var maps = rrBuildAbilityNameMaps();
    var resolvedName = maps.idToName[abilityId] || null;
    return RR_ABILITY_DISPLAY_NAME_ALIASES[resolvedName] || resolvedName;
  }

  function rrResolveAbilityIdByName(abilityName) {
    if (!abilityName) {
      return -1;
    }
    var maps = rrBuildAbilityNameMaps();
    if (Number.isFinite(maps.nameToId[abilityName])) {
      return maps.nameToId[abilityName];
    }

    var targetKey = rrNormalizeAbilityNameKey(abilityName);
    var knownNames = Object.keys(maps.nameToId);
    for (var i = 0; i < knownNames.length; i++) {
      if (rrNormalizeAbilityNameKey(knownNames[i]) === targetKey) {
        return maps.nameToId[knownNames[i]];
      }
    }
    return -1;
  }

  function rrResolveBaseAbilityName(speciesName, abilitySlot) {
    var abilityList = rrGetAbilityList(speciesName);
    if (!abilityList.length) {
      return null;
    }

    var slot = Number.isInteger(abilitySlot) ? abilitySlot : 0;
    if (!abilityList[slot] || abilityList[slot] === "None") {
      slot = 0;
    }
    return abilityList[slot] || abilityList[0] || null;
  }

  function rrResolveBaseAbilityId(speciesName, speciesId, abilitySlot) {
    var baseAbilityName = rrResolveBaseAbilityName(speciesName, abilitySlot);
    var abilityIds = rrGetAbilityIdsForSpeciesId(speciesId);
    var slot = Number.isInteger(abilitySlot) ? abilitySlot : 0;

    if (abilityIds.length) {
      var targetKey = rrNormalizeAbilityNameKey(baseAbilityName);
      if (targetKey) {
        for (var abilityIndex = 0; abilityIndex < abilityIds.length; abilityIndex++) {
          var candidateAbilityId = abilityIds[abilityIndex] || 0;
          if (!candidateAbilityId) {
            continue;
          }

          if (rrNormalizeAbilityNameKey(rrResolveAbilityNameById(candidateAbilityId)) === targetKey) {
            return candidateAbilityId;
          }
        }
      }

      var slotAbilityId = abilityIds[slot] || 0;
      if (slotAbilityId) {
        return slotAbilityId;
      }

      for (var fallbackIndex = 0; fallbackIndex < abilityIds.length; fallbackIndex++) {
        if (abilityIds[fallbackIndex]) {
          return abilityIds[fallbackIndex];
        }
      }
    }

    return rrResolveAbilityIdByName(baseAbilityName);
  }

  function rrResolveFallbackAbilitySlot(monStruct, hiddenAbilityOffset) {
    var abilitySlot = ((rrReadU32LE(monStruct, 0) & 0x1) === 0) ? 0 : 1;
    if (rrReadU8(monStruct, hiddenAbilityOffset) === 191) {
      abilitySlot = 2;
    }
    return abilitySlot;
  }

  function rrResolvePartyAbilitySlot(monStruct) {
    if ((rrReadU32LE(monStruct, 72) & 0x80000000) !== 0) {
      return 2;
    }
    return rrResolveFallbackAbilitySlot(monStruct, 74);
  }

  function rrResolveBoxAbilitySlot(monStruct) {
    if ((rrReadU32LE(monStruct, 54) & 0x80000000) !== 0) {
      return 2;
    }
    return rrResolveFallbackAbilitySlot(monStruct, 57);
  }

  function rrRandomizeAbilityId(trainerIdSecret, restricted, abilityId, speciesId) {
    if (!abilityId) {
      return 0;
    }

    var trainerId = Math.max(1, Number(trainerIdSecret) || 0) >>> 0;
    var pool = restricted ? rrRestrictedAbilityPool : rrNormalAbilityPool;
    if (!pool.length) {
      return abilityId >>> 0;
    }

    var abilityCount = pool.length;
    var secretIdLowerByte = (((trainerId >>> 16) & 0xFFFF) % 0xFF) >>> 0;
    var newAbilityIndex = ((trainerId & 0xFFFF) % abilityCount) >>> 0;
    newAbilityIndex = (newAbilityIndex + (speciesId >>> 0) + (abilityId >>> 0)) & 0xFFFF;
    if (newAbilityIndex > abilityCount) {
      newAbilityIndex = (newAbilityIndex - abilityCount + 2) & 0xFFFF;
    }
    newAbilityIndex = (newAbilityIndex ^ (secretIdLowerByte & 0xFFFF)) % abilityCount;
    return pool[newAbilityIndex] >>> 0;
  }

  function rrResolveAbilityName(speciesName, speciesId, abilitySlot, saveInfo, options) {
    var baseAbilityName = rrResolveBaseAbilityName(speciesName, abilitySlot);
    if (!baseAbilityName) {
      return "Unknown";
    }

    if (!rrRandomizedAbilitiesEnabled(options, saveInfo) || !saveInfo || !saveInfo.randomAbilities) {
      return baseAbilityName;
    }

    var baseAbilityId = rrResolveBaseAbilityId(speciesName, speciesId, abilitySlot);
    if (baseAbilityId < 1) {
      return baseAbilityName;
    }

    var randomizedAbilityId = rrRandomizeAbilityId(
      saveInfo.trainerIdSecret,
      saveInfo.restricted,
      baseAbilityId,
      speciesId
    );
    return rrResolveAbilityNameById(randomizedAbilityId) || baseAbilityName;
  }

  function rrResolveGrowthRate(speciesName, options) {
    var learnsets = rrGetLearnsets(options);
    if (!learnsets || !speciesName) {
      return null;
    }

    var candidates = rrNormalizeLookupCandidates(speciesName).map(function (candidate) {
      return candidate.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    });

    for (var i = 0; i < candidates.length; i++) {
      var learnset = learnsets[candidates[i]];
      if (learnset && Number.isFinite(learnset.gr)) {
        return learnset.gr;
      }
    }
    return null;
  }

  function rrResolveLevelFromExpTable(expTable, exp, getLevelFn) {
    if (!Array.isArray(expTable) || typeof getLevelFn !== "function") {
      return null;
    }
    try {
      var level = getLevelFn(expTable, exp);
      return (level >= 1 && level <= RR_MAX_LEVEL) ? level : null;
    } catch (_err) {
      return null;
    }
  }

  function rrNormalizeLevel(level) {
    var normalized = parseInt(level, 10);
    return (Number.isFinite(normalized) && normalized >= 1 && normalized <= RR_MAX_LEVEL)
      ? normalized
      : null;
  }

  function rrResolveLevelCap(fallbackLevel, options) {
    if (options && typeof options.levelCap !== "undefined") {
      var optionCap = rrNormalizeLevel(options.levelCap);
      if (optionCap) {
        return optionCap;
      }
    }

    var getActiveLevelCap = rrGetGlobalValue("getActiveLevelCap");
    if (typeof getActiveLevelCap === "function") {
      var activeCap = rrNormalizeLevel(getActiveLevelCap(fallbackLevel));
      if (activeCap) {
        return activeCap;
      }
    }

    var globalCap = rrNormalizeLevel(rrGetGlobalValue("lvlCap"));
    if (globalCap) {
      return globalCap;
    }

    if (typeof document !== "undefined") {
      var levelCapInput = document.getElementById("lvl-cap");
      if (levelCapInput) {
        var inputCap = rrNormalizeLevel(levelCapInput.value);
        if (inputCap) {
          return inputCap;
        }
      }
    }

    if (typeof localStorage !== "undefined") {
      var storageCap = rrNormalizeLevel(localStorage.lvlCap);
      if (storageCap) {
        return storageCap;
      }
    }

    return rrNormalizeLevel(fallbackLevel);
  }

  function rrExperienceForLevel(growthRate, level) {
    var cube = level * level * level;

    switch (growthRate) {
    case 0: // Medium Fast
      return cube;
    case 1: // Erratic
      if (level <= 50) return Math.floor(cube * (100 - level) / 50);
      if (level <= 68) return Math.floor(cube * (150 - level) / 100);
      if (level <= 98) return Math.floor(cube * Math.floor((1911 - (10 * level)) / 3) / 500);
      return Math.floor(cube * (160 - level) / 100);
    case 2: // Fluctuating
      if (level <= 15) return Math.floor(cube * (Math.floor((level + 1) / 3) + 24) / 50);
      if (level <= 35) return Math.floor(cube * (level + 14) / 50);
      return Math.floor(cube * (Math.floor(level / 2) + 32) / 50);
    case 3: // Medium Slow
      return Math.floor(((6 * cube) / 5) - (15 * level * level) + (100 * level) - 140);
    case 4: // Fast
      return Math.floor(4 * cube / 5);
    case 5: // Slow
      return Math.floor(5 * cube / 4);
    default:
      return null;
    }
  }

  function rrResolveLevel(speciesId, exp, fallbackLevel) {
    var growthRate = rrGrowthRatesBySpeciesId[speciesId];
    if (Number.isInteger(growthRate)) {
      for (var level = RR_MAX_LEVEL; level >= 1; level--) {
        if (exp >= rrExperienceForLevel(growthRate, level)) {
          return level;
        }
      }
    }

    return rrNormalizeLevel(fallbackLevel) || RR_MAX_LEVEL;
  }

  function rrDecodePackedMoveIds(packedBytes) {
    if (!packedBytes || packedBytes.length < 5) {
      return [];
    }

    var moveIds = [];
    for (var moveIndex = 0; moveIndex < 4; moveIndex++) {
      var moveId = 0;
      for (var bit = 0; bit < 10; bit++) {
        var absoluteBit = (moveIndex * 10) + bit;
        var byteIndex = Math.floor(absoluteBit / 8);
        var bitIndex = absoluteBit % 8;
        moveId |= (((packedBytes[byteIndex] >>> bitIndex) & 0x1) << bit);
      }
      moveIds.push(moveId >>> 0);
    }
    return moveIds;
  }

  function rrMapMoveIdsToNames(moveIds) {
    return moveIds.map(function (moveId) {
      return rrMoves[moveId] || null;
    });
  }

  function rrResolveItemName(itemId) {
    if (!itemId) {
      return null;
    }

    var itemName = rrItems[itemId];
    if (!itemName) {
      return null;
    }

    itemName = String(itemName).trim();
    if (!itemName || itemName === "None" || /^Free Space/i.test(itemName)) {
      return null;
    }

    return itemName;
  }

  function rrIsValidSpeciesName(speciesName) {
    return Boolean(speciesName && speciesName !== "-----" && speciesName !== "None");
  }

  function rrResolveJellicentGender(speciesId, pid) {
    if (speciesId === 705) {
      return "F";
    }
    return ((pid >>> 0) & 0xFF) < 127 ? "F" : "M";
  }

  function rrResolveGenderedSpeciesName(speciesName, speciesId, pid) {
    if (speciesName === "Jellicent" && rrResolveJellicentGender(speciesId, pid) === "F") {
      return "Jellicent-F";
    }
    return speciesName;
  }

  function rrResolveGender(speciesName, pid) {
    if (/-F$/.test(speciesName) || speciesName === "Nidoran-F") {
      return "F";
    }
    if (/-M$/.test(speciesName) || speciesName === "Nidoran-M") {
      return "M";
    }

    // Gen III stores gender in the personality value rather than a separate
    // field. These ordinary gendered species use the standard 50/50 threshold.
    // The calculator's species metadata continues to hide genderless species.
    return ((pid >>> 0) & 0xFF) < 127 ? "F" : "M";
  }

  function rrWrappedSlice(bytes, start, length) {
    var out = new Uint8Array(length);
    for (var i = 0; i < length; i++) {
      out[i] = bytes[(start + i) % bytes.length] || 0;
    }
    return out;
  }

  function rrResolveActiveLayout(rawBytes) {
    var bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes || 0);
    if (bytes.length < RR_SAVE_INDEX_B_OFFSET + 2) {
      throw new Error("Radical Red save is too small.");
    }

    var saveIndexA = rrReadU16LE(bytes, RR_SAVE_INDEX_A_OFFSET);
    var saveIndexB = rrReadU16LE(bytes, RR_SAVE_INDEX_B_OFFSET);
    var hasValidA = saveIndexA !== 65535;
    var hasValidB = saveIndexB !== 65535;
    var blockOffset = 0;

    if (!hasValidA && hasValidB) {
      blockOffset = RR_SAVE_BLOCK_SIZE;
    } else if (hasValidA && hasValidB && saveIndexB > saveIndexA) {
      blockOffset = RR_SAVE_BLOCK_SIZE;
    }

    var activeSave = bytes.subarray(blockOffset, blockOffset + RR_ACTIVE_SLOT_SIZE);

    var saveIndex = Math.max(saveIndexA, saveIndexB);
    if (saveIndexB === 65535) {
      saveIndex = saveIndexA;
    } else if (saveIndexA === 65535) {
      saveIndex = saveIndexB;
    }

    var adjustment = (saveIndexA + saveIndexB >= 65535) ? 0 : 53248;
    var rotation = saveIndex % 14;
    var totalOffset = ((rotation * 4096) + adjustment) % RR_ACTIVE_SLOT_SIZE;
    var partyOffset = (totalOffset + RR_PARTY_OFFSET_BASE) % RR_ACTIVE_SLOT_SIZE;
    var partyCount = rrReadU8(activeSave, partyOffset - 4);

    if (partyCount === 0) {
      adjustment = 0;
      totalOffset = ((rotation * 4096) + adjustment) % RR_ACTIVE_SLOT_SIZE;
      partyOffset = (totalOffset + RR_PARTY_OFFSET_BASE) % RR_ACTIVE_SLOT_SIZE;
      partyCount = rrReadU8(activeSave, partyOffset - 4);
    }

    var boxOffset = (RR_BOX_OFFSET_BASE + totalOffset) % RR_ACTIVE_SLOT_SIZE;
    var boxData = new Uint8Array(RR_PARTY_DATA_LENGTH + (RR_BOX_COUNT * RR_BOX_DATA_LENGTH));
    boxData.set(rrWrappedSlice(activeSave, partyOffset, RR_PARTY_DATA_LENGTH), 0);
    for (var boxIndex = 0; boxIndex < RR_BOX_COUNT; boxIndex++) {
      var sourceOffset = ((boxIndex * RR_BOX_DATA_LENGTH) + boxOffset) % RR_ACTIVE_SLOT_SIZE;
      boxData.set(
        rrWrappedSlice(activeSave, sourceOffset, RR_BOX_DATA_LENGTH),
        RR_PARTY_DATA_LENGTH + (boxIndex * RR_BOX_DATA_LENGTH)
      );
    }

    return {
      blockOffset: blockOffset,
      saveIndexA: saveIndexA,
      saveIndexB: saveIndexB,
      saveIndex: saveIndex >>> 0,
      rotation: rotation >>> 0,
      adjustment: adjustment >>> 0,
      totalOffset: totalOffset >>> 0,
      partyOffset: partyOffset >>> 0,
      partyCount: partyCount >>> 0,
      boxOffset: boxOffset >>> 0,
      boxData: boxData
    };
  }

  function rrFindSector(bytes, sectorId) {
    var latestOffset = -1;
    var latestSaveIndex = -1;
    var limit = Math.min(bytes.length, RR_FIND_SECTOR_LIMIT);
    for (var offset = 0; offset < limit; offset += RR_SECTOR_SIZE) {
      var currentSectorId = rrReadU16LE(bytes, offset + 0xFF4);
      var currentSaveIndex = rrReadU32LE(bytes, offset + 0xFFC);
      if (currentSectorId === sectorId && currentSaveIndex > latestSaveIndex) {
        latestOffset = offset;
        latestSaveIndex = currentSaveIndex;
      }
    }
    return latestOffset;
  }

  function rrReadRandomizerSaveInfo(rawBytes) {
    var bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes || 0);
    var trainerSector = rrFindSector(bytes, 0);
    var gameSector = rrFindSector(bytes, 4);

    if (trainerSector < 0 || gameSector < 0) {
      return {
        valid: false,
        trainerIdSecret: 0,
        restricted: false,
        hardmode: false,
        scaledSpecies: false,
        normalSpecies: false,
        randomLearnset: false,
        randomAbilities: false
      };
    }

    var randomizationFlags = rrReadU8(bytes, trainerSector + RR_RANDOMIZATION_BITFLAG);
    return {
      valid: true,
      trainerIdSecret: rrReadU32LE(bytes, trainerSector + RR_TRAINER_ID_OFFSET) >>> 0,
      restricted: (rrReadU8(bytes, gameSector + RR_RESTRICTED_BITFLAG) & 0x40) > 0,
      hardmode: (rrReadU8(bytes, gameSector + RR_HARDMODE_BITFLAG) & 0x10) > 0,
      scaledSpecies: (rrReadU8(bytes, trainerSector + RR_SCALED_SPECIES_BITFLAG) & 0x4) > 0,
      normalSpecies: (randomizationFlags & 0x1) > 0,
      randomLearnset: (randomizationFlags & 0x2) > 0,
      randomAbilities: (randomizationFlags & 0x4) > 0
    };
  }

  function rrParsePartyMon(monStruct, slot, saveInfo, options) {
    if (!monStruct || monStruct.length < RR_PARTY_STRUCT_SIZE) {
      return null;
    }

    var speciesId = rrReadU16LE(monStruct, 32);
    var speciesName = rrMons[speciesId];
    if (!rrIsValidSpeciesName(speciesName)) {
      return null;
    }

    var pid = rrReadU32LE(monStruct, 0);
    speciesName = rrResolveGenderedSpeciesName(speciesName, speciesId, pid);
    var abilitySlot = rrResolvePartyAbilitySlot(monStruct);
    var itemId = rrReadU16LE(monStruct, 34);

    var moveIds = [
      rrReadU16LE(monStruct, 44),
      rrReadU16LE(monStruct, 46),
      rrReadU16LE(monStruct, 48),
      rrReadU16LE(monStruct, 50)
    ];
    var moveNames = rrMapMoveIdsToNames(moveIds).filter(function (moveName) {
      return Boolean(moveName && moveName !== "(No Move)");
    });

    return {
      slot: slot,
      isParty: true,
      pid: pid >>> 0,
      speciesId: speciesId >>> 0,
      speciesName: speciesName,
      gender: rrResolveGender(speciesName, pid),
      exp: rrReadU32LE(monStruct, 36) >>> 0,
      level: rrResolveLevel(speciesId, rrReadU32LE(monStruct, 36) >>> 0, rrReadU8(monStruct, 84)),
      natureName: rrNatures[pid % 25] || "Hardy",
      abilitySlot: abilitySlot,
      abilityName: rrResolveAbilityName(speciesName, speciesId, abilitySlot, saveInfo, options),
      itemId: itemId >>> 0,
      itemName: rrResolveItemName(itemId),
      moveIds: moveIds,
      moveNames: moveNames
    };
  }

  function rrParseBoxMon(monStruct, slot, saveInfo, options) {
    if (!monStruct || monStruct.length < RR_BOX_STRUCT_SIZE) {
      return null;
    }

    var speciesId = rrReadU16LE(monStruct, 28);
    var speciesName = rrMons[speciesId];
    if (!rrIsValidSpeciesName(speciesName)) {
      return null;
    }

    var pid = rrReadU32LE(monStruct, 0);
    speciesName = rrResolveGenderedSpeciesName(speciesName, speciesId, pid);
    var abilitySlot = rrResolveBoxAbilitySlot(monStruct);
    var itemId = rrReadU16LE(monStruct, 30);

    var moveIds = rrDecodePackedMoveIds(monStruct.subarray(39, 45));
    var moveNames = rrMapMoveIdsToNames(moveIds).filter(function (moveName) {
      return Boolean(moveName && moveName !== "(No Move)");
    });

    return {
      slot: slot,
      isParty: false,
      pid: pid >>> 0,
      speciesId: speciesId >>> 0,
      speciesName: speciesName,
      gender: rrResolveGender(speciesName, pid),
      exp: rrReadU32LE(monStruct, 32) >>> 0,
      level: rrResolveLevel(speciesId, rrReadU32LE(monStruct, 32) >>> 0, null),
      natureName: rrNatures[pid % 25] || "Hardy",
      abilitySlot: abilitySlot,
      abilityName: rrResolveAbilityName(speciesName, speciesId, abilitySlot, saveInfo, options),
      itemId: itemId >>> 0,
      itemName: rrResolveItemName(itemId),
      moveIds: moveIds,
      moveNames: moveNames
    };
  }

  function rrMonToShowdown(mon) {
    if (!mon) {
      return "";
    }

    var output = [];
    var header = mon.speciesName + (mon.gender ? " (" + mon.gender + ")" : "");
    if (mon.itemName) {
      header += " @ " + mon.itemName;
    }
    output.push(header);
    output.push("Level: " + mon.level);
    output.push(mon.natureName + " Nature");
    output.push("Ability: " + mon.abilityName);
    mon.moveNames.forEach(function (moveName) {
      output.push("- " + moveName);
    });
    output.push("");
    // addSets() scans several rows ahead for each set. Keep a truly blank row
    // between records so the following Level line cannot overwrite this one.
    return output.join("\n") + "\n";
  }

  function rrScanPcData(pcData, saveInfo, options) {
    var parsedBoxes = [];

    for (var offset = 0; offset < pcData.length - 1;) {
      if (pcData[offset] !== RR_MAGIC_A || pcData[offset + 1] !== RR_MAGIC_B) {
        offset += 2;
        continue;
      }

      var structStart = offset - 18;
      if (structStart < 0 || (structStart + RR_BOX_STRUCT_SIZE) > pcData.length) {
        offset += 2;
        continue;
      }

      var monStruct = pcData.subarray(structStart, structStart + RR_BOX_STRUCT_SIZE);
      var mon = rrParseBoxMon(monStruct, parsedBoxes.length + 1, saveInfo, options);
      if (!mon) {
        offset += 2;
        continue;
      }

      parsedBoxes.push(mon);
      offset += RR_BOX_STRUCT_SIZE;
    }

    return parsedBoxes;
  }

  function rrScanBoxData(boxData, partyCount, saveInfo, options) {
    var parsedParty = [];
    var physicalPartyCount = Math.min(partyCount, RR_PARTY_DATA_LENGTH / RR_PARTY_STRUCT_SIZE);

    // Party records occupy fixed 100-byte slots. Advance by physical slot even
    // when a record is invalid, so one bad party record cannot change how PC
    // records are interpreted.
    for (var slot = 0; slot < physicalPartyCount; slot++) {
      var structStart = slot * RR_PARTY_STRUCT_SIZE;
      var monStruct = boxData.subarray(structStart, structStart + RR_PARTY_STRUCT_SIZE);
      var mon = rrParsePartyMon(monStruct, slot + 1, saveInfo, options);
      if (mon) {
        parsedParty.push(mon);
      }
    }

    return {
      parsedParty: parsedParty,
      parsedBoxes: rrScanPcData(boxData.subarray(RR_PARTY_DATA_LENGTH), saveInfo, options)
    };
  }

  function parseRadicalRedSaveFile(arrayBuffer, options) {
    var bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer || 0);
    if (bytes.length !== RR_CORE_SAVE_SIZE && bytes.length !== RR_MGBA_RTC_SAVE_SIZE) {
      throw new Error(
        "Invalid Radical Red save size: expected 131,072 bytes or 131,088 bytes, got " + bytes.length + "."
      );
    }
    // mGBA appends a 16-byte RTC footer. All GBA save offsets are relative to
    // the first 128 KiB, so keep the footer out of sector and layout scans.
    bytes = bytes.subarray(0, RR_CORE_SAVE_SIZE);
    var layout = rrResolveActiveLayout(bytes);
    var saveInfo = rrReadRandomizerSaveInfo(bytes);
    var parsed = rrScanBoxData(layout.boxData, layout.partyCount, saveInfo, options || {});
    var showdownImport = "";

    parsed.parsedParty.forEach(function (mon) {
      showdownImport += rrMonToShowdown(mon);
    });
    parsed.parsedBoxes.forEach(function (mon) {
      showdownImport += rrMonToShowdown(mon);
    });

    return {
      showdownImport: showdownImport,
      parsedParty: parsed.parsedParty,
      parsedBoxes: parsed.parsedBoxes,
      deadMons: [],
      partyCount: layout.partyCount,
      rrSaveInfo: saveInfo,
      layout: {
        blockOffset: layout.blockOffset,
        saveIndexA: layout.saveIndexA,
        saveIndexB: layout.saveIndexB,
        saveIndex: layout.saveIndex,
        rotation: layout.rotation,
        adjustment: layout.adjustment,
        totalOffset: layout.totalOffset,
        partyOffset: layout.partyOffset,
        boxOffset: layout.boxOffset
      }
    };
  }

  function rrGetImportName() {
    var nameInput = document.querySelector(".import-name-text");
    return (nameInput && nameInput.value.trim()) || "Save Import";
  }

  function rrSetWatchStatus(message, state) {
    var status = document.getElementById("rr-save-watch-status");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state || "";
  }

  function rrApplyParsedSave(result, selectedName, silent) {
    if (typeof window !== "undefined") {
      window.saveUploaded = true;
      window.saveFileName = selectedName;
      window.savExt = ((selectedName.split(".").pop()) || "").toLowerCase();
    }

    if (typeof window.jQuery === "function") {
      window.jQuery(".import-team-text").val(result.showdownImport);
    }
    if (typeof addSets !== "function") {
      throw new Error("The calculator's addSets() importer is unavailable.");
    }

    var importName = rrGetImportName();
    var addedSets = addSets(result.showdownImport, importName, { silent: silent });
    if (!addedSets) {
      throw new Error("The save was read, but none of its Pokémon could be imported.");
    }

    if (typeof window.renderRadicalRedSaveRoster === "function") {
      window.renderRadicalRedSaveRoster(result, importName);
    }
    return result;
  }

  function rrReadSaveFile(file, selectedName, silent) {
    return file.arrayBuffer().then(function (arrayBuffer) {
      return rrApplyParsedSave(parseRadicalRedSaveFile(arrayBuffer), selectedName, silent);
    });
  }

  function rrStopWatchingSave(message) {
    if (rrWatchTimer !== null) {
      clearInterval(rrWatchTimer);
      rrWatchTimer = null;
    }
    rrWatchHandle = null;
    rrLastWatchedSignature = null;

    var watchButton = document.getElementById("rr-watch-save");
    if (watchButton) watchButton.textContent = "Auto-update .sav";
    rrSetWatchStatus(message || "Auto-update stopped.", "stopped");
  }

  function rrPollWatchedSave(force) {
    if (!rrWatchHandle) return Promise.resolve();

    return rrWatchHandle.getFile().then(function (file) {
      var signature = file.size + ":" + file.lastModified;
      if (!force && signature === rrLastWatchedSignature) return null;
      rrLastWatchedSignature = signature;
      return rrReadSaveFile(file, file.name || "save.sav", !force).then(function () {
        rrSetWatchStatus("Auto-update is now on, watching for changes…", "watching");
      });
    }).catch(function (error) {
      console.error("Failed to refresh the watched Radical Red save.", error);
      rrStopWatchingSave(error.message || "Auto-update lost access to the save file.");
    });
  }

  function rrStartWatchingSave() {
    if (typeof window.showOpenFilePicker !== "function") {
      alert("Automatic save updates require Chrome or Edge on localhost/HTTPS. Manual .sav import still works here.");
      return;
    }

    window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: "Radical Red save",
        accept: { "application/octet-stream": [".sav", ".srm"] }
      }]
    }).then(function (handles) {
      if (!handles || !handles[0]) return;
      rrStopWatchingSave("");
      rrWatchHandle = handles[0];
      var watchButton = document.getElementById("rr-watch-save");
      if (watchButton) watchButton.textContent = "Stop auto-update";
      return rrPollWatchedSave(true).then(function () {
        if (!rrWatchHandle) return;
        rrWatchTimer = setInterval(function () {
          rrPollWatchedSave(false);
        }, 2000);
      });
    }).catch(function (error) {
      if (error && error.name === "AbortError") return;
      console.error("Unable to watch the Radical Red save.", error);
      rrSetWatchStatus(error.message || "Unable to watch this save file.", "error");
    });
  }

  function rrShouldHandleSaveUpload() {
    return (
      typeof document !== "undefined" &&
      document.title.indexOf("Radical Red") >= 0
    );
  }

  function rrBindSaveUpload() {
    if (typeof document === "undefined" || !rrShouldHandleSaveUpload()) {
      return;
    }

    var readSave = document.getElementById("read-save");
    var saveInput = document.getElementById("save-upload");
    if (!readSave || !saveInput || saveInput.dataset.rrSaveBound === "1") {
      return;
    }

    saveInput.dataset.rrSaveBound = "1";
    var wrapper = document.getElementById("import-1_wrapper");
    var watchButton = document.createElement("button");
    watchButton.type = "button";
    watchButton.id = "rr-watch-save";
    watchButton.className = "bs-btn bs-btn-default";
    watchButton.textContent = "Auto-update .sav";
    watchButton.title = "Choose the emulator save once, then refresh imported sets whenever that file changes.";
    wrapper.appendChild(watchButton);

    var watchStatus = document.createElement("span");
    watchStatus.id = "rr-save-watch-status";
    watchStatus.setAttribute("role", "status");
    watchStatus.setAttribute("aria-live", "polite");
    wrapper.appendChild(watchStatus);

    readSave.addEventListener("click", function () {
      saveInput.value = null;
    });

    watchButton.addEventListener("click", function () {
      if (rrWatchHandle) {
        rrStopWatchingSave();
      } else {
        rrStartWatchingSave();
      }
    });

    saveInput.addEventListener("change", function (event) {
      if (!rrShouldHandleSaveUpload()) {
        return;
      }

      var file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }

      if (rrWatchHandle) rrStopWatchingSave("Switched to manual import.");

      var selectedName = "";
      if (typeof window.jQuery === "function") {
        selectedName = (window.jQuery("#save-upload").val() || "").split("\\").pop();
      }
      if (!selectedName) {
        selectedName = file.name || "save.sav";
      }

      rrReadSaveFile(file, selectedName, false).catch(function (error) {
        console.error("Failed to parse Radical Red save.", error);
        alert(error.message || "Unable to parse this Radical Red save.");
      });
    });
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (typeof window.jQuery === "function") {
      window.jQuery(function () {
        rrBindSaveUpload();
      });
    } else {
      document.addEventListener("DOMContentLoaded", rrBindSaveUpload);
    }
  }

  return {
    parseRadicalRedSaveFile: parseRadicalRedSaveFile,
    __test: {
      decodePackedMoveIds: rrDecodePackedMoveIds,
      randomizeAbilityId: rrRandomizeAbilityId,
      readRandomizerSaveInfo: rrReadRandomizerSaveInfo,
      resolveActiveLayout: rrResolveActiveLayout,
      resolveLevelFromExpTable: rrResolveLevelFromExpTable,
      experienceForLevel: rrExperienceForLevel,
      resolveLevel: rrResolveLevel,
      resolveLevelCap: rrResolveLevelCap,
      resolveAbilityNameById: rrResolveAbilityNameById,
      resolveBaseAbilityId: rrResolveBaseAbilityId,
      resolveGenderedSpeciesName: rrResolveGenderedSpeciesName,
      resolveGender: rrResolveGender,
      resolveItemName: rrResolveItemName,
      randomizedAbilitiesEnabled: rrRandomizedAbilitiesEnabled,
      resolvePartyAbilitySlot: rrResolvePartyAbilitySlot,
      resolveBoxAbilitySlot: rrResolveBoxAbilitySlot,
      parsePartyMon: rrParsePartyMon,
      parseBoxMon: rrParseBoxMon,
      scanBoxData: rrScanBoxData,
      monToShowdown: rrMonToShowdown
    }
  };
});
