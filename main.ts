import {
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	moment,
	Plugin,
	TFile
} from 'obsidian';
import { createInlineDailyProgressPlugin } from "./view-plugin";

export default class DailyProgressPlugin extends Plugin {

	async onload() {
		this.registerEditorExtension([createInlineDailyProgressPlugin(this)]);
		this.addCommand({
			id: 'insert-time-stamp',
			name: 'Insert time stamp',
			editorCallback: (editor) => {
				editor.replaceSelection(moment().format('YYYYMMDDHHmmss'));
			}
		});
	}

	onunload() {

	}

}
