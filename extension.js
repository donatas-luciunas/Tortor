const spawn = require('child_process').spawn;
const WebSocket = require('ws');
const esprima = require('esprima');
const vscode = require('vscode');
const util = require('util');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('Now active!');

	const insightsCollection = vscode.languages.createDiagnosticCollection('Tortor');
	const outputChannel = vscode.window.createOutputChannel('Tortor');
	let child;

	let disposable = vscode.commands.registerCommand('extension.tortor', async () => {

		const documentUri = vscode.window.activeTextEditor.document.uri;

		insightsCollection.clear();
		outputChannel.clear();
		outputChannel.show();

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
			const [mainFileName, workingDirectory] = (() => {
				const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.toString().replace('file:///', '').replace('%3A', ':');
				const path = require('path');
				const fs = require('fs');
				{
					let currentDirectory = path.dirname(fileName);
					while (fs.existsSync(currentDirectory)) {
						const packageJsonPath = path.join(currentDirectory, 'package.json');
						if (fs.existsSync(packageJsonPath)) {
							return [
								path.join(currentDirectory, JSON.parse(fs.readFileSync(packageJsonPath).toString()).main),
								currentDirectory
							];
						} else {
							currentDirectory = path.join(currentDirectory, '..');
						}
					}
				}

				return [fileName, workspaceFolder];
			})();
			const lineNumber = vscode.window.activeTextEditor.selection.start.line;
			const scriptMetaData = esprima.parseScript(require('fs').readFileSync(fileName).toString(), { loc: true });

			if (child) {
				child.kill();
				child = null;
			}
			child = spawn('node', ['--inspect-brk', mainFileName], { cwd: workingDirectory, env: { TORTOR: true } });
			child.stdout.on('data', data => {
				outputChannel.append(data.toString());
			});
			child.stderr.on('data', data => {
				outputChannel.append(data.toString());
			});
			child.on('close', code => {
				outputChannel.appendLine('exited');
				if (code !== 0) {
					vscode.window.showErrorMessage(`Tortor finished with error code ${code}`);
				}
				child = null;
			});

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
			ws.on('error', data => {
				console.error(data);
			});

			ws.on('message', dataString => {
				try {
					const data = JSON.parse(dataString);
					if (data.method === 'Debugger.scriptParsed') {
						console.debug(`script ${data.params.url}`);
					} else if (data.method === 'Debugger.paused') {
						console.debug('Debugger.paused', data.params.reason);
					} else {
						console.debug(data);
					}
				} catch (e) {
					console.error(e);
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
			await request(createMessage('Runtime.enable'));
			await request(createMessage('Debugger.setPauseOnExceptions', { state: 'none' }));
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
			let expressionTokens;
			let debuggerPausedState;
			while (true) {
				const event = await Promise.race([
					new Promise(resolve => {
						const handler = dataString => {
							const data = JSON.parse(dataString);
							if (data.method === 'Runtime.executionContextDestroyed') {
								ws.off('message', handler);
								return resolve(data);
							}
						};
						ws.on('message', handler);
					}),
					new Promise(resolve => {
						const handler = dataString => {
							const data = JSON.parse(dataString);
							if (data.method === 'Debugger.paused') {
								ws.off('message', handler);
								return resolve(data);
							}
						};
						ws.on('message', handler);
					})
				]);
				if (event.method === 'Debugger.paused') {
					debuggerPausedState = event.params;
				} else {
					break;
				}

				if (expressionTokens === undefined) {

					const getExpression = (token) => {
						if (token.type === 'Literal') {
							return token.value;
						} else if (token.type === 'Identifier') {
							return token.name;
						} else if (token.type === 'MemberExpression') {
							const objectPart = getExpression(token.object);
							const propertyPart = getExpression(token.property);
							if (token.computed) {
								return `${objectPart}[${propertyPart}]`;
							} else {
								return objectPart + '.' + propertyPart;
							}
						}
						return '';
					};

					expressionTokens = [];
					const startLocation = debuggerPausedState.callFrames[0].scopeChain[0].startLocation;
					let analyzeQueue = [scriptMetaData];
					while (analyzeQueue.length > 0) {
						const token = analyzeQueue.pop();

						if (token.type && ['MemberExpression', 'Identifier'].includes(token.type)) {
							if ((token.loc.start.line - 1 > startLocation.lineNumber || (token.loc.start.line - 1 === startLocation.lineNumber && token.loc.start.column >= startLocation.columnNumber))
								&& token.loc.end.line - 1 < lineNumber) {
								const expression = getExpression(token);
								expressionTokens.push({
									expression: expression,
									loc: token.loc
								});
								variableValues.set(expression, []);
							}
						} else if (token.type && token.type === 'ObjectExpression') {
							// do nothing
						} else {
							for (const [key, innerToken] of Object.entries(token)) {
								if (innerToken && typeof innerToken === 'object') {
									if (Array.isArray(innerToken)) {
										analyzeQueue.push(...innerToken);
									} else {
										analyzeQueue.push(innerToken);
									}
								}
							}
						}
					}
				}

				for (const [key, values] of variableValues.entries()) {
					const value = await new Promise(resolve => {
						const { msgid, msg } = createMessage('Debugger.evaluateOnCallFrame', { callFrameId: debuggerPausedState.callFrames[0].callFrameId, expression: key, generatePreview: true, throwOnSideEffect: true });
						const handler = dataString => {
							const data = JSON.parse(dataString);
							if (data.id === msgid) {
								ws.off('message', handler);
								return resolve(data.result.result);
							}
						}
						ws.on('message', handler);
						ws.send(msg);
					});

					if (value.preview) {
						const object = (() => {
							const result = {};
							for (const property of value.preview.properties) {
								let value = property.value;
								switch (property.type) {
									case "object": {
										switch (property.subtype) {
											case "error": {
												const desc = property.description;
												switch (property.className) {
													case "EvalError": throw new EvalError(desc);
													case "RangeError": throw new RangeError(desc);
													case "ReferenceError": throw new ReferenceError(desc);
													case "SyntaxError": throw new SyntaxError(desc);
													case "TypeError": throw new TypeError(desc);
													case "URIError": throw new URIError(desc);
													default: throw new Error(desc);
												}
												break;
											}
											case "array": {
												const array = [];
												value = array;
												break;
											}
											case "null": {
												value = null;
												break;
											}
											default: {
												switch (property.className) {
													case "global":
														value = Function('return this')();
														break;
													// case "Number":
													// case "String":
													// case "Boolean":
													// 	value = this.reconstructValue(property.objectId);
													// 	break;
													default:
														value = {};
														break;
												}
												break;
											}
										}
										break;
									}
									case "undefined": {
										value = undefined;
										break;
									}
									case "number": {
										if (property.description === "NaN") {
											value = NaN;
										}
										value = Number(value);
										break;
									}
									case "bigint": {
										assertEquals("n", property.unserializableValue.charAt(
											property.unserializableValue.length - 1));
										value = eval(property.unserializableValue);
										break;
									}
									case "string":
										break;
									case "boolean": {
										value = value === 'true';
										break;
									}
									case "function": {
										value = () => { };
									}
									default: {
										break;
									}
								}

								result[property.name] = value;
							}

							return result;
						})();

						let text = util.inspect(object);
						if (value.preview.overflow) {
							text = text.replace(' }', ', ... }').replace('\n}', ',\n  ...\n}');
						}
						values.push(text);
					} else if (typeof value.value === 'string') {
						values.push(`'${value.value}'`);
					} else {
						values.push(value.description || value.value || 'UNDEFINED');
					}
				}

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
			}

			insightsCollection.set(documentUri, expressionTokens.reduce((result, expressionToken) => {
				for (const value of variableValues.get(expressionToken.expression)) {
					result.push({
						code: '',
						message: value,
						range: new vscode.Range(new vscode.Position(expressionToken.loc.start.line - 1, expressionToken.loc.start.column), new vscode.Position(expressionToken.loc.end.line - 1, expressionToken.loc.end.column)),
						severity: vscode.DiagnosticSeverity.Hint,
						source: 'Tortor'
					});
				}

				return result;
			}, []));
		} catch (e) {
			console.error(e);
		} finally {
			if (ws) {
				ws.close();
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