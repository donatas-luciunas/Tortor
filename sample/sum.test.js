const sum = require('./sum');
describe('geras describe', async function () {
    it('mano ilgas testas', async function () {
        await sum(1, 2);
    });

    it('mano trumpas testas', async function () {
        await sum(3, 4);
    });
});

describe('antras describe', async function () {
    xit('1', async function () {
        await sum(1, 5);
    });
    describe('antras describe', async function () {
        it('1', async function () {
            await sum(1, 5);
        });
    });
});

xdescribe('isjungtas', async function () {
    it('1', async function () {
        await sum(1, 6);
    });
});