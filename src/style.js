"use strict";

var _        = require("underscore");

exports.register = function (linter) {
	// Check for properties named __proto__. This special property was
	// deprecated and then re-introduced for ES6.

	linter.on("Identifier", function style_scanProto(data) {
		if (linter.getOption("proto")) {
			return;
		}

		if (data.name === "__proto__") {
			linter.warn("W103", {
				line: data.line,
				char: data.char,
				data: [ data.name ]
			});
		}
	});

	// Check for properties named __iterator__. This is a special property
	// available only in browsers with JavaScript 1.7 implementation.

	linter.on("Identifier", function style_scanIterator(data) {
		if (linter.getOption("iterator")) {
			return;
		}

		if (data.name === "__iterator__") {
			linter.warn("W104", {
				line: data.line,
				char: data.char,
				data: [ data.name ]
			});
		}
	});

	// Check for dangling underscores.

	linter.on("Identifier", function style_scanDangling(data) {
		if (!linter.getOption("nomen")) {
			return;
		}

		// Underscore.js
		if (data.name === "_") {
			return;
		}

		// In Node, __dirname and __filename should be ignored.
		if (linter.getOption("node")) {
			if (/^(__dirname|__filename)$/.test(data.name) && !data.isProperty) {
				return;
			}
		}

		if (/^(_+.*|.*_+)$/.test(data.name)) {
			linter.warn("W105", {
				line: data.line,
				char: data.from,
				data: [ "dangling '_'", data.name ]
			});
		}
	});

	// Check that all identifiers are using camelCase notation.
	// Exceptions: names like MY_VAR and _myVar.

	linter.on("Identifier", function style_scanCamelCase(data) {
		if (!linter.getOption("camelcase")) {
			return;
		}

		if (data.name.replace(/^_+/, "").indexOf("_") > -1 && !data.name.match(/^[A-Z0-9_]*$/)) {
			linter.warn("W106", {
				line: data.line,
				char: data.from,
				data: [ data.name ]
			});
		}
	});

	// Enforce consistency in style of quoting.

	linter.on("String", function style_scanQuotes(data) {
		var quotmark = linter.getOption("quotmark");
		var code;

		if (!quotmark) {
			return;
		}

		// If quotmark is set to 'single' warn about all double-quotes.

		if (quotmark === "single" && data.quote !== "'") {
			code = "W109";
		}

		// If quotmark is set to 'double' warn about all single-quotes.

		if (quotmark === "double" && data.quote !== "\"") {
			code = "W108";
		}

		// If quotmark is set to true, remember the first quotation style
		// and then warn about all others.

		if (quotmark === true) {
			if (!linter.getCache("quotmark")) {
				linter.setCache("quotmark", data.quote);
			}

			if (linter.getCache("quotmark") !== data.quote) {
				code = "W110";
			}
		}

		if (code) {
			linter.warn(code, {
				line: data.line,
				char: data.char,
			});
		}
	});

	linter.on("Number", function style_scanNumbers(data) {
		if (data.value.charAt(0) === ".") {
			// Warn about a leading decimal point.
			linter.warn("W008", {
				line: data.line,
				char: data.char,
				data: [ data.value ]
			});
		}

		if (data.value.substr(data.value.length - 1) === ".") {
			// Warn about a trailing decimal point.
			linter.warn("W047", {
				line: data.line,
				char: data.char,
				data: [ data.value ]
			});
		}

		if (/^00+/.test(data.value)) {
			// Multiple leading zeroes.
			linter.warn("W046", {
				line: data.line,
				char: data.char,
				data: [ data.value ]
			});
		}
	});

	// Warn about script URLs.

	linter.on("String", function style_scanJavaScriptURLs(data) {
		var re = /^(?:javascript|jscript|ecmascript|vbscript|mocha|livescript)\s*:/i;

		if (linter.getOption("scripturl")) {
			return;
		}

		if (re.test(data.value)) {
			linter.warn("W107", {
				line: data.line,
				char: data.char
			});
		}
	});

	//number of commented lines since last valid var declaration
	var commentLns = 0,
		lastValidVarDecLn = 0,
		funcDecStack = [],
		//for paren/brace/curly brace matching
		puncStack = [],
		validVarDecLns = [],
		lastNonCommentOrNonFunc,
		lastToken;
	//store last punctuation on most recent valid var declaration line
	var lastValidLnPunc = {
		name : "",
		type : "",
	};

	// Warn about variables not being declared at top of declaring scope
	linter.on("Keyword Punctuator Comment", function style_scanVarTop(data) {
		if (!linter.getOption("vartop"))
			return;

		var lastFunc = funcDecStack.pop();
		if (typeof lastFunc !== "undefined")
			funcDecStack.push(lastFunc);
		//update opening/closing punctuator stack. Useful for determining the end
		//of a multi-line variable initialization.
		var openPuncs  = [ "(", "{", "[" ];
		var closePuncs = [ ")", "}", "]" ];
		if (data.type === "(punctuator)" && _.contains(openPuncs.concat(closePuncs), data.name)) {
			//assumption: there are no open/close punctuator mismatches
			//core jshint should already have detected these as errors
			if (_.contains(openPuncs, data.name))
				puncStack.push(data);
			else {
				var tok = puncStack.pop();
				if (_.contains(validVarDecLns, tok.line)) {
					//this is the closing punctuation of a multi-line var declar.
					lastValidVarDecLn = data.line;
					lastNonCommentOrNonFunc = undefined;
					commentLns = 0;
					//for function declarations which are assigned to a var
					if (typeof lastFunc !== "undefined" && lastFunc.line === tok.line)
						funcDecStack.pop();
				}
				else {
					if (tok.name === "{") {
						if (typeof lastFunc === "undefined") {
							lastValidVarDecLn = data.line;  //for multi-line var dec
							lastNonCommentOrNonFunc = undefined;
							commentLns = 0;
						}
						else if (lastFunc.line !== tok.line) {
							lastValidVarDecLn = data.line;
							lastNonCommentOrNonFunc = undefined;
							commentLns = 0;
						}
						else
							funcDecStack.pop();
					}
				}
			}
		}

		//Maintain line # of last valid (top of declaring scope) var declaration.
		if (data.name === "function") {
			commentLns = 0;
			funcDecStack.push(data);
			lastFunc = data;
			lastNonCommentOrNonFunc = undefined;
		}
		else if (data.type === "(comment)")
			commentLns += data.name.split("\n").length;
		else if (data.line === lastValidVarDecLn + commentLns + 1 ||
			(typeof lastFunc !== "undefined" && data.line === lastFunc.line + commentLns + 1)) {
			if (data.name === "var")
				lastValidVarDecLn = data.line;
			if (data.name === "," && lastValidLnPunc.name === "," && data.line !== lastValidLnPunc.line)
				lastValidVarDecLn++;
			if (data.name === ";" && lastValidLnPunc.name === ",")
				lastValidVarDecLn++;

			lastValidVarDecLn += commentLns;
			commentLns = 0;
			lastNonCommentOrNonFunc = undefined;
		}
		else {
			if (data.name === "var") {
				//check to see if current var is after a multi-line
				//var initialization. If the negation is true, var
				//declaration must not be at the top of dec scope
				if (lastToken.line !== lastValidVarDecLn + commentLns &&
					typeof lastNonCommentOrNonFunc !== "undefined") {
					if (typeof lastFunc === "undefined" || 
						lastToken.line !== lastFunc.line + commentLns) {
						linter.warn("W121", {
							line: data.line,
							char: data.char
						});
					}
				}
				else {
					lastValidVarDecLn = data.line;
					commentLns = 0;
					lastNonCommentOrNonFunc = undefined;
				}
			}
		}

		if (!_.contains(validVarDecLns, lastValidVarDecLn) && 
			(typeof lastFunc === "undefined" || lastFunc.line !== data.line)) {
			validVarDecLns.push(lastValidVarDecLn);
		} 

		lastValidLnPunc = (data.type === "(punctuator)" && lastValidVarDecLn ===
			data.line) ? data : lastValidLnPunc;
		lastToken = data;
		if (lastToken.type !== "(comment)" && lastToken.name !== "function") {
			if (lastToken.line !== lastValidVarDecLn && typeof lastFunc !== "undefined" &&
			lastToken.line !== lastFunc.line) {
				lastNonCommentOrNonFunc = lastToken;
			}
		}
	});
};
