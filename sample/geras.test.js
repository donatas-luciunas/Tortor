const i = require('./index');
describe('geras describe', function () {
    it('mano ilgas testas', function () {
        i(1, 2);
    });

    it('mano trumpas testas', function () {
        i(3, 4);
    });
});

describe('antras describe', function () {
    xit('1', function () {
        i(1, 5);
    });
    describe('antras describe', function () {
        it('1', function () {
            i(1, 5);
        });
    });
});

xdescribe('isjungtas', function () {
    it('1', function () {
        i(1, 6);
    });
});