import { compareVersions } from 'compare-versions';
import * as fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

import { GlossaryEntries, GlossaryInfo, Translator } from 'deepl-node';
import initListen from './commands/listen';
import initTranslate from './commands/translate';
import initTranslateFile from './commands/translateFile';
import { triggerUpdateDecorations } from './decorations/decorations';
import LensProvider, { initLens } from './providers/LensProvider';
import { loadSettings } from './settings';
import {
	disposableNotification,
	fetchFileJson,
	fetchFileText,
	generateColorImage,
	generateDecoration,
	getSeededColor,
	getWorkspaceFolder,
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
	initTranslateFile(context);

	// LISTENER INITS
	initListeners(context);

	// GLOSSARY INITS
	await initGlossary();
	await initLens();

	// DEEPL GLOSSARY INIT
	updateDeeplGlossary().then(
		(glossaryInfo) => (config.deeplGlossary = glossaryInfo),
	);

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
	const exp = new RegExp(/^\*\s(.*?)\s`->`\s(.*)$/, 'gim');

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
	vscode.workspace.onDidChangeConfiguration(async () => {
		loadSettings(context);
		loadCharacterDecorations();
	});
}

async function updateDeeplGlossary(): Promise<GlossaryInfo | undefined> {
	if (config.deeplKey.length == 0) return;

	try {
		const translator = new Translator(config.deeplKey);

		const glossaryList = await translator.listGlossaries();

		let glossaryInfo = glossaryList.find((g) => g.name == 'umineko');

		if (glossaryInfo) {
			await translator.deleteGlossary(glossaryInfo);
		}

		const finalGlossary: { [key: string]: string } = {};
		for (let [key, value] of Object.entries(glossary.umineko)) {
			if (value.toLowerCase().includes('özel durum')) continue;

			let newValue = value
				.replace(/\s*\*?`?\(.*?\)`?\*?/g, '')
				.split('/')[0]
				.trim();
			finalGlossary[key] = newValue;
		}

		const entries = new GlossaryEntries({
			entries: finalGlossary,
		});
		glossaryInfo = await translator.createGlossary(
			'umineko',
			'en',
			'tr',
			entries,
		);
		return glossaryInfo;
	} catch (error) {
		console.error(error);
		return;
	}
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
