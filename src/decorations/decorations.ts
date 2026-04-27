import * as vscode from 'vscode';

import { readFileSync } from 'fs';
import path from 'path';
import { uminekoColoredTexts } from '../settings';
import { TLFileType } from '../types';
import { extensionFilePath, getTLFileType, isFileExists } from '../utils';

const TRUTH_EXP = /{p:([0-9]+):(.*)}/gi;
const glossaryRegexCache = new Map<TLFileType, Map<string, RegExp>>();
let lastGlossaryUpdateTime = 0;

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

	if (!isFileExists(fileDataPath)) return;

	const data = JSON.parse(
		readFileSync(extensionFilePath(fileDataPath), 'utf-8'),
	);

	const decorationArrsText = new Map<string, vscode.DecorationOptions[]>();
	const decorationArrsIcon = new Map<string, vscode.DecorationOptions[]>();
	const truthArrsText = new Map<number, vscode.DecorationOptions[]>();
	for (let [key, _] of uminekoColoredTexts()) {
		truthArrsText.set(key, []);
	}
	const glossaryDecors: vscode.DecorationOptions[] = [];
	for (let [key, _] of characters) {
		decorationArrsText.set(key, []);
		decorationArrsIcon.set(key, []);
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

		const charInfo = characters.get(charId);
		if (!charInfo) continue;

		let hoverMessage = new vscode.MarkdownString(
			`<span style="color:${charInfo.color};"><b> ${charInfo.displayName}</b></span>`,
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
		if (!glos) continue;

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

		// umineko truth colors
		if (fileType == 'umineko') {
			const matches = currentLine.matchAll(TRUTH_EXP);

			for (let item of matches) {
				if (!item.index) continue;

				const truthId = Number(item[1]);

				const truthDec = truthArrsText.get(truthId);

				if (!truthDec) continue;

				const range = new vscode.Range(
					new vscode.Position(i, item.index),
					new vscode.Position(i, item.index + item[0].length),
				);

				const decor = {
					range,
				};

				truthDec.push(decor);
			}
		}
		// END OF LOOP
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

	let truthDecor = global.truthDecor.get(activeEditor.document.fileName);
	if (truthDecor) {
		for (let item of truthDecor) item.dispose();
		global.truthDecor.set(activeEditor.document.fileName, []);
	}
	for (let [truthId, _] of truthArrsText) {
		const color = uminekoColoredTexts().get(truthId)!;
		const decoration = vscode.window.createTextEditorDecorationType({
			backgroundColor: color,
		});

		const map = global.truthDecor.get(activeEditor.document.fileName) ?? [];
		map.push(decoration);
		global.truthDecor.set(activeEditor.document.fileName, map);
		activeEditor.setDecorations(decoration, truthArrsText.get(truthId)!);
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
