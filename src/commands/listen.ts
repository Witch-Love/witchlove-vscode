import * as fs from 'fs';
import path from 'path';
import { ExtensionContext, commands, window } from 'vscode';

import { exec } from 'child_process';
import { updateVoicelines } from '../extension';
import {
	checkFFmpegInstallation,
	checkOnlineTokenValidity,
	extensionFilePath,
	isFileExists,
} from '../utils';

let isFFmpegInstalled = false;
let isOnlineTokenValid = false;

export default async function initListen(context: ExtensionContext) {
	const cmd = commands.registerCommand('witchLove.listen', command);

	isFFmpegInstalled = await checkFFmpegInstallation();
	isOnlineTokenValid = await checkOnlineTokenValidity();

	context.subscriptions.push(cmd);
}

async function command() {
	if (!activeEditor) return;

	let filename = path.basename(activeEditor.document.fileName, '.txt');
	let datapath = `data/data/${filename}.json`;
	if (!isFileExists(datapath)) {
		let dirs = path.dirname(activeEditor.document.fileName).split(/\\|\//);
		datapath = `data/data/${dirs[dirs.length - 1]}/${filename}.json`;
	}
	if (!voicelines) {
		updateVoicelines(extensionFilePath(datapath));
		if (!voicelines) return;
	}

	let line = activeEditor.selection.active.line + 1;

	if (!(voicelines[line] instanceof Array) || !voicelines[line][1]) return;

	// COMMAND PART BELOW
	// COMMAND PART BELOW
	// COMMAND PART BELOW
	// COMMAND PART BELOW
	// COMMAND PART BELOW
	// COMMAND PART BELOW

	if (!isFFmpegInstalled) {
		let selection = await window.showWarningMessage(
			'FFmpeg is not installed. In order to listen lines, you need to install ffmpeg.\nPlease restart VS Code after the installation or use the button to check again.',
			'Check Again',
			'Close',
		);
		if (selection === 'Check Again') {
			isFFmpegInstalled = await checkFFmpegInstallation();
			if (isFFmpegInstalled) {
				window.showInformationMessage('Ffmpeg installed!');
			}
			commands.executeCommand('witchLove.listen');
		}
		return;
	}

	const listenOnline = config.onlineToken.length > 0;

	if (listenOnline && !isOnlineTokenValid) {
		let selection = await window.showWarningMessage(
			'Your online token is not valid. In order to listen lines without downloading you have to enter a valid token.\nPlease restart VS Code after changing the token or use the button to check again.',
			'Check Again',
			'Configure Token',
			'Close',
		);
		if (selection === 'Check Again') {
			isOnlineTokenValid = await checkOnlineTokenValidity();
			if (isOnlineTokenValid) {
				window.showInformationMessage('Your online token is valid!');
			}
			commands.executeCommand('witchLove.listen');
		} else if (selection === 'Configure Token') {
			commands.executeCommand(
				'workbench.action.openSettings',
				'witchLove.lineListening.onlineToken',
			);
		}
		return;
	}

	const isUmi = filename.includes('umi');
	const basePath = listenOnline
		? 'https://cdn.witch-love.com/p'
		: config.paths.voiceFiles;

	const voiceFilePath = isUmi
		? `${basePath}/umineko/sound/voice/${voicelines[line][0]}/${voicelines[line][1]}.ogg`
		: `${basePath}/higurashi/sound/voice/${voicelines[line][1]}.ogg`;

	if (!listenOnline && !fs.existsSync(voiceFilePath)) {
		window
			.showWarningMessage(
				`Voice file of ${line} not found on the local path. Make sure you have configured the settings correctly.`,
				'Configure Voice Files Path',
				'Close',
			)
			.then((select) => {
				if (select == 'Configure Voice Files Path') {
					commands.executeCommand(
						'workbench.action.openSettings',
						'witchLove.lineListening.voiceFilesDirectory',
					);
				}
			});
		return;
	}

	const EXTRA_ARGS = listenOnline
		? ['-headers', `"Authorization: Bearer ${config.onlineToken}"`]
		: [];

	if (voicelines[line][2] && voicelines[line][2] == 'red') {
		playAudio(`${basePath}/umineko/sound/se/umise_059.ogg`, [
			...EXTRA_ARGS,
			'-t',
			'00:02',
		]);
	}

	playAudio(voiceFilePath, EXTRA_ARGS);
}

function playAudio(filePath: string, extraArgs: string[] = []) {
	const baseArgs = [
		'-fast',
		'-autoexit',
		'-nodisp',
		'-nostats',
		'-hide_banner',
		'-loglevel',
		'error',
		'-volume',
		String(config.listenVolume),
		...extraArgs,
		`"${filePath}"`,
	];

	exec(['ffplay', ...baseArgs].join(' '), (error, _, stderr) => {
		if (error) {
			window.showErrorMessage('An error occurred: ' + error);
		}
		if (stderr) {
			window.showErrorMessage('An error occurred: ' + stderr);
		}
	});
}
