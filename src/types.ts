import { Progress, TextEditorDecorationType } from 'vscode';

export type Character = {
	display_name: string;
	color: string;
	decoration: {
		text?: TextEditorDecorationType;
		icon?: TextEditorDecorationType;
	};
};

export type Config = {
	listen_volume: number;
	hover_width: number;
	line_color_opacity: number;
	paths: {
		umineko: string;
		higurashi: string[];
		characters: string;
		extension: string;
	};
	deepl_key: string;
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
