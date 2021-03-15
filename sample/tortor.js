async function InitTortor() {
    if (!process.env.TORTOR) {
        return;
    }
    global.tortor = {};

    const options = {
        spec: ['./{,!(node_modules)/**/}*.test.js'],
        delay: true,
        exit: true
    };
    const Mocha = require('mocha/lib/mocha');
    global.tortor.mocha = new Mocha(options);
    global.tortor.assert = require('assert');
    global.tortor.runner = await require('mocha/lib/cli/run-helpers').runMocha(global.tortor.mocha, options);
    global.tortor.run = global.run;
    delete global.run;
    global.tortor.ti = (describeTitle, testTitle, func) => {
        if (global.tortor.runner.state === 'running' &&
            (!testTitle || global.tortor.runner.test.title === testTitle) &&
            (!describeTitle || global.tortor.runner.test.parent.title === describeTitle)) {
            func();
        }
    };
    global.tortor.willRun = (...titles) => {
        const hasOnly = global.tortor.mocha.suite.hasOnly();
        const willRunInner = (item, ...titles) => {
            if (titles.length === 0) {
                if (hasOnly) {
                    return item.hasOnly();
                } else {
                    // neatsižvelgia, jeigu visas vidus pending
                    return !item.isPending();
                }
            }

            for (const suite of item.suites) {
                if (suite.title === titles[0] && (!hasOnly || suite.hasOnly())) {
                    if (willRunInner(suite, ...titles.slice(1))) {
                        return true;
                    }
                }
            }

            if (titles.length === 1) {
                for (const test of item.tests) {
                    if (test.title === titles[0] && (!hasOnly || test.parent._onlyTests.includes(test))) {
                        if (!test.isPending()) {
                            return true;
                        }
                    }
                }
            }

            return false;
        };

        return willRunInner(global.tortor.mocha.suite, ...titles);
    };
};

module.exports = InitTortor;