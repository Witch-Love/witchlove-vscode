import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import * as vscode from 'vscode';

import { LensData } from '../types';
import { extensionFilePath, fetchFileText } from '../utils';

export default class LensProvider implements vscode.CodeLensProvider {
	private codeLenses: vscode.CodeLens[] = [];
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
		new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> =
		this._onDidChangeCodeLenses.event;

	constructor() {}

	public provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken,
	): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		this.codeLenses = [];

		let data: LensData = JSON.parse(
			readFileSync(extensionFilePath('lens_data.json'), 'utf-8'),
		);

		let filename = path.basename(document.fileName, '.txt');
		let obj = data[filename];

		if (obj) {
			for (let item of obj) {
				let rangeStart = new vscode.Range(
					new vscode.Position(item.start - 1, 0),
					new vscode.Position(item.start - 1, 0),
				);

				let start = new vscode.CodeLens(rangeStart);
				start.command = {
					title: `▼ ${item.title} ▼`,
					tooltip: item.tooltip,
					command: '',
				};

				this.codeLenses.push(start);

				if (item.end) {
					let rangeEnd = new vscode.Range(
						new vscode.Position(item.end, 0),
						new vscode.Position(item.end, 0),
					);

					let end = new vscode.CodeLens(rangeEnd);

					end.command = {
						title: `▲ ${item.title} ▲`,
						tooltip: item.tooltip,
						command: '',
					};

					this.codeLenses.push(end);
				}
			}
		}

		return this.codeLenses;
	}
}

export async function initLens() {
	let res = await fetchFileText(
		'https://gist.githubusercontent.com/Singulariity/0b41a4872b8039204b1450b5485c894a/raw/lens_data.json',
	);

	if (!res) return;

	writeFileSync(extensionFilePath('lens_data.json'), res, {
		encoding: 'utf-8',
	});
}
