import ncp from 'copy-paste';
import { Translator } from 'deepl-node';
import { ExtensionContext, Range, commands, window } from 'vscode';

import { disposableNotification } from '../utils';

export default function initTranslate(context: ExtensionContext) {
	let cmd = commands.registerCommand('witchLove.translate', command);

	context.subscriptions.push(cmd);
}

async function command() {
	if (!activeEditor) return;

	if (config.deeplKey.length == 0) {
		let action = await window.showWarningMessage(
			'DeepL API key required for this action.',
			'Open Settings',
			'Close',
		);
		if (action == 'Open Settings') {
			commands.executeCommand(
				'workbench.action.openSettings',
				'witchLove.deepl',
			);
		}
		return;
	}

	let selections = activeEditor.selections;

	if (!selections || selections.length == 0) return;

	let texts: string[] = [];
	for (let i = 0; i < selections.length; i++) {
		let item = selections[i];
		const range = new Range(
			item.start.line,
			item.start.character,
			item.end.line,
			item.end.character,
		);

		let select = activeEditor.document.getText(range);
		select = select.replaceAll('`', '');
		if (select.at(0) == ' ') {
			select = select.substring(1);
		}
		if (select.at(select.length - 1) == ' ') {
			select = select.substring(0, select.length - 1);
		}

		texts.push(select);
	}

	let finalText = texts.join(' ');

	if (finalText.length == 0) return;

	let notification = disposableNotification('Translating...');

	const translator = new Translator(config.deeplKey);

	try {
		const usage = await translator.getUsage();

		if (usage.anyLimitReached()) {
			throw new Error('DeepL usage limit reached!');
		}

		const result = await translator.translateText(finalText, 'en', 'tr', {
			modelType: 'quality_optimized',
			glossary: config.deeplGlossary,
		});

		ncp.copy(result.text);
		notification.close();

		if (config.deeplNotification) {
			window.showInformationMessage(result.text, 'Close');
		}
	} catch (error) {
		notification.close();

		if (!(error instanceof Error)) return;

		if (error.message.includes('check auth_key')) {
			let action = await window.showErrorMessage(
				'DeepL API key is not correct, please check your key.',
				'Open Settings',
				'Close',
			);
			if (action == 'Open Settings') {
				commands.executeCommand(
					'workbench.action.openSettings',
					'witchLove.deepl',
				);
			}
		} else {
			window.showErrorMessage(error.message, 'Close');
		}
	}
}
