import { ExtensionContext, Range, commands, window } from 'vscode';
import { Translator } from 'deepl-node';
import ncp from 'copy-paste';

import { DisposableNotification } from '../utils';

export default function initTranslate(context: ExtensionContext) {
	let command = commands.registerCommand('witchLove.translate', Command);

	context.subscriptions.push(command);
}

async function Command() {
	if (!activeEditor) return;

	if (config.deepl_key.length == 0) {
		let action = await window.showWarningMessage(
			'DeepL API key required for this action.',
			'Open Settings',
			'Close'
		);
		if (action == 'Open Settings') {
			commands.executeCommand(
				'workbench.action.openSettings',
				'witchLove.deepl'
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
			item.end.character
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

	let final_text = texts.join(' ');

	if (final_text.length == 0) return;

	let notification = DisposableNotification('Translating...');

	let translator = new Translator(config.deepl_key);

	try {
		const usage = await translator.getUsage();

		if (usage.anyLimitReached()) {
			throw new Error('DeepL usage limit reached!');
		}

		const result = await translator.translateText(
			final_text,
			'en',
			'tr',
			{}
		);

		ncp.copy(result.text);
		notification.close();
	} catch (error) {
		notification.close();

		if (!(error instanceof Error)) return;

		if (error.message.includes('check auth_key')) {
			let action = await window.showErrorMessage(
				'DeepL API key is not correct, please check your key.',
				'Open Settings',
				'Close'
			);
			if (action == 'Open Settings') {
				commands.executeCommand(
					'workbench.action.openSettings',
					'witchLove.deepl'
				);
			}
		} else {
			window.showErrorMessage(error.message, 'Close');
		}
	}
}
