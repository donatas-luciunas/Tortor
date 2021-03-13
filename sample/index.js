module.exports = function (a, b) {
    const c = a + b;
    console.log(c);
    if (global.tortor) {
        if (global.tortor.mocha.suite.suites[0].ctx.test.title === 'mano trumpas testas') {
            global.tortor.assert.equal(c, 7);
        }
    }
};