const spawn = require('child_process').spawn;
const WebSocket = require('ws');
const esprima = require('esprima');

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Now active!');
	const insightsCollection = vscode.languages.createDiagnosticCollection('tortor');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.tortor', async () => {
		// The code you place here will be executed every time your command is executed
		insightsCollection.clear();

		let child;
		try {
			const fileName = vscode.window.activeTextEditor.document.fileName.toLowerCase().replace(/\\/g, '/');
			const lineNumber = vscode.window.activeTextEditor.selection.start.line;
			const scriptMetaData = esprima.parseScript(require('fs').readFileSync(fileName).toString(), { loc: true });

			child = spawn('node', ['--inspect', fileName, '--tortor']);

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

			// https://source.chromium.org/chromium/chromium/src/+/master:v8/test/debugger/test-api.js
			// čia gal kažkas į temą
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
				const handler = dataString => {
					const data = JSON.parse(dataString);
					if (data.id === msgid) {
						ws.off('message', handler);
						return resolve(data.result);
					}
				};
				ws.on('message', handler);
				ws.send(msg);
			});

			const scriptId = (await new Promise(resolve => {
				const handler = dataString => {
					const data = JSON.parse(dataString);
					if (data.method === 'Debugger.scriptParsed') {
						if (data.params.url.toLowerCase() === `file:///${fileName}`) {
							ws.off('message', handler);
							return resolve(data);
						}
					}
				};
				ws.on('message', handler);
			})).params.scriptId;

			ws.send(createMessage('Debugger.setBreakpoint', {
				location: {
					scriptId: scriptId,
					lineNumber: lineNumber,
					columnNumber: 0,
				}
			}).msg);

			const debuggerPausedState = await new Promise(resolve => {
				const handler = dataString => {
					const data = JSON.parse(dataString);
					if (data.method === 'Debugger.paused') {
						ws.off('message', handler);
						return resolve(data);
					}
				};
				ws.on('message', handler);
			});

			const startLocation = debuggerPausedState.params.callFrames[0].scopeChain[0].startLocation;
			let analyzeQueue = [scriptMetaData];
			const messages = [];
			while (analyzeQueue.length > 0) {
				const item = analyzeQueue.pop();
				for (const [key, identifierToken] of Object.entries(item)) {
					if (identifierToken && typeof identifierToken === 'object') {
						if (identifierToken.type && identifierToken.type === 'Identifier') {
							if (identifierToken.loc.start.line - 1 >= startLocation.lineNumber && identifierToken.loc.start.column >= startLocation.columnNumber && identifierToken.loc.end.line - 1 < lineNumber) {
								const value = await new Promise(resolve => {
									const { msgid, msg } = createMessage('Debugger.evaluateOnCallFrame', { callFrameId: debuggerPausedState.params.callFrames[0].callFrameId, expression: identifierToken.name, throwOnSideEffect: true });
									const handler = dataString => {
										const data = JSON.parse(dataString);
										if (data.id === msgid) {
											ws.off('message', handler);
											return resolve(data.result.result.description);
										}
									}
									ws.on('message', handler);
									ws.send(msg);
								});
								messages.push({
									loc: identifierToken.loc,
									value
								});
							}
						} else if (Array.isArray(identifierToken)) {
							analyzeQueue.push(...identifierToken);
						} else {
							analyzeQueue.push(identifierToken);
						}
					}
				}
			}

			insightsCollection.set(vscode.window.activeTextEditor.document.uri, messages.map(message => ({
				code: '',
				message: message.value,
				range: new vscode.Range(new vscode.Position(message.loc.start.line - 1, message.loc.start.column), new vscode.Position(message.loc.end.line - 1, message.loc.end.column)),
				severity: vscode.DiagnosticSeverity.Information,
				source: ''
			})));

		} catch (e) {
			console.error(e);
		} finally {
			// reiktų leist IDE bet kada debugger prijungt 💡
			if (child) {
				child.kill();
			}
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
function deactivate() { }

// eslint-disable-next-line no-undef
module.exports = {
	activate,
	deactivate
}