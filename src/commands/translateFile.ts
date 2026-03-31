import { Translator } from 'deepl-node';
import * as fs from 'fs';
import path from 'path';
import { commands, ExtensionContext, window } from 'vscode';
import { disposableNotification } from '../utils';

export default function initTranslateFile(context: ExtensionContext) {
	let cmd = commands.registerCommand('witchLove.translateFile', command);

	context.subscriptions.push(cmd);
}

async function command() {
	if (!activeEditor) return;

	if (activeEditor.document.getText().length == 0) return;

	// filePath		->		.....\umineko-scripting-tr\story\ep1\en\umi1_2.txt
	// newFilePath	->		.....\umineko-scripting-tr\story\ep1\en\umi1_2_t.txt
	// base			->		umi1_2.txt
	// dir			->		.....\umineko-scripting-tr\story\ep1\en
	// ext			->		.txt
	// name			->		umi1_2
	const filePath = activeEditor.document.fileName;
	const { base, dir, ext, name } = path.parse(filePath);
	const newFilePath = path.join(dir, name + '_t' + ext);

	let action = await window.showInformationMessage(
		`Translate the file "${base}"? Depending on the file length, this may take a while.\nProceed?`,
		'Translate',
		'Cancel',
	);
	if (action != 'Translate') return;

	let notification = disposableNotification('Translating...');

	try {
		const result = await translateFile(filePath, newFilePath);

		notification.close();

		if (result.ok()) {
			window.showInformationMessage(
				`Translated!\n${newFilePath}`,
				'Close',
			);
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

async function translateFile(inputPath: string, outputPath: string) {
	const translator = new Translator(config.deeplKey);

	const usage = await translator.getUsage();
	const usageChar = usage.character;

	if (usageChar) {
		console.log(`DeepL Usage: ${usageChar.count}/${usageChar.limit}`);
	}

	if (usageChar?.limitReached()) {
		throw new Error('DeepL character usage translation limit reached!');
	}

	if (fs.existsSync(outputPath)) {
		fs.unlinkSync(outputPath);
	}

	return await translator.translateDocument(
		inputPath,
		outputPath,
		'en',
		'tr',
		{
			enableDocumentMinification: false,
			glossary: config.deeplGlossary,
		},
	);
}
