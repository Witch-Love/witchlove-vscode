import * as vscode from 'vscode';

import { readFileSync } from 'fs';
import path from 'path';
import { uminekoColoredTexts } from '../settings';
import { TLFileType } from '../types';
import { extensionFilePath, getTLFileType, isFileExists } from '../utils';

const TRUTH_EXP = /{p:([0-9]+):(.*)}/gi;
const glossaryRegexCache = new Map<TLFileType, Map<string, RegExp>>();

var timeout: NodeJS.Timer | undefined = undefined;
export function triggerUpdateDecorations(throttle = false) {
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

function getCompiledGlossaryRegexes(
	fileType: TLFileType,
	glossary: any,
): Map<string, RegExp> {
	if (!glossaryRegexCache.has(fileType)) {
		glossaryRegexCache.set(fileType, new Map());
	}

	const cached = glossaryRegexCache.get(fileType)!;
	const glos =
		fileType == 'umineko'
			? glossary.umineko
			: fileType == 'higurashi'
				? glossary.higurashi
				: undefined;

	if (!glos) return cached;

	for (const en of Object.keys(glos)) {
		if (!cached.has(en)) {
			cached.set(en, new RegExp(en, 'gi'));
		}
	}

	return cached;
}

const decorationCharNameTexts = new Map<string, vscode.DecorationOptions[]>();
const decorationCharColorIcons = new Map<string, vscode.DecorationOptions[]>();
const decorationTruthTexts = new Map<number, vscode.DecorationOptions[]>();
function updateDecorations() {
	if (!activeEditor) {
		statusbarItem.hide();
		translatebarItem.hide();
		return;
	}

	const fileType = getTLFileType(activeEditor.document.fileName);

	if (!fileType) return;

	const fileName = path.basename(activeEditor.document.fileName, '.txt');

	let fileDataPath = '';
	if (fileType == 'umineko') {
		fileDataPath = `data/data/${fileName}.json`;
	} else if (fileType == 'higurashi') {
		const dirs = path
			.dirname(activeEditor.document.fileName)
			.split(/\\|\//);
		fileDataPath = `data/data/${dirs[dirs.length - 1]}/${fileName}.json`;
	}

	let data = undefined;
	if (isFileExists(fileDataPath)) {
		data = JSON.parse(
			readFileSync(extensionFilePath(fileDataPath), 'utf-8'),
		);
	}

	for (let [key, _] of uminekoColoredTexts()) {
		decorationTruthTexts.set(key, []);
	}
	const glossaryDecors: vscode.DecorationOptions[] = [];
	for (let [key, _] of characters) {
		decorationCharNameTexts.set(key, []);
		decorationCharColorIcons.set(key, []);
	}

	const lines = activeEditor.document.getText().split('\n');
	const compiledGlossaryRegexes = getCompiledGlossaryRegexes(
		fileType,
		glossary,
	);
	const glos =
		fileType == 'umineko'
			? glossary.umineko
			: fileType == 'higurashi'
				? glossary.higurashi
				: undefined;

	// main
	for (let i = 0; i < lines.length; i++) {
		const currentLine = lines[i];
		// IGNORE HIGURASHI AND UMINEKO SCRIPT FILES
		if (
			currentLine.includes('void main()') ||
			currentLine.includes('log_reset')
		)
			return;

		if (!currentLine) continue;

		// STORY FILES - CHARACTER NAMES
		if (data) {
			createCharacterNameDecoration(data, i);
		}

		//GLOSSARY
		if (glos) {
			for (const [en, tr] of Object.entries(glos)) {
				const exp = compiledGlossaryRegexes.get(en)!;
				const matches = currentLine.matchAll(exp);

				for (let item of matches) {
					if (!item.index) continue;

					const range = new vscode.Range(
						new vscode.Position(i, item.index),
						new vscode.Position(i, item.index + item[0].length),
					);

					let hoverMessage = new vscode.MarkdownString(
						`<span style="color:#ffcc00;">${tr}</span> — <a href="https://witch-love.com/${fileType}/contributing/rules">Tüm Liste</a>`,
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

		// UMINEKO - TRUTH COLORS
		if (fileType == 'umineko') {
			const matches = currentLine.matchAll(TRUTH_EXP);

			for (let item of matches) {
				if (!item.index) continue;

				const truthId = Number(item[1]);

				const truthDec = decorationTruthTexts.get(truthId);

				if (!truthDec) continue;

				const range = new vscode.Range(
					new vscode.Position(i, item.index),
					new vscode.Position(i, item.index + item[0].length),
				);

				const conf = uminekoColoredTexts().get(truthId);
				let hoverMessage = undefined;
				if (conf) {
					hoverMessage = new vscode.MarkdownString(
						`<span style="color:${conf.colorHex.slice(0, -2)};"><b>${conf.hoverMessage}</b></span>`,
					);
					hoverMessage.supportHtml = true;
				}

				const decor = {
					range,
					hoverMessage,
				};

				truthDec.push(decor);
			}
		}
		// END OF LOOP
	}

	// character decors
	for (let [charId, _] of decorationCharNameTexts) {
		let char = characters.get(charId)!;
		let text = char.decoration.text;
		let icon = char.decoration.icon;

		if (text)
			activeEditor.setDecorations(
				text,
				decorationCharNameTexts.get(charId)!,
			);
		if (icon)
			activeEditor.setDecorations(
				icon,
				decorationCharColorIcons.get(charId)!,
			);
	}

	// dispose old decors
	let decor = global.glossaryDecor.get(activeEditor.document.fileName) ?? [];
	if (decor.length > 0) {
		for (let item of decor) item.dispose();
		global.glossaryDecor.set(activeEditor.document.fileName, []);
		decor = [];
	}

	// truth decors
	for (let [truthId, _] of decorationTruthTexts) {
		const conf = uminekoColoredTexts().get(truthId)!;
		const decoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: conf.colorHex,
		});

		decor.push(decoration);
		activeEditor.setDecorations(
			decoration,
			decorationTruthTexts.get(truthId)!,
		);
	}

	// glossary decors
	const glosDecor = vscode.window.createTextEditorDecorationType({
		backgroundColor: '#ffcc00',
		overviewRulerColor: '#ffcc00',
		color: '#1f1f1f',
		fontWeight: 'bold',
	});
	decor.push(glosDecor);
	activeEditor.setDecorations(glosDecor, glossaryDecors);

	// save
	global.glossaryDecor.set(activeEditor.document.fileName, decor);

	statusbarItem.show();
	translatebarItem.show();
}

function createCharacterNameDecoration(data: any, i: number) {
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

	let textDec = decorationCharNameTexts.get(charId);
	let iconDec = decorationCharColorIcons.get(charId);

	if (!textDec || !iconDec) return;

	const charInfo = characters.get(charId);
	if (!charInfo) return;

	let hoverMessage = new vscode.MarkdownString(
		`<span style="color:${charInfo.color};"><b>${charInfo.displayName}</b></span>`,
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
}
