import * as fs from 'fs';
import path from 'path';
import { ExtensionContext, commands, window } from 'vscode';

import { exec } from 'child_process';
import { updateVoicelines } from '../extension';
import {
	checkFFmpegInstallation,
	extensionFilePath,
	getDataDir,
	getTLFileType,
} from '../utils';

let isFFmpegInstalled = false;

export default async function initListen(context: ExtensionContext) {
	const cmd = commands.registerCommand('witchLove.listen', command);

	isFFmpegInstalled = await checkFFmpegInstallation();

	context.subscriptions.push(cmd);
}

async function command() {
	if (!activeEditor) return;

	const filename = path.basename(activeEditor.document.fileName, '.txt');
	const fileType = getTLFileType(activeEditor.document.fileName);
	if (!fileType) return;
	const dataDir = getDataDir(fileType);
	let dataPath;
	if (fileType == 'umineko') {
		dataPath = `${dataDir}/${filename}.json`;
	} else if (fileType == 'higurashi') {
		let dirs = path.dirname(activeEditor.document.fileName).split(/\\|\//);
		dataPath = `${dataDir}/${dirs[dirs.length - 1]}/${filename}.json`;
	}

	if (!voicelines) {
		if (dataPath) updateVoicelines(extensionFilePath(dataPath));
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

	const listenOnline = config.listenOnline;

	const basePath = listenOnline
		? 'https://cdn.witch-love.com/sounds'
		: config.paths.voiceFiles;

	let voiceFilePath = `${basePath}/${fileType}/sound/voice/`;

	if (fileType == 'umineko') {
		voiceFilePath += `${voicelines[line][0]}/${voicelines[line][1]}.ogg`;
	} else if (fileType == 'higurashi') {
		voiceFilePath += `${voicelines[line][1]}.ogg`;
	}

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

	if (voicelines[line][2] && voicelines[line][2] == 'red') {
		playAudio(`${basePath}/umineko/sound/se/umise_059.ogg`, [
			'-t',
			'00:02',
		]);
	}

	playAudio(voiceFilePath);
	console.log('Played audio: ', voiceFilePath);
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
