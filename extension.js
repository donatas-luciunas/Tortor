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
	let child;

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.tortor', async () => {
		// The code you place here will be executed every time your command is executed
		insightsCollection.clear();

		let ws;

		const request = message => {
			return new Promise((resolve, reject) => {
				const handler = dataString => {
					const data = JSON.parse(dataString);
					if (!data.id && data.method === JSON.parse(message.msg).method + 'd' || data.id === message.msgid) {
						ws.off('message', handler);
						if (data.error) {
							const error = new Error(data.error.message);
							error.code = data.error.code;
							reject(error);
						} else {
							resolve(data.result);
						}
					}
				};
				ws.on('message', handler);
				ws.send(message.msg);
			});
		};

		try {
			const fileName = vscode.window.activeTextEditor.document.fileName.replace(/\\/g, '/');
			const mainFileName = (() => {
				const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.toString().replace('file:///', '').replace('%3A', ':');
				const path = require('path');
				const fs = require('fs');
				const packageJsonPath = path.join(workspaceFolder, 'package.json');
				if (fs.existsSync(packageJsonPath)) {
					return path.join(workspaceFolder, JSON.parse(fs.readFileSync(packageJsonPath).toString()).main);
				}
				return fileName;
			})();
			const lineNumber = vscode.window.activeTextEditor.selection.start.line;
			const scriptMetaData = esprima.parseScript(require('fs').readFileSync(fileName).toString(), { loc: true });

			child = spawn('node', ['--inspect-brk', mainFileName, '--tortor']);
			child.stdout.pipe(process.stdout);
			child.stderr.pipe(process.stderr);
			// TODO: reiktų forward'int stream kažkur kur mato user

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
			ws = new WebSocket(wsUrl);

			await new Promise(resolve => {
				ws.on('open', resolve);
			});

			ws.on('message', dataString => {
				const data = JSON.parse(dataString);
				if (data.method === 'Debugger.scriptParsed') {
					console.debug(`script ${data.params.url}`);
				} else if (data.method === 'Debugger.paused') {
					console.debug('Debugger.paused', data.params.reason);
				} else {
					console.debug(data);
				}
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

			await request(createMessage('Debugger.enable'));
			await request(createMessage('Debugger.setPauseOnExceptions', { state: 'uncaught' }));
			await request(createMessage('Debugger.setBreakpointByUrl', {
				url: `file:///${fileName}`,
				lineNumber: lineNumber,
				columnNumber: 0
			}));

			await request(createMessage('Runtime.runIfWaitingForDebugger'));
			await new Promise(resolve => {
				const handler = dataString => {
					const data = JSON.parse(dataString);
					if (data.method === 'Debugger.paused') {
						ws.off('message', handler);
						return resolve(data);
					}
				};
				ws.on('message', handler);
			})
			await new Promise(resolve => {
				const handler = dataString => {
					const data = JSON.parse(dataString);
					if (data.method === 'Debugger.resumed') {
						ws.off('message', handler);
						return resolve(data);
					}
				};
				ws.on('message', handler);
				ws.send(createMessage('Debugger.resume').msg);
			});

			const variableValues = new Map();
			let identifierTokens;
			while (true) {
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

				if (identifierTokens === undefined) {
					const startLocation = debuggerPausedState.params.callFrames[0].scopeChain[0].startLocation;
					let analyzeQueue = [scriptMetaData];
					while (analyzeQueue.length > 0) {
						const item = analyzeQueue.pop();
						for (const [key, identifierToken] of Object.entries(item)) {
							if (identifierToken && typeof identifierToken === 'object') {
								if (identifierToken.type && identifierToken.type === 'Identifier') {
									if (identifierToken.loc.start.line - 1 >= startLocation.lineNumber && identifierToken.loc.start.column >= startLocation.columnNumber && identifierToken.loc.end.line - 1 < lineNumber) {
										identifierTokens.push(identifierToken);
									}
								} else if (Array.isArray(identifierToken)) {
									analyzeQueue.push(...identifierToken);
								} else {
									analyzeQueue.push(identifierToken);
								}
							}
						}
					}
				}

				for (const identifierToken of identifierTokens) {
					// todo: skip duplicates
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
			if (ws) {
				ws.close();
			}
			if (child) {
				child.kill();
				child = null;
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