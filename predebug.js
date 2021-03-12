const spawn = require('child_process').spawn;
const WebSocket = require('ws');

(async () => {
    try {
        const child = spawn('node', ['--inspect', 'index.js', '--tortor']);
        // child.stdout.pipe(process.stdout);
        // child.stderr.pipe(process.stderr);

        const wsUrl = await new Promise((resolve, reject) => {
            let line = '';
            const catchWebSocketUrl = data => {
                line += data.toString();
                if (!line.includes('\n')) {
                    return;
                }
                if (!line.includes('ws://')) {
                    reject(new Error('Could not detect WS URL'));
                }

                resolve(line.match(/ws:\/\/[\S]+/)[0]);

                child.stderr.off('data', catchWebSocketUrl)
            };

            child.stderr.on('data', catchWebSocketUrl);
        });

        const ws = new WebSocket(wsUrl);

        await new Promise(resolve => {
            ws.on('open', resolve);
        });

        let nextMessageId = 1;
        const getNextMessageId = () => {
            return nextMessageId++;
        };

        const createMessage = (method, params) => {
            const id = getNextMessageId();
            const msg = JSON.stringify({
                id: id,
                method: method,
                params: params,
            });
            return { msgid: id, msg: msg };
        }

        await new Promise(resolve => {
            const { msgid, msg } = createMessage('Debugger.enable');
            ws.on('message', dataString => {
                const data = JSON.parse(dataString);
                if (data.id === msgid) {
                    resolve(data.result);
                }
            });
            ws.send(msg);
        });

        const scriptId = (await new Promise(resolve => {
            ws.on('message', dataString => {
                const data = JSON.parse(dataString);
                if (data.method === 'Debugger.scriptParsed' && data.params.url === 'file:///C:/Users/donat/Code/smartdebug/index.js') {
                    return resolve(data);
                }
            });
        })).params.scriptId;

        ws.send(createMessage('Debugger.setBreakpoint', {
            location: {
                scriptId: scriptId,
                lineNumber: 13,
                columnNumber: 0,
            }
        }).msg);

        const debuggerPausedState = await new Promise(resolve => {
            ws.on('message', dataString => {
                const data = JSON.parse(dataString);
                if (data.method === 'Debugger.paused') {
                    return resolve(data);
                }
            });
        });

        const properties = await new Promise(resolve => {
            const { msgid, msg } = createMessage('Runtime.getProperties', { objectId: debuggerPausedState.params.callFrames[0].scopeChain[0].object.objectId });
            ws.on('message', dataString => {
                const data = JSON.parse(dataString);
                if (data.id === msgid) {
                    resolve(data.result);
                }
            });
            ws.send(msg);
        });

        console.log(JSON.stringify(properties));

        // todo: remove?
        ws.on('message', dataString => {
            const data = JSON.parse(dataString);
            console.debug(data);
        });
    } catch (e) {
        console.error(e);
    }
})();

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