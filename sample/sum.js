module.exports = async function (a, b) {
    if (global.tortor) {
        if (global.tortor.willRun('antras describe')) {
            // a++;
        }
    }
    const sum = a + b;
    const sampleString = 'testas';
    const sampleObject = { mano: 4.20, kitas: { o: 3 }, a: [1, 2, 3], d: null, e: true, f: 'testas' };
    console.log(sum, sampleString, sampleObject);

    const sampleArray = [1, 2, 3, 4, 5];
    // await new Promise(resolve => setTimeout(resolve, 5000));
    for (const item of sampleArray) {
        const a = item + 1;
        console.log(a);
    }
    if (global.tortor) {
        // global.tortor.ti(null, null, () => {
        //     console.log(global.tortor.runner.test.title);
        // });
        global.tortor.ti(null, 'mano ilgas testas', () => {
            global.tortor.assert.equal(sum, 3);
        });
        global.tortor.ti(null, 'mano trumpas testas', () => {
            global.tortor.assert.equal(sum, 7);
        });
    }
};