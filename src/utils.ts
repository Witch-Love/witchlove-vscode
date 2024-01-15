import * as random from 'random-seed';
import * as fs from 'fs';
import * as Jimp from 'jimp';
import { ColorActionName } from '@jimp/plugin-color';
import { ProgressLocation, window } from 'vscode';

import { Notification } from './types';

export function getSeededColor(key: string) {
	return (
		'#' +
		((random.create(key).random() * 0xffffff) << 0)
			.toString(16)
			.padStart(6, '0')
	);
}

export async function generateColorImage(key: string) {
	if (hasColorImage(key)) return Promise.resolve('');

	let path = getColorPath(key);

	let char = characters.get(key);
	if (!char) return;

	let rgba = Jimp.intToRGBA(Jimp.cssColorToHex(char.color));
	try {
		return new Promise(function (resolve) {
			Jimp.read(getBlankColorPath()).then((img) => {
				img.color([
					{ apply: ColorActionName.RED, params: [rgba.r] },
					{ apply: ColorActionName.GREEN, params: [rgba.g] },
					{ apply: ColorActionName.BLUE, params: [rgba.b] },
				]).write(path);

				setTimeout(() => {
					resolve('');
				}, 10);
			});
		});
	} catch (err) {
		console.error(err);
	}
}

function hasColorImage(name: string) {
	return fs.existsSync(config.paths.extension + `/colors/${name}.png`);
}

function getBlankColorPath() {
	return config.paths.extension + '/img/color_blank.png';
}

function getColorPath(name: string) {
	return config.paths.extension + `/colors/${name}.png`;
}

export function generateDecoration(key: string) {
	let path = hasColorImage(key) ? getColorPath(key) : getBlankColorPath();

	const decorationText = window.createTextEditorDecorationType({
		isWholeLine: false,
	});

	const decorationIcon = window.createTextEditorDecorationType({
		gutterIconPath: path,
		gutterIconSize: '87.5%',
		isWholeLine: true,
		backgroundColor:
			characters.get(key)?.color +
			config.line_color_opacity.toString(16).padStart(2, '0'),
	});
	return {
		text: decorationText,
		icon: decorationIcon,
	};
}

/**
 *
 * @param text Notification content
 * @returns The notification object
 */
export function DisposableNotification(text: string): Notification {
	let closeNotification = () => {};
	let token_ = undefined;
	let progress_ = undefined;

	window.withProgress(
		{
			location: ProgressLocation.Notification,
			title: text,
			cancellable: true,
		},
		(progress, token) => {
			return new Promise<void>((resolve) => {
				closeNotification = resolve;
				token_ = token;
				progress_ = progress;
			});
		}
	);
	return {
		close: closeNotification,
		progress: progress_,
		token: token_,
	};
}

/**
 * Returns the absolute path of the file respect to the extension's folder.
 * @param path Path to the file inside the extension folder.
 * Example: `data/data/file.json`
 * @returns The absolute path of the file.
 * Example: `C:/.../data/data/file.json`
 *
 */
export function extensionFilePath(path: string) {
	return config.paths.extension + '/' + path;
}

/**
 *
 * @param path File path relative to the extension's folder. Example: `data/data/file.txt`
 * @returns `true` if the file exists, `false` otherwise.
 */
export function isFileExists(path: string): boolean {
	let absolute_path = extensionFilePath(path);

	return fs.existsSync(absolute_path);
}
