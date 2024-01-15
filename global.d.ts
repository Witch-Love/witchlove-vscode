import { StatusBarItem, TextEditor, TextEditorDecorationType } from 'vscode';

import { Character, Config } from './src/types';

export {};

declare global {
	namespace globalThis {
		var activeEditor: TextEditor | undefined;
		var characters: Map<string, Character>;
		var glossary: {
			higurashi: { [key: string]: string };
			umineko: { [key: string]: string };
		};
		var glossaryDecor: TextEditorDecorationType | undefined;
		var voicelines:
			| {
					[key: string]: string[];
			  }
			| undefined;
		var config: Config;
		var statusbarItem: StatusBarItem;
		var translatebarItem: StatusBarItem;
	}
}
