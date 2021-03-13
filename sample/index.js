module.exports = function (a, b) {
    const c = a + b;
    const z = 'testas';
    console.log(c, z);
    if (global.tortor) {
        global.tortor.ti('mano trumpas testas', () => {
            global.tortor.assert.equal(c, 7);
        });
    }
};