const sum = require('./sum');
describe('1', async function () {
    it('1', async function () {
        await sum(1, 2);
    });

    it('2', async function () {
        await sum(3, 4);
    });
});

describe('2', async function () {
    xit('1', async function () {
        await sum(1, 5);
    });
    describe('2.1', async function () {
        it('1', async function () {
            await sum(1, 9);
        });
    });
});

xdescribe('3', async function () {
    it('1', async function () {
        await sum(5, 6);
    });
});