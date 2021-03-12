(() => {
	global.tortor = process.argv.includes('--tortor');
	global.assert = require('assert');
})();

(async () => {
	if (global.tortor) {
		console.log('test');
	}
	const a = require('./kitas-index');
	const b = 3;
	const c = a + b;
	console.log(c);
})();