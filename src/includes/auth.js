var config = require("../config/config.json");
var useAuth = (config && config.require_auth);

/**
 * This file sets up the auth middleware that can be used to authenticate routes.
 *
 * If the config `require_auth` is set to `true` then we export the relevant helper functions.
 * If the config `require_auth` is set to `false`, then we export a pass-through function to the next handler.
 *
 */

if (useAuth) {
	exports.ensureRole = require("./ensure-role.js");
	exports.ensureLoggedIn = require("connect-ensure-login").ensureLoggedIn;
} else {
	exports.ensureRole =
	exports.ensureLoggedIn = function(options) {
		return function(req, res, next) {
			next();
		}
	}
}