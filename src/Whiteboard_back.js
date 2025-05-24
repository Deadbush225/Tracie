import { writable, get } from "svelte/store";

export let nextId = 3; // Start from 3 to account for the initial components

// Command Pattern for undo/redo
// Each command should have execute() and undo() methods
export const commandHistory = writable({
	undoStack: [],
	redoStack: [],
});

export const components = writable([]);
export const links = writable([]);

// Maximum commands to keep in history
const MAX_HISTORY = 100;

// Command execution with history tracking
function executeCommand(command) {
	// Execute the command
	command.execute();

	// Add to undo stack
	commandHistory.update((history) => {
		const newUndoStack = [...history.undoStack, command].slice(-MAX_HISTORY);
		return {
			undoStack: newUndoStack,
			redoStack: [], // Clear redo stack on new command
		};
	});
}

// Undo the most recent command
export function undo() {
	commandHistory.update((history) => {
		if (history.undoStack.length === 0) return history;

		const command = history.undoStack[history.undoStack.length - 1];
		command.undo();

		return {
			undoStack: history.undoStack.slice(0, -1),
			redoStack: [command, ...history.redoStack],
		};
	});
}

// Redo the most recently undone command
export function redo() {
	commandHistory.update((history) => {
		if (history.redoStack.length === 0) return history;

		const command = history.redoStack[0];
		command.execute();

		return {
			undoStack: [...history.undoStack, command],
			redoStack: history.redoStack.slice(1),
		};
	});
}

// Command Implementations

// Add Component Command
class AddComponentCommand {
	constructor(component) {
		this.component = component;
	}

	execute() {
		components.update((comps) => [...comps, this.component]);
	}

	undo() {
		components.update((comps) => comps.filter((c) => c.id !== this.component.id));
	}
}

// Delete Component Command
class DeleteComponentCommand {
	constructor(componentId) {
		// Store the component and its links before deletion
		this.componentId = componentId;
		this.component = get(components).find((c) => c.id === componentId);
		this.affectedLinks = get(links).filter((l) => l.from.componentId === componentId || l.to.componentId === componentId);
	}

	execute() {
		components.update((comps) => comps.filter((c) => c.id !== this.componentId));
		links.update((ls) => ls.filter((l) => l.from.componentId !== this.componentId && l.to.componentId !== this.componentId));
	}

	undo() {
		components.update((comps) => [...comps, this.component]);
		links.update((ls) => [...ls, ...this.affectedLinks]);
	}
}

// Move Component Command
class MoveComponentCommand {
	constructor(componentId, dx, dy) {
		this.componentId = componentId;
		this.dx = dx;
		this.dy = dy;
	}

	execute() {
		components.update((comps) =>
			comps.map((comp) => {
				if (comp.id === this.componentId) {
					return { ...comp, x: comp.x + this.dx, y: comp.y + this.dy };
				}
				return comp;
			})
		);
	}

	undo() {
		components.update((comps) =>
			comps.map((comp) => {
				if (comp.id === this.componentId) {
					return { ...comp, x: comp.x - this.dx, y: comp.y - this.dy };
				}
				return comp;
			})
		);
	}
}

// Move Multiple Components Command
class MoveMultipleComponentsCommand {
	constructor(componentIds, dx, dy) {
		this.componentIds = componentIds;
		this.dx = dx;
		this.dy = dy;
	}

	execute() {
		components.update((comps) =>
			comps.map((comp) => {
				if (this.componentIds.includes(comp.id)) {
					return { ...comp, x: comp.x + this.dx, y: comp.y + this.dy };
				}
				return comp;
			})
		);
	}

	undo() {
		components.update((comps) =>
			comps.map((comp) => {
				if (this.componentIds.includes(comp.id)) {
					return { ...comp, x: comp.x - this.dx, y: comp.y - this.dy };
				}
				return comp;
			})
		);
	}
}

// Create Link Command
class CreateLinkCommand {
	constructor(link) {
		this.link = link;
	}

	execute() {
		links.update((ls) => [...ls, this.link]);
	}

	undo() {
		links.update((ls) => ls.filter((l) => l !== this.link));
	}
}

// Delete Link Command
class DeleteLinkCommand {
	constructor(link) {
		this.link = link;
	}

	execute() {
		links.update((ls) => ls.filter((l) => l !== this.link));
	}

	undo() {
		links.update((ls) => [...ls, this.link]);
	}
}

// Duplicate Component Command
class DuplicateComponentCommand {
	constructor(originalId, newComponent) {
		this.originalId = originalId;
		this.newComponent = newComponent;
	}

	execute() {
		components.update((comps) => [...comps, this.newComponent]);
		return this.newComponent.id;
	}

	undo() {
		components.update((comps) => comps.filter((c) => c.id !== this.newComponent.id));
	}
}

// Public API commands that create and execute appropriate commands

export function addArrayComponent() {
	const len = parseInt(prompt("Enter array length:"), 10);
	if (isNaN(len) || len < 1) return;

	const component = {
		id: nextId++,
		type: "array",
		x: 100,
		y: 100,
		length: len,
	};

	executeCommand(new AddComponentCommand(component));
}

export function add2DTableComponent() {
	const rows = parseInt(prompt("Enter table rows length:"), 10);
	if (isNaN(rows) || rows < 1) return;
	const cols = parseInt(prompt("Enter table cols:"), 10);
	if (isNaN(cols) || cols < 1) return;

	const component = {
		id: nextId++,
		type: "2darray",
		x: 100,
		y: 100,
		rows,
		cols,
	};

	executeCommand(new AddComponentCommand(component));
}

export function addPointerComponent() {
	const name = prompt("Enter Pointer name:");
	if (name === null || name === "") return;

	const component = {
		id: nextId++,
		type: "pointer",
		x: 100,
		y: 100,
		value: name,
	};

	executeCommand(new AddComponentCommand(component));
}

export function deleteComponent(id) {
	executeCommand(new DeleteComponentCommand(id));
}

export function moveComponent(id, dx, dy) {
	executeCommand(new MoveComponentCommand(id, dx, dy));
}

export function moveMultipleComponents(ids, dx, dy) {
	executeCommand(new MoveMultipleComponentsCommand(ids, dx, dy));
}

export function duplicateComponent(id, offsetX = 20, offsetY = 20) {
	const original = get(components).find((c) => c.id === id);
	if (!original) return null;

	const copy = {
		...original,
		id: nextId++,
		x: original.x + offsetX,
		y: original.y + offsetY,
	};

	const command = new DuplicateComponentCommand(id, copy);
	executeCommand(command);
	return copy.id;
}

export function createLink(fromNode, toNode) {
	if (!fromNode || !toNode) return;

	const link = {
		from: fromNode,
		to: toNode,
		color:
			"#" +
			Math.floor(Math.random() * 0xffffff)
				.toString(16)
				.padStart(6, "0"),
	};

	executeCommand(new CreateLinkCommand(link));
	return link;
}

export function deleteLink(link) {
	executeCommand(new DeleteLinkCommand(link));
}

// Initialize with some demo components
components.set([
	{
		id: 1,
		type: "array",
		x: 100,
		y: 100,
		length: 4,
	},
	{
		id: 2,
		type: "2darray",
		x: 200,
		y: 300,
		rows: 4,
		cols: 4,
	},
]);
