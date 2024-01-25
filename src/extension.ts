import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';
import { compareVersions } from 'compare-versions';

import {
	DisposableNotification,
	extensionFilePath,
	fetchFileJson,
	fetchFileText,
	generateColorImage,
	generateDecoration,
	getSeededColor,
	isFileExists,
} from './utils';
import initListen from './commands/listen';
import initTranslate from './commands/translate';
import LensProvider from './providers/LensProvider';

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
	initListen(context);
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
 * @param current_version current version of the extension
 * @returns
 */
async function versionChecker(current_version?: string) {
	if (!current_version) return;

	let res = await fetchFileJson('https://raw.githubusercontent.com/Witch-Love/witchlove-vscode/master/package.json');

	if (!res) return;

	let latest_version = res.version as string;

	if (compareVersions(current_version, latest_version) == -1) {
		vscode.window.showWarningMessage(
			`There is a new version (v${latest_version}) of the extension! Your version is v${current_version}. Please use the latest version!`
		);
	}
}

async function initGlossary() {
	let exp = new RegExp(/\\* (.{1,40}) `->` (.*)$/, 'gim');

	//UMINEKO
	let res_umineko = await fetchFileText('https://raw.githubusercontent.com/Witch-Love/witch-love.github.io/main/mkdocs/docs/umineko/contributing/rules.md');

	if (!res_umineko) return;


	for (let match of res_umineko.matchAll(exp)) {
		glossary.umineko[match[1]] = match[2];
	}

	//HIGURASHI
	let res_higurashi = await fetchFileText(
		'https://raw.githubusercontent.com/Witch-Love/witch-love.github.io/main/mkdocs/docs/higurashi/contributing/rules.md'
	);

	if (!res_higurashi) return;
	
	for (let match of res_higurashi.matchAll(exp)) {
		glossary.higurashi[match[1]] = match[2];
	}
}

async function initLens() {
	let res = await fetchFileText('https://gist.githubusercontent.com/Singulariity/0b41a4872b8039204b1450b5485c894a/raw/lens_data.json')

	if (!res) return;

	fs.writeFileSync(
		extensionFilePath('lens_data.json'),
		res,
		{
			encoding: 'utf-8',
		}
	);
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
				let datapath = context.asAbsolutePath(`data/data/${filename}.json`);
				updateVoicelines(datapath);
			}
		},
		null,
		context.subscriptions
	);
	vscode.workspace.onDidChangeTextDocument(
		(event) => {
			if (activeEditor && event.document === activeEditor.document) {
				triggerUpdateDecorations(true);
			}
		},
		null,
		context.subscriptions
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
		hover_width: conf.get<number>('hoverWidth')!,
		line_color_opacity: conf.get<number>('lineColorOpacity')!,
		paths: {
			characters: context.asAbsolutePath('characters.json'),
			higurashi: conf.get<string[]>(
				'lineListening.higurashiDirectories'
			)!,
			umineko: conf.get<string>('lineListening.uminekoDirectory')!,
			extension: context.extensionPath,
		},
		listen_volume: conf.get<number>('lineListening.volume')!,
		deepl_key: conf.get<string>('deepl.deeplKey')!,
		deepl_notification: conf.get<string>('deepl.translateNotification')! == 'Yes'
	};
}

function initCharacters() {
	global.characters = new Map();

	let body = JSON.parse(fs.readFileSync(config.paths.characters, 'utf-8'));

	for (var key in body) {
		let display_name = body[key][0].length == 0 ? key : body[key][0];
		let color = body[key][1];
		if (!color || color.length == 0) {
			color = getSeededColor(key);
		}
		characters.set(key, { display_name, color, decoration: {} });
	}
}

function initStatusbarItem() {
	global.statusbarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		10000
	);

	statusbarItem.command = 'witchLove.listen';
	statusbarItem.backgroundColor = new vscode.ThemeColor(
		'statusBarItem.warningBackground'
	);
}

