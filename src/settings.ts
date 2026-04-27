import { ExtensionContext, workspace } from 'vscode';

/**
 * Sets the config settings (init or reload)
 * @param context
 */
export function loadSettings(context: ExtensionContext) {
	const conf = workspace.getConfiguration('witchLove');

	// UPDATE SETTINGS
	global.config = {
		hoverWidth: conf.get<number>('hoverWidth')!,
		lineColorOpacity: conf.get<number>('lineColorOpacity')!,
		paths: {
			characters: context.asAbsolutePath('characters.json'),
			voiceFiles: conf.get<string>('lineListening.voiceFilesDirectory')!,
			extension: context.extensionPath,
		},
		onlineToken: conf.get<string>('lineListening.onlineToken')!,
		listenVolume: conf.get<number>('lineListening.volume')!,
		deeplKey: conf.get<string>('deepl.deeplKey')!,
		deeplNotification:
			conf.get<string>('deepl.translateNotification')! == 'Yes',
	};
}

export function uminekoColoredTexts() {
	return new Map<number, string>([
		[1, '#f8524932'],
		[2, '#494ff83c'],
		[41, '#eaf84950'],
		[42, '#be49f83c'],
	]);
}
