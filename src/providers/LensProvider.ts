import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import path from 'path';

import { extensionFilePath } from '../utils';
import { LensData } from '../types';

export default class LensProvider implements vscode.CodeLensProvider {
	private codeLenses: vscode.CodeLens[] = [];
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
		new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> =
		this._onDidChangeCodeLenses.event;

	constructor() {}

	public provideCodeLenses(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
	): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		this.codeLenses = [];

		let data: LensData = JSON.parse(
			readFileSync(extensionFilePath('lens_data.json'), 'utf-8')
		);

		let filename = path.basename(document.fileName, '.txt');
		let obj = data[filename];

		if (obj) {
			for (let item of obj) {
				let range_start = new vscode.Range(
					new vscode.Position(item.start - 1, 0),
					new vscode.Position(item.start - 1, 0)
				);

				let start = new vscode.CodeLens(range_start);
				start.command = {
					title: `▼ ${item.title} ▼`,
					tooltip: item.tooltip,
					command: '',
				};

				this.codeLenses.push(start);

				if (item.end) {
					let range_end = new vscode.Range(
						new vscode.Position(item.end, 0),
						new vscode.Position(item.end, 0)
					);

					let end = new vscode.CodeLens(range_end);

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
