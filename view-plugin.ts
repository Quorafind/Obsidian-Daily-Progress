import {
	Decoration,
	DecorationSet,
	EditorView,
	MatchDecorator,
	PluginSpec,
	PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from "@codemirror/view";
import {
	editorLivePreviewField,
	moment,
	setTooltip
} from "obsidian";
import DailyProgressPlugin from "./main";

interface DecoSpec {
	widget?: InlineMaskWidget;
}

function createSpan() {
	return createEl("span");
}

function calculateDailyProgress(timeString: string): number {
	const time = moment(timeString.replace('[', '').replace(']', ''), 'YYYYMMDDHHmmss');
	if (!time.isValid()) {
		throw new Error('Invalid time format');
	}

	// Total seconds in a day
	const totalSecondsInDay = 24 * 60 * 60; // 86400

	// Calculate seconds since start of the day
	const startOfTheDay = time.clone().startOf('day');
	const secondsPassed = time.diff(startOfTheDay, 'seconds');

	// Calculate the daily progress percentage
	const progress = (secondsPassed / totalSecondsInDay) * 100;

	return progress;
}


class InlineMaskWidget extends WidgetType {
	public error = false;
	private container: HTMLElement = createSpan();

	constructor(
		public readonly view: EditorView,
		public readonly plugin: DailyProgressPlugin,
		public readonly timeString: string,
	) {
		super();

		try {
			const progress = calculateDailyProgress(timeString);
			const formatedTime = moment(timeString.replace('[', '').replace(']', ''), 'YYYYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss');
			this.container.createSpan({
				text: `${progress.toFixed(2)}%`,
				cls: 'inline-progress-bar',
				attr: {
					"data-time-string": formatedTime,
					"data-progress": `${progress.toFixed(2)}%`,
					style: `--daily-progress: ${progress.toFixed(2)}%`,
				}
			});
			setTooltip(this.container, formatedTime);
		} catch (error) {
			console.error(error);
		}

	}

	eq(widget: WidgetType): boolean {
		return (widget as InlineMaskWidget).timeString === this.timeString;
	}

	toDOM(): HTMLElement {
		return this.container;
	}
}

export function createInlineDailyProgressPlugin(_plugin: DailyProgressPlugin) {
	class InlineViewPluginValue implements PluginValue {
		public readonly view: EditorView;
		private readonly match = new MatchDecorator({
			regexp: /\[?\d{14}\]?/g,
			decorate: (add, from: number, to: number, match: RegExpExecArray, view: EditorView) => {
				const shouldRender = this.shouldRender(view, from, to);
				if (shouldRender) {
					add(
						from,
						to,
						Decoration.replace({
							widget: new InlineMaskWidget(view, _plugin, match[0]),
						}),
					);
				}
			},
		});
		decorations: DecorationSet = Decoration.none;

		constructor(view: EditorView) {
			this.view = view;
			this.updateDecorations(view);
		}

		update(update: ViewUpdate): void {
			this.updateDecorations(update.view, update);
		}

		destroy(): void {
			this.decorations = Decoration.none;
		}

		updateDecorations(view: EditorView, update?: ViewUpdate) {
			if (!update || this.decorations.size === 0) {
				this.decorations = this.match.createDeco(view);
			} else {
				this.decorations = this.match.updateDeco(update, this.decorations);
			}
		}

		isLivePreview(state: EditorView["state"]): boolean {
			return state.field(editorLivePreviewField);
		}

		shouldRender(view: EditorView, decorationFrom: number, decorationTo: number) {
			const overlap = view.state.selection.ranges.some((r) => {
				if (r.from <= decorationFrom) {
					return r.to >= decorationFrom;
				} else {
					return r.from <= decorationTo;
				}
			});
			return !overlap && this.isLivePreview(view.state);
		}
	}

	const InlineViewPluginSpec: PluginSpec<InlineViewPluginValue> = {
		decorations: (plugin) => {
			// Update and return decorations for the CodeMirror view

			return plugin.decorations.update({
				filter: (rangeFrom: number, rangeTo: number, deco: Decoration) => {
					const widget = (deco.spec as DecoSpec).widget;
					if (widget && widget.error) {
						console.log("GOT WIDGET ERROR");
						return false;
					}
					// Check if the range is collapsed (cursor position)
					return (
						rangeFrom === rangeTo ||
						// Check if there are no overlapping selection ranges
						!plugin.view.state.selection.ranges.filter((selectionRange: { from: number; to: number; }) => {
							// Determine the start and end positions of the selection range
							const selectionStart = selectionRange.from;
							const selectionEnd = selectionRange.to;

							// Check if the selection range overlaps with the specified range
							if (selectionStart <= rangeFrom) {
								return selectionEnd >= rangeFrom; // Overlapping condition
							} else {
								return selectionStart <= rangeTo; // Overlapping condition
							}
						}).length
					);
				},
			});
		},
	};

	return ViewPlugin.fromClass(InlineViewPluginValue, InlineViewPluginSpec);
}
