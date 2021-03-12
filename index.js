(() => {
	global.debug = /--debug|--inspect/.test(process.execArgv.join(' '));
	global.assert = require('assert');
})();

(async () => {
	if (global.debug) {
		global.assert(false);
	}
	const a = 5;
	const b = 3;
	const c = a + b;
	console.log(c);
})();