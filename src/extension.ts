import { compareVersions } from 'compare-versions';
import * as fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

import initListen from './commands/listen';
import initTranslate from './commands/translate';
import LensProvider from './providers/LensProvider';
import {
	disposableNotification,
	extensionFilePath,
	fetchFileJson,
	fetchFileText,
	generateColorImage,
	generateDecoration,
	getSeededColor,
	getWorkspaceFolder,
	isFileExists,
} from './utils';

async function extensionOnReady(context: vscode.ExtensionContext) {
	if (activeEditor) {
		triggerUpdateDecorations();
	}

	console.log('Extension started.');

	await versionChecker(context.extension.packageJSON.version);
}

export async function activate(context: vscode.ExtensionContext) {
	// GLOBAL INITS
	global.activeEditor = vscode.window.activeTextEditor;
	global.voicelines = undefined;
	global.glossaryDecor = new Map();
	global.glossary = {
		higurashi: {},
		umineko: {},
	};

	// INIT SETTINGS
	loadSettings(context);

	// UPDATE WITCH LOVE WORKSPACE
	await updateWitchLoveWorkspace();

	// INIT STATUS BAR ITEM
	initStatusbarItem();
	initTranslateBarItem();

	// COMMAND INITS
	await initListen(context);
	initTranslate(context);

	// LISTENER INITS
	initListeners(context);

	// GLOSSARY INITS
	await initGlossary();
	await initLens();

	// LENS INIT
	vscode.languages.registerCodeLensProvider('*', new LensProvider());

	// CHARACTERS INIT
	initCharacters();
	await initColorImages();
	loadCharacterDecorations();

	extensionOnReady(context);
}

/**
 *
 * @param currentVersion current version of the extension
 * @returns
 */
async function versionChecker(currentVersion?: string) {
	if (!currentVersion) return;

	const res = await fetchFileJson(
		'https://raw.githubusercontent.com/Witch-Love/witchlove-vscode/master/package.json',
	);

	if (!res) return;

	let latestVersion = res.version as string;

	if (compareVersions(currentVersion, latestVersion) == -1) {
		vscode.window.showWarningMessage(
			`There is a new version (v${latestVersion}) of the extension! Your version is v${currentVersion}. Please use the latest version!`,
		);
	}
}

async function initGlossary() {
	const exp = new RegExp(/\\* (.{1,40}) `->` (.*)$/, 'gim');

	//UMINEKO
	let resUmineko = await fetchFileText(
		'https://raw.githubusercontent.com/Witch-Love/witch-love.github.io/main/mkdocs/docs/umineko/contributing/rules.md',
	);

	if (!resUmineko) return;

	for (let match of resUmineko.matchAll(exp)) {
		glossary.umineko[match[1]] = match[2];
	}

	//HIGURASHI
	let resHigurashi = await fetchFileText(
		'https://raw.githubusercontent.com/Witch-Love/witch-love.github.io/main/mkdocs/docs/higurashi/contributing/rules.md',
	);

	if (!resHigurashi) return;

	for (let match of resHigurashi.matchAll(exp)) {
		glossary.higurashi[match[1]] = match[2];
	}
}

async function initLens() {
	let res = await fetchFileText(
		'https://gist.githubusercontent.com/Singulariity/0b41a4872b8039204b1450b5485c894a/raw/lens_data.json',
	);

	if (!res) return;

	fs.writeFileSync(extensionFilePath('lens_data.json'), res, {
		encoding: 'utf-8',
	});
}

async function initColorImages() {
	// GENERATE COLORS DIR (IF NOT EXISTS)
	if (!fs.existsSync(config.paths.extension + '/colors')) {
		fs.mkdir(config.paths.extension + '/colors', (err) => {
			console.log(err);
		});
	}

	for await (let [key, _] of characters) {
		await generateColorImage(key);
	}
	return;
}

/**
 * Sets the decorations of characters (init or reload)
 * @returns
 */
function loadCharacterDecorations() {
	for (let [key, character] of characters) {
		character.decoration = generateDecoration(key);
	}
	return;
}

function initListeners(context: vscode.ExtensionContext) {
	function updateStatusBar() {
		if (!activeEditor) {
			statusbarItem.hide();
			translatebarItem.hide();
			return;
		}

		let val = activeEditor.selection.active.line + 1;
		statusbarItem.text = `$(megaphone) Listen (Line: ${val})`;
	}

	vscode.window.onDidChangeActiveTextEditor(updateStatusBar);
	vscode.window.onDidChangeTextEditorSelection(updateStatusBar);
	vscode.window.onDidChangeActiveTextEditor(
		(editor) => {
			activeEditor = editor;
			if (editor) {
				triggerUpdateDecorations();

				let filename = path.basename(editor.document.fileName, '.txt');
				let datapath = context.asAbsolutePath(
					`data/data/${filename}.json`,
				);
				updateVoicelines(datapath);
			}
		},
		null,
		context.subscriptions,
	);
	vscode.workspace.onDidChangeTextDocument(
		(event) => {
			if (activeEditor && event.document === activeEditor.document) {
				triggerUpdateDecorations(true);
			}
		},
		null,
		context.subscriptions,
	);
	vscode.workspace.onDidChangeConfiguration(() => {
		loadSettings(context);
		loadCharacterDecorations();
	});
}

/**
 * Sets the config settings (init or reload)
 * @param context
 */
function loadSettings(context: vscode.ExtensionContext) {
	let conf = vscode.workspace.getConfiguration('witchLove');

	// UPDATE SETTINGS
	global.config = {
		hoverWidth: conf.get<number>('hoverWidth')!,
		lineColorOpacity: conf.get<number>('lineColorOpacity')!,
		paths: {
			characters: context.asAbsolutePath('characters.json'),
			voiceFiles: conf.get<string>('lineListening.voiceFilesDirectory')!,
			extension: context.extensionPath,
		},
		onlineToken: conf.get<string>('lineListening.onlineToken')!,
		listenVolume: conf.get<number>('lineListening.volume')!,
		deeplKey: conf.get<string>('deepl.deeplKey')!,
		deeplNotification:
			conf.get<string>('deepl.translateNotification')! == 'Yes',
	};
}

function initCharacters() {
	global.characters = new Map();

	let body = JSON.parse(fs.readFileSync(config.paths.characters, 'utf-8'));

	for (var key in body) {
		let displayName = body[key][0].length == 0 ? key : body[key][0];
		let color = body[key][1];
		if (!color || color.length == 0) {
			color = getSeededColor(key);
		}
		characters.set(key, {
			displayName: displayName,
			color,
			decoration: {},
		});
	}
}

function initStatusbarItem() {
	global.statusbarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		10000,
	);

	statusbarItem.command = 'witchLove.listen';
	statusbarItem.backgroundColor = new vscode.ThemeColor(
		'statusBarItem.warningBackground',
	);
	statusbarItem.tooltip = 'Alt + Q';
}

function initTranslateBarItem() {
	global.translatebarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		11000,
	);

	translatebarItem.command = 'witchLove.translate';
	translatebarItem.backgroundColor = new vscode.ThemeColor(
		'statusBarItem.errorBackground',
	);
	translatebarItem.text = `$(notebook-edit) Translate`;
	translatebarItem.tooltip = 'Alt + A';
}

export function updateVoicelines(path: string) {
	if (!fs.existsSync(path)) {
		global.voicelines = undefined;
		return;
	}
	const data = fs.readFileSync(path, 'utf-8');
	global.voicelines = JSON.parse(data);
}

function updateDecorations() {
	if (!activeEditor) {
		statusbarItem.hide();
		translatebarItem.hide();
		return;
	}

	activeEditor.document.fileName;

	let fileName = path.basename(activeEditor.document.fileName, '.txt');
	let fileDataPath = `data/data/${fileName}.json`;

	if (!isFileExists(fileDataPath)) {
		let dirs = path.dirname(activeEditor.document.fileName).split(/\\|\//);
		fileDataPath = `data/data/${dirs[dirs.length - 1]}/${fileName}.json`;
		if (!isFileExists(fileDataPath)) return;
	}

	let data = JSON.parse(
		fs.readFileSync(extensionFilePath(fileDataPath), 'utf-8'),
	);

	const decorationArrsText = new Map<string, vscode.DecorationOptions[]>();
	const decorationArrsIcon = new Map<string, vscode.DecorationOptions[]>();
	const glossaryDecors: vscode.DecorationOptions[] = [];
	for (let [key, _] of characters) {
		decorationArrsText.set(key, []);
		decorationArrsIcon.set(key, []);
	}

	let fileType: 'higurashi' | 'umineko' | undefined = undefined;
	if (/(ep[1-8]|omake)\\.*\.txt/.test(activeEditor.document.fileName)) {
		fileType = 'umineko';
	} else if (/ch[1-8]\\.*\.txt/.test(activeEditor.document.fileName)) {
		fileType = 'higurashi';
	}

	const lines = activeEditor.document.getText().split('\n');
	for (let i = 0; i < lines.length; i++) {
		// RETURN FOR HIGURASHI AND UMINEKO SCRIPT FILES
		if (lines[i].includes('void main()') || lines[i].includes('log_reset'))
			return;

		let match = lines[i].match('(.*)');
		if (match !== null && match.index !== undefined) {
			let defaultRange = new vscode.Range(
				new vscode.Position(i, 0),
				new vscode.Position(i, config.hoverWidth),
			);

			let charId = data[i + 1];
			if (charId instanceof Array) {
				if (charId[0] == '999' && charId[1]) {
					charId = 'Unknown';
				} else {
					charId = charId[0];
				}
			}

			let textDec = decorationArrsText.get(charId);
			let iconDec = decorationArrsIcon.get(charId);

			if (!textDec || !iconDec) continue;

			let hoverMessage = new vscode.MarkdownString(
				`<span style="color:${characters.get(charId)?.color};"><b> ${
					characters.get(charId)?.displayName
				}</b></span>`,
			);
			hoverMessage.supportHtml = true;

			let decorationText = {
				range: defaultRange,
				hoverMessage,
			};
			let decorationIcon = {
				range: defaultRange,
			};

			textDec.push(decorationText);
			iconDec.push(decorationIcon);

			//GLOSSARY
			let glos =
				fileType == 'umineko'
					? glossary.umineko
					: fileType == 'higurashi'
						? glossary.higurashi
						: undefined;
			if (!glos) continue;

			for (let [en, tr] of Object.entries(glos)) {
				let exp = new RegExp(en, 'gi');
				let matches = lines[i].matchAll(exp);

				for (let item of matches) {
					if (!item.index) continue;

					let range = new vscode.Range(
						new vscode.Position(i, item.index),
						new vscode.Position(i, item.index + item[0].length),
					);

					let hoverMessage = new vscode.MarkdownString(
						`<span style="color:#ffcc00;">${tr}</span> — <a href="https://witch-love.com/${
							fileType == 'umineko'
								? 'umineko/contributing/rules'
								: 'higurashi/contributing/rules'
						}">Tüm Liste</a>`,
					);
					hoverMessage.supportHtml = true;

					let decor = {
						range,
						hoverMessage,
					};

					glossaryDecors.push(decor);
				}
			}
		}
	}

	for (let [charId, _] of decorationArrsText) {
		let char = characters.get(charId)!;
		let text = char.decoration.text;
		let icon = char.decoration.icon;

		if (text)
			activeEditor.setDecorations(text, decorationArrsText.get(charId)!);
		if (icon)
			activeEditor.setDecorations(icon, decorationArrsIcon.get(charId)!);
	}

	let decor = global.glossaryDecor.get(activeEditor.document.fileName);
	if (decor) decor.dispose();
	let glosDecor = vscode.window.createTextEditorDecorationType({
		backgroundColor: '#ffcc00',
		overviewRulerColor: '#ffcc00',
		color: '#1f1f1f',
		fontWeight: 'bold',
	});
	global.glossaryDecor.set(activeEditor.document.fileName, glosDecor);
	activeEditor.setDecorations(glosDecor, glossaryDecors);

	statusbarItem.show();
	translatebarItem.show();
}

var timeout: NodeJS.Timer | undefined = undefined;
function triggerUpdateDecorations(throttle = false) {
	if (timeout) {
		clearTimeout(timeout);
		timeout = undefined;
	}
	if (throttle) {
		timeout = setTimeout(updateDecorations, 500);
	} else {
		updateDecorations();
	}
}

async function updateWitchLoveWorkspace() {
	const folder = getWorkspaceFolder();
	if (!folder) return;

	// const script_path = folder.uri.fsPath + '/script.php';
	const wsSettingsPath = folder.uri.fsPath + '/Witch Love.code-workspace';
	const readmeRedaction = folder.uri.fsPath + '/README_redaksiyon.md';
	const readmeTranslation = folder.uri.fsPath + '/README_çeviri.md';

	let notification = disposableNotification(
		'Updating Witch Love Settings...',
	);

	let newSettings = await fetchFileJson(
		'https://gist.githubusercontent.com/Singulariity/55749720793d156306dafdc2e597a107/raw/settings.json',
	);
	if (!newSettings) {
		notification.close();
		let selection = await vscode.window.showErrorMessage(
			'Updating is failed. Please check your internet connection.',
			'Try Again',
			'Close',
		);
		if (selection == 'Try Again') {
			updateWitchLoveWorkspace();
		}
		return;
	}
	let currentSet = fs.readFileSync(wsSettingsPath, 'utf-8');
	let currentSettings = JSON.parse(currentSet);

	for (let [key, _] of Object.entries(newSettings)) {
		currentSettings['settings'][key] = newSettings[key];
	}

	fs.writeFileSync(wsSettingsPath, JSON.stringify(currentSettings, null, 4), {
		encoding: 'utf-8',
	});
	notification.progress?.report({
		message: 'Witch Love Settings updated!\nUpdating README files...',
		increment: 50,
	});

	let newReadmeRedaction = await fetchFileText(
		'https://gist.githubusercontent.com/Singulariity/817d9819133be88d898be6bfc78e084f/raw/README_redaksiyon.md',
	);
	if (!newReadmeRedaction) {
		notification.close();
		let selection = await vscode.window.showErrorMessage(
			'Updating is failed. Please check your internet connection.',
			'Try Again',
			'Close',
		);
		if (selection == 'Try Again') {
			updateWitchLoveWorkspace();
		}
		return;
	}

	fs.writeFileSync(readmeRedaction, newReadmeRedaction, {
		encoding: 'utf-8',
	});

	let newReadmeTranslation = await fetchFileText(
		'https://gist.githubusercontent.com/Singulariity/8308ebb12c2de349e1f9b0ea1ad18601/raw/README_çeviri.md',
	);
	if (!newReadmeTranslation) {
		notification.close();
		let selection = await vscode.window.showErrorMessage(
			'Updating is failed. Please check your internet connection.',
			'Try Again',
			'Close',
		);
		if (selection == 'Try Again') {
			updateWitchLoveWorkspace();
		}
		return;
	}

	fs.writeFileSync(readmeTranslation, newReadmeTranslation, {
		encoding: 'utf-8',
	});

	notification.close();

	notification = disposableNotification(
		'Witch Love Workspace updated successfully!',
	);
	notification.progress?.report({ increment: 100 });
	setTimeout(() => {
		notification.close();
	}, 4000);
}

export function deactivate() {}