function initTranslateBarItem() {
	global.translatebarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Right,
		11000
	);

	translatebarItem.command = 'witchLove.translate';
	translatebarItem.backgroundColor = new vscode.ThemeColor(
		'statusBarItem.errorBackground'
	);
	translatebarItem.text = `$(notebook-edit) Translate`;
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

	activeEditor.document.fileName

	let file_name = path.basename(activeEditor.document.fileName, '.txt');
	let file_data_path = `data/data/${file_name}.json`;

	if (!isFileExists(file_data_path)) {
		let dirs = path.dirname(activeEditor.document.fileName).split(/\\|\//);
		file_data_path = `data/data/${dirs[dirs.length - 1]}/${file_name}.json`;
		if (!isFileExists(file_data_path)) return;
	}

	let data = JSON.parse(
		fs.readFileSync(extensionFilePath(file_data_path), 'utf-8')
	);

	const decorationArrsText = new Map<string, vscode.DecorationOptions[]>();
	const decorationArrsIcon = new Map<string, vscode.DecorationOptions[]>();
	const glossary_decors: vscode.DecorationOptions[] = [];
	for (let [key, _] of characters) {
		decorationArrsText.set(key, []);
		decorationArrsIcon.set(key, []);
	}

	let file_type: 'higurashi' | 'umineko' | undefined = undefined;
	if (/(ep[1-8]|omake)\\.*\.txt/.test(activeEditor.document.fileName)) {
		file_type = 'umineko';
	} else if (/ch[1-8]\\.*\.txt/.test(activeEditor.document.fileName)) {
		file_type = 'higurashi';
	}

	const lines = activeEditor.document.getText().split('\n');
	for (let i = 0; i < lines.length; i++) {
		// RETURN FOR HIGURASHI AND UMINEKO SCRIPT FILES
		if (lines[i].includes('void main()') || lines[i].includes('log_reset'))
			return;

		let match = lines[i].match('(.*)');
		if (match !== null && match.index !== undefined) {
			let default_range = new vscode.Range(
				new vscode.Position(i, 0),
				new vscode.Position(i, config.hover_width)
			);

			let char_id = data[i + 1];
			if (char_id instanceof Array) {
				if (char_id[0] == '999' && char_id[1]) {
					char_id = "Unknown";
				} else {
					char_id = char_id[0];
				}
			}

			let text_dec = decorationArrsText.get(char_id);
			let icon_dec = decorationArrsIcon.get(char_id);

			if (!text_dec || !icon_dec) continue;

			let hoverMessage = new vscode.MarkdownString(
				`<span style="color:${characters.get(char_id)?.color};"><b> ${
					characters.get(char_id)?.display_name
				}</b></span>`
			);
			hoverMessage.supportHtml = true;

			let decorationText = {
				range: default_range,
				hoverMessage,
			};
			let decorationIcon = {
				range: default_range,
			};

			text_dec.push(decorationText);
			icon_dec.push(decorationIcon);

			//GLOSSARY
			let glos =
				file_type == 'umineko'
					? glossary.umineko
					: file_type == 'higurashi'
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
						new vscode.Position(i, item.index + item[0].length)
					);

					let hoverMessage = new vscode.MarkdownString(
						`<span style="color:#ffcc00;">${tr}</span> — <a href="https://witch-love.github.io/wiki/${
							file_type == 'umineko'
								? 'umineko/contributing/rules'
								: 'higurashi/contributing/rules'
						}">Tüm Liste</a>`
					);
					hoverMessage.supportHtml = true;

					let decor = {
						range,
						hoverMessage,
					};

					glossary_decors.push(decor);
				}
			}
		}
	}

	for (let [char_id, _] of decorationArrsText) {
		let char = characters.get(char_id)!;
		let text = char.decoration.text;
		let icon = char.decoration.icon;

		if (text)
			activeEditor.setDecorations(text, decorationArrsText.get(char_id)!);
		if (icon)
			activeEditor.setDecorations(icon, decorationArrsIcon.get(char_id)!);
	}

	let decor = global.glossaryDecor.get(activeEditor.document.fileName);
	if (decor) decor.dispose();
	let glos_decor = vscode.window.createTextEditorDecorationType({
		backgroundColor: '#ffcc00',
		overviewRulerColor: '#ffcc00',
		color: '#1f1f1f',
		fontWeight: 'bold',
	});
	global.glossaryDecor.set(activeEditor.document.fileName, glos_decor);
	activeEditor.setDecorations(glos_decor, glossary_decors);

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
	if (vscode.workspace.name != 'Witch Love (Workspace)') return;

	let folders = vscode.workspace.workspaceFolders;

	if (!folders) return;

	let script_path = folders[0].uri.fsPath + '/script.php';
	let ws_settings_path = folders[0].uri.fsPath + '/Witch Love.code-workspace';
	let readme_path = folders[0].uri.fsPath + '/README.md';

	let notification = DisposableNotification('Updating Witch Love Script...');

	let new_script = await fetchFileText(
		'https://gist.githubusercontent.com/Singulariity/8a9ae39062225dc9e12e2431fdc3057c/raw/script.php'
	);
	if (!new_script) {
		notification.close();
		let selection = await vscode.window.showErrorMessage(
			'Updating is failed. Please check your internet connection.',
			'Try Again',
			'Close'
		);
		if (selection == 'Try Again') {
			updateWitchLoveWorkspace();
		}
		return;
	}

	fs.writeFileSync(script_path, new_script, { encoding: 'utf-8' });
	notification.progress?.report({
		message: 'Witch Love Script updated!\nUpdating Workspace Settings...',
		increment: 50,
	});

	let new_settings = await fetchFileJson(
		'https://gist.githubusercontent.com/Singulariity/55749720793d156306dafdc2e597a107/raw/settings.json'
	);
	if (!new_settings) {
		notification.close();
		let selection = await vscode.window.showErrorMessage(
			'Updating is failed. Please check your internet connection.',
			'Try Again',
			'Close'
		);
		if (selection == 'Try Again') {
			updateWitchLoveWorkspace();
		}
		return;
	}
	let current_set = fs.readFileSync(ws_settings_path, 'utf-8');
	let current_settings = JSON.parse(current_set);

	for (let [key, _] of Object.entries(new_settings)) {
		current_settings['settings'][key] = new_settings[key];
	}

	fs.writeFileSync(
		ws_settings_path,
		JSON.stringify(current_settings, null, 4),
		{
			encoding: 'utf-8',
		}
	);

	let new_readme = await fetchFileText('https://gist.githubusercontent.com/Singulariity/817d9819133be88d898be6bfc78e084f/raw/README.md');
	if (!new_readme) {
		notification.close();
		let selection = await vscode.window.showErrorMessage(
			'Updating is failed. Please check your internet connection.',
			'Try Again',
			'Close'
		);
		if (selection == 'Try Again') {
			updateWitchLoveWorkspace();
		}
		return;
	}

	fs.writeFileSync(readme_path, new_readme, {encoding: 'utf-8'})

	notification.close();

	notification = DisposableNotification(
		'Witch Love Workspace updated successfully!'
	);
	notification.progress?.report({ increment: 100 });
	setTimeout(() => {
		notification.close();
	}, 4000);
}

export function deactivate() {}
