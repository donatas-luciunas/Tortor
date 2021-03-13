global.tortor = {}; // process.argv.includes('--tortor') ? {} : null;
console.log('geras');
require('./index');
if (global.tortor) {
    const options = {
        spec: ['./{,!(node_modules)/**/}*.test.js']
    };
    const Mocha = require('mocha/lib/mocha');
    global.tortor.mocha = new Mocha(options);
    global.tortor.assert = require('assert');
    require('mocha/lib/cli/run-helpers').runMocha(global.tortor.mocha, options);
}