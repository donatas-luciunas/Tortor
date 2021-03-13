module.exports = function (a, b) {
    if (global.tortor) {
        if (global.tortor.willRun('antras describe')) {
            a++;
        }
    }
    const c = a + b;
    const z = 'testas';
    console.log(c, z);
    if (global.tortor) {
        global.tortor.ti(null, 'mano trumpas testas', () => {
            global.tortor.assert.equal(c, 8);
        });
    }
};