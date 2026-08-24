(function () {
	"use strict";

	var CHANGELOG_VERSION = "1.1.0";
	var CHANGELOG_UPDATED_DATE = "August 24, 2026";
	var CHANGELOG_STORAGE_KEY = "radicalRedCalcSeenChangelog";
	var CHANGELOG_ITEMS = [
		"Added a MEGA toggle for Pokemon holding their respective Mega Stones.",
		"Added Minimal Grinding Mode checkbox for Normal and Hardcore trainer sets. This sets all EV's to 0.",
		"Added automatic calculator form changes for Pokemon that have another form when having their respective held item.",
		"Added color coding for Pokemon stats that are increased/decreased by their nature.",
		"Added indicators for when a Pokemon is slower, faster, or speed tied with the opponent Pokemon."
	];

	function getSeenVersion() {
		try {
			return localStorage.getItem(CHANGELOG_STORAGE_KEY);
		} catch (_error) {
			return null;
		}
	}

	function setSeenVersion() {
		try {
			localStorage.setItem(CHANGELOG_STORAGE_KEY, CHANGELOG_VERSION);
		} catch (_error) {}
	}

	function createElement(tagName, className, text) {
		var element = document.createElement(tagName);
		if (className) element.className = className;
		if (text) element.textContent = text;
		return element;
	}

	function showChangelog(forceOpen) {
		if ((!forceOpen && getSeenVersion() === CHANGELOG_VERSION) ||
			document.querySelector(".changelog-modal")) return;

		var previouslyFocused = document.activeElement;
		var overlay = createElement("div", "changelog-modal");
		var card = createElement("section", "changelog-card");
		var headingId = "changelog-heading";
		var descriptionId = "changelog-description";
		card.setAttribute("role", "dialog");
		card.setAttribute("aria-modal", "true");
		card.setAttribute("aria-labelledby", headingId);
		card.setAttribute("aria-describedby", descriptionId);

		var closeButton = createElement("button", "changelog-close", "×");
		closeButton.type = "button";
		closeButton.setAttribute("aria-label", "Close changelog");
		card.appendChild(closeButton);

		var heading = createElement("h2", "changelog-heading", "Calculator Update");
		heading.id = headingId;
		card.appendChild(heading);
		var description = createElement("p", "changelog-description", "Here’s what changed in the most recent update:");
		description.id = descriptionId;
		card.appendChild(description);

		var list = createElement("ul", "changelog-list");
		CHANGELOG_ITEMS.forEach(function (item) {
			list.appendChild(createElement("li", "", item));
		});
		card.appendChild(list);

		var footer = createElement("div", "changelog-footer");
		footer.appendChild(createElement("span", "changelog-version",
			"Version " + CHANGELOG_VERSION + " · Updated " + CHANGELOG_UPDATED_DATE));
		var dismissButton = createElement("button", "changelog-dismiss", "Close");
		dismissButton.type = "button";
		footer.appendChild(dismissButton);
		card.appendChild(footer);
		overlay.appendChild(card);
		document.body.appendChild(overlay);
		document.body.classList.add("changelog-open");

		function dismiss() {
			setSeenVersion();
			document.body.classList.remove("changelog-open");
			overlay.parentNode.removeChild(overlay);
			document.removeEventListener("keydown", handleKeydown);
			if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
		}

		function handleKeydown(event) {
			if (event.key === "Escape") dismiss();
		}

		closeButton.addEventListener("click", dismiss);
		dismissButton.addEventListener("click", dismiss);
		overlay.addEventListener("click", function (event) {
			if (event.target === overlay) dismiss();
		});
		document.addEventListener("keydown", handleKeydown);
		dismissButton.focus();
	}

	function initializeChangelog() {
		var trigger = document.querySelector(".changelog-trigger");
		if (trigger) trigger.addEventListener("click", function () { showChangelog(true); });
		showChangelog(false);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeChangelog);
	} else {
		initializeChangelog();
	}
})();
