import { ExtensionContext, commands, window } from 'vscode';
import path from 'path';
import * as fs from 'fs';

import { updateVoicelines } from '../extension';
import { extensionFilePath, isFileExists } from '../utils';

export default function initListen(context: ExtensionContext) {
	let command = commands.registerCommand('witchLove.listen', Command);

	context.subscriptions.push(command);
}

async function Command() {
	if (!activeEditor) return;

	let filename = path.basename(activeEditor.document.fileName, '.txt');
	let datapath = `data/${filename}.json`;
	if (!isFileExists(datapath)) {
		let dirs = path.dirname(activeEditor.document.fileName).split(/\\|\//);
		datapath = `data/${dirs[dirs.length - 1]}/${filename}.json`;
	}

	if (!voicelines) {
		updateVoicelines(extensionFilePath(datapath));
		if (!voicelines) return;
	}

	let line = activeEditor.selection.active.line + 1;

	if (!(voicelines[line] instanceof Array) || !voicelines[line][1]) return;

	let voice_file_path;
	if (filename.includes('umi')) {
		voice_file_path = `${config.paths.umineko}/sound/voice/${voicelines[line][0]}/${voicelines[line][1]}.ogg`;
	} else {
		outer: for (let i = 0; i < config.paths.higurashi.length; i++) {
			for (let j = 1; j <= 10; j++) {
				let ch_data_dir = `HigurashiEp${j
					.toString()
					.padStart(2, '0')}_Data`;

				let check = `${config.paths.higurashi[i]}/${ch_data_dir}/StreamingAssets/voice/${voicelines[line][1]}.ogg`;
				if (fs.existsSync(check)) {
					voice_file_path = check;
					break outer;
				}
			}
		}
	}

	if (!voice_file_path || !fs.existsSync(voice_file_path)) {
		window
			.showErrorMessage(
				`Voice file of line ${line} couldn't found. Make sure you have configured the settings correctly.`,
				'Open Settings',
				'Close'
			)
			.then((select) => {
				if (select == 'Open Settings') {
					commands.executeCommand(
						'workbench.action.openSettings',
						'witchLove.lineListening'
					);
				}
			});
		return;
	}

	let terminal = window.terminals
		.filter((terminal) => terminal.name == 'Listen')
		.at(0);
	if (!terminal) {
		terminal = window.createTerminal('Listen');
	}
	if (voicelines[line][2] && voicelines[line][2] == 'red') {
		terminal.sendText(
			`ffplay -fast -autoexit -nodisp -t 00:02 -volume ${config.listen_volume} "${config.paths.umineko}/sound/se/umise_059.ogg"`
		);
	}
	terminal.sendText(
		`ffplay -fast -autoexit -nodisp -volume ${config.listen_volume} "${voice_file_path}"`
	);
}
