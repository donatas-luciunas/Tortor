(async () => {
    await require('./tortor')();

    // rest of app
    console.log('geras');
    await require('./sum')(2, 2);

    // run mocha
    if (global.tortor) {
        global.tortor.run();
    }
})();