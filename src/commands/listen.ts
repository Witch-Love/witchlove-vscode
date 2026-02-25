import * as fs from 'fs';
import path from 'path';
import { ExtensionContext, commands, window } from 'vscode';

import { exec } from 'child_process';
import { updateVoicelines } from '../extension';
import {
	checkFFmpegInstallation,
	extensionFilePath,
	isFileExists,
} from '../utils';

let isFFmpegInstalled = false;

export default async function initListen(context: ExtensionContext) {
	const cmd = commands.registerCommand('witchLove.listen', command);

	isFFmpegInstalled = await checkFFmpegInstallation();

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
			'FFmpeg is not installed. In order to listen lines, you need to install ffmpeg.\nPlease restart VS Code after the installation.',
			'Check Again',
			'Close',
		);
		if (selection === 'Check Again') {
			let status = await checkFFmpegInstallation();
			if (status) {
				window.showInformationMessage('Ffmpeg installed!');
			}
			commands.executeCommand('witchLove.listen');
		}
		return;
	}

	const listenOnline = config.onlineToken.length > 0;

	const isUmi = filename.includes('umi');
	const basePath = listenOnline
		? 'https://cdn.witch-love.com/p'
		: config.paths.voiceFiles;

	const voiceFilePath = isUmi
		? `${basePath}/umineko/sound/voice/${voicelines[line][0]}/${voicelines[line][1]}.ogg`
		: `${basePath}/higurashi/sound/voice/${voicelines[line][1]}.ogg`;

	if (!voiceFilePath || (!listenOnline && !fs.existsSync(voiceFilePath))) {
		window
			.showErrorMessage(
				`Voice file of line ${line} couldn't found. Make sure you have configured the settings correctly.`,
				'Open Settings',
				'Close',
			)
			.then((select) => {
				if (select == 'Open Settings') {
					commands.executeCommand(
						'workbench.action.openSettings',
						'witchLove.lineListening',
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
			const warns = stderr.split('\n');
			for (const warn of warns) {
				if (warn.includes('CRLF') || warn.length < 5) continue;

				window.showErrorMessage('An error occurred: ' + warn);
			}
		}
	});
}
