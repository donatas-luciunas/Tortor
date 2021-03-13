module.exports = function (a, b) {
    if (global.tortor) {
        if (global.tortor.willRun('antras describe')) {
            a++;
        }
    }
    const c = a + b;
    const z = 'testas';
    const d = { mano: 'ilgas', kitas: { o: 3 }, a: [1, 2, 3], d: null };
    console.log(c, z, d);
    if (global.tortor) {
        global.tortor.ti(null, 'mano trumpas testas', () => {
            global.tortor.assert.equal(c, 8);
        });
    }
};