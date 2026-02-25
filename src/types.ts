import { Progress, TextEditorDecorationType } from 'vscode';

export type Character = {
	displayName: string;
	color: string;
	decoration: {
		text?: TextEditorDecorationType;
		icon?: TextEditorDecorationType;
	};
};

export type Config = {
	onlineToken: string;
	listenVolume: number;
	hoverWidth: number;
	lineColorOpacity: number;
	paths: {
		voiceFiles: string;
		characters: string;
		extension: string;
	};
	deeplKey: string;
	deeplNotification: boolean;
};

export type Notification = {
	close: () => void;
	progress?: Progress<{
		message?: string | undefined;
		increment?: number | undefined;
	}>;
	token?: CallableFunction;
};

export type LensData = {
	[file_name: string]: LensItem[];
};

type LensItem = {
	title: string;
	tooltip?: string;
	start: number;
	end?: number;
};
