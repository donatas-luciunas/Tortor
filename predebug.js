var spawn = require('child_process').spawn,
    child = spawn('node', ['inspect', 'index.js']);

// https://nodejs.org/api/debugger.html
// CLI debugger berods neleidžia išsi'list'int tiesiog visų scope variables

// https://source.chromium.org/chromium/chromium/src/+/master:v8/test/debugger/test-api.js
// čia gal kažkas į temą
// ir https://www.npmjs.com/package/ws

/*
su šitu gauni variable names ir t.t.
https://esprima.readthedocs.io/en/latest/syntactic-analysis.html

leidi IDE bet kada debugger prijungt 💡

Unit testai žudo enkapsuliaciją ❗

Komentare rašai JS, kurį leidžia vykdant smart debugger'į
Ten pasirašai mock'us (ar eis return'int iš funkcijos ⚠️)
Ten pasirašai request'us į savo serverį, jeigu nori
Ir ten ir pasirašai assert'us
Tik reiktų turbūt kažkokį context ant global maintain'int kuriame ir pats pasisaugai kažką ir dependencies turi

On save leidi debugger'į
Prie kiekvieno comment darai breakpoint ir toj vietoj suvykdai comment prieš nerdamas
O gal pradžiai ne į comment, o tiesiog į if (global.debug) {} rašai 💡
https://stackoverflow.com/questions/6889470/how-to-programmatically-detect-debug-mode-in-nodejs
``` global.debug = /--debug|--inspect/.test(process.execArgv.join(' '));
Galima padaryt kad prode nebeliktų šitų

Tada run'ini debugger iki highlighted eilutės
Ir išpieši info virš visų variables

Galima kartu maintain'int output tų testų, ir jeigu output pasikeitė - matai be'commit'indamas
*/

(async () => {
    child.stdin.setEncoding('utf-8');
    child.stdout.pipe(process.stdout);

    await new Promise(resolve => setTimeout(resolve, 1000));
    child.stdin.write("sb(2)\n");

    await new Promise(resolve => setTimeout(resolve, 1000));
    child.stdin.write("c\n");

    while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        child.stdin.write("n\n");
    }

    // child.stdin.end(); /// this call seems necessary, at least with plain node.js executable 
})();