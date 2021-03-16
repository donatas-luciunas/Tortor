module.exports = async function (a, b) {
    const sum = a + b;
    console.log(sum);

    if (global.tortor) {
        global.tortor.ti('1', '1', () => {
            global.tortor.assert.equal(sum, 3);
        });
        global.tortor.ti('1', '2', () => {
            global.tortor.assert.equal(sum, 7);
        });
    }
};