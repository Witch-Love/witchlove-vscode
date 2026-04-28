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

type ColoredTextConfig = {
	colorHex: string;
	hoverMessage: string;
};

const COLORED_TEXTS = new Map<number, ColoredTextConfig>([
	[
		1,
		{
			colorHex: '#f8524932',
			hoverMessage: 'Kırmızı Gerçek',
		},
	],
	[
		2,
		{
			colorHex: '#494ff83c',
			hoverMessage: 'Mavi Gerçek',
		},
	],
	[
		41,
		{
			colorHex: '#eaf84950',
			hoverMessage: 'Altın Gerçek',
		},
	],
	[
		42,
		{
			colorHex: '#be49f83c',
			hoverMessage: 'Mor Gerçek',
		},
	],
]);

export function uminekoColoredTexts() {
	return COLORED_TEXTS;
}
