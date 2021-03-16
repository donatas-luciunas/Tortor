(async () => {
    await require('./tortor')();

    // rest of app
    const sum = require('./sum');
    // ...

    // run mocha
    if (global.tortor) {
        global.tortor.run();
    }
})();