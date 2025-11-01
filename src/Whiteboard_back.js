import { writable, get } from "svelte/store";
import { svgRect } from "./ui_store";

export let nextId = 10; // Start from 3 to account for the initial components

// Command Pattern for undo/redo
// Each command should have execute() and undo() methods
export const commandHistory = writable({
	undoStack: [],
	redoStack: [],
});

export const components = writable([]);
export const links = writable([]);

// Developer console helpers
// Call `listComponents()` in the browser console to print a table of components
if (typeof window !== "undefined") {
	window.listComponents = () => {
		const comps = get(components);
		try {
			console.table(
				comps.map((c) => ({
					id: c.id,
					type: c.type,
					x: c.x,
					y: c.y,
					name: c.name || c.value || "",
				}))
			);
		} catch (err) {
			console.log("Components:", comps);
		}
		return comps;
	};

	window.listLinks = () => {
		const link = get(links);
		try {
			console.table(
				link.map((l) => ({
					from: l.from,
					to: l.to,
					type: l.type,
				}))
			);
		} catch (err) {
			console.log("Links:", link);
		}
		return link;
	};

	// Expose the raw Svelte store for advanced inspection/manipulation
	window.__componentsStore = components;
}

/* ---------------------------------------------------------------- */

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

// Add Component Command
class AddComponentCommand {
	constructor(component) {
		this.component = component;
	}

	execute() {
		components.update((comps) => [...comps, this.component]);
	}

	undo() {
		components.update((comps) =>
			comps.filter((c) => c.id !== this.component.id)
		);
	}
}

// Delete Component Command
class DeleteComponentCommand {
	constructor(componentId) {
		// Store the component and its links before deletion
		this.componentId = componentId;
		this.component = get(components).find((c) => c.id === componentId);
		this.affectedLinks = get(links).filter(
			(l) =>
				l.from.componentId === componentId || l.to.componentId === componentId
		);
	}

	execute() {
		components.update((comps) =>
			comps.filter((c) => c.id !== this.componentId)
		);
		links.update((ls) =>
			ls.filter(
				(l) =>
					l.from.componentId !== this.componentId &&
					l.to.componentId !== this.componentId
			)
		);
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
		this.doNotRunYet = true;
	}

	execute() {
		if (this.doNotRunYet) {
			this.doNotRunYet = false;
		} else {
			components.update((comps) =>
				comps.map((comp) => {
					if (comp.id === this.componentId) {
						return { ...comp, x: comp.x + this.dx, y: comp.y + this.dy };
					}
					return comp;
				})
			);
		}
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
		this.doNotRunYet = true;
	}

	execute() {
		if (this.doNotRunYet) {
			this.doNotRunYet = false;
		} else {
			components.update((comps) =>
				comps.map((comp) => {
					if (this.componentIds.includes(comp.id)) {
						return { ...comp, x: comp.x + this.dx, y: comp.y + this.dy };
					}
					return comp;
				})
			);
		}
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
		// Store component info to update linkedArrays
		this.fromCompType = getComponentType(link.from.componentId);
		this.toCompType = getComponentType(link.to.componentId);
	}

	execute() {
		links.update((ls) => [...ls, this.link]);
		// Add to linkedArrays

		// Notify iterators that a link was created
		const event = new CustomEvent("iterator-link-created", {
			detail: {
				fromId: this.link.from.componentId,
				toId: this.link.to.componentId,
			},
		});
		window.dispatchEvent(event);

		this.updateLinkedArrays(true);
	}

	undo() {
		links.update((ls) => ls.filter((l) => l !== this.link));
		// Remove from linkedArrays
		this.updateLinkedArrays(false);
		this.notifyLinkDeleted();
	}

	updateLinkedArrays(isAdd) {
		components.update((comps) => {
			return comps.map((comp) => {
				if (
					(comp.id === this.link.from.componentId &&
						comp.type === "iterator" &&
						isArrayType(this.toCompType)) ||
					(comp.id === this.link.to.componentId &&
						comp.type === "iterator" &&
						isArrayType(this.fromCompType))
				) {
					const arrayId = isArrayType(this.fromCompType)
						? this.link.from.componentId
						: this.link.to.componentId;
					const direction = isArrayType(this.fromCompType)
						? comp.id === this.link.to.componentId
							? this.link.from.side
							: this.link.to.side
						: comp.id === this.link.from.componentId
						? this.link.to.side
						: this.link.from.side;

					if (isAdd) {
						return {
							...comp,
							linkedArrays: [
								...(comp.linkedArrays || []),
								{ id: arrayId, direction },
							],
						};
					} else {
						return {
							...comp,
							linkedArrays: (comp.linkedArrays || []).filter(
								(link) => !(link.id === arrayId && link.direction === direction)
							),
						};
					}
				}
				return comp;
			});
		});
	}

	notifyLinkDeleted() {
		console.log("NOTIFY DELETED LINK: SEND");
		// Determine which component is the iterator and which is the array
		let iteratorId, arrayId, direction;

		if (this.fromCompType === "iterator" && isArrayType(this.toCompType)) {
			iteratorId = this.link.from.componentId;
			arrayId = this.link.to.componentId;
			direction = this.link.to.side;
		} else if (
			this.toCompType === "iterator" &&
			isArrayType(this.fromCompType)
		) {
			iteratorId = this.link.to.componentId;
			arrayId = this.link.from.componentId;
			direction = this.link.from.side;
		} else {
			return; // Not an iterator-array link
		}

		// Dispatch an event to clear highlights
		const event = new CustomEvent("iterator-link-deleted", {
			detail: {
				iteratorId,
				linkedArrayId: arrayId,
				linkDirection: direction,
			},
		});
		window.dispatchEvent(event);
	}
}

function isArrayType(type) {
	return type === "array" || type === "2darray";
}

// Delete Link Command
class DeleteLinkCommand {
	constructor(link) {
		this.link = link;
		// Store component info to update linkedArrays when undoing
		this.fromCompType = getComponentType(link.from.componentId);
		this.toCompType = getComponentType(link.to.componentId);
	}

	execute() {
		links.update((ls) => ls.filter((l) => l !== this.link));

		// Remove from linkedArrays if needed
		this.updateLinkedArrays(false);
		this.notifyLinkDeleted();
	}

	undo() {
		links.update((ls) => [...ls, this.link]);

		// Add back to linkedArrays
		this.updateLinkedArrays(true);

		// Notify iterators that a link was created
		const event = new CustomEvent("iterator-link-created", {
			detail: {
				fromId: this.link.from.componentId,
				toId: this.link.to.componentId,
			},
		});
		window.dispatchEvent(event);
	}

	updateLinkedArrays(isAdd) {
		// Update linkedArrays on related iterators
		components.update((comps) => {
			return comps.map((comp) => {
				if (
					(comp.id === this.link.from.componentId &&
						comp.type === "iterator" &&
						isArrayType(this.toCompType)) ||
					(comp.id === this.link.to.componentId &&
						comp.type === "iterator" &&
						isArrayType(this.fromCompType))
				) {
					const arrayId = isArrayType(this.fromCompType)
						? this.link.from.componentId
						: this.link.to.componentId;
					const direction = isArrayType(this.fromCompType)
						? comp.id === this.link.to.componentId
							? this.link.from.side
							: this.link.to.side
						: comp.id === this.link.from.componentId
						? this.link.to.side
						: this.link.from.side;

					if (isAdd) {
						// Add the array ID to linkedArrays
						return {
							...comp,
							linkedArrays: [
								...(comp.linkedArrays || []),
								{ id: arrayId, direction },
							],
						};
					} else {
						// Remove the array ID from linkedArrays
						return {
							...comp,
							linkedArrays: (comp.linkedArrays || []).filter(
								(link) => !(link.id === arrayId && link.direction === direction)
							),
						};
					}
				}
				return comp;
			});
		});
	}

	notifyLinkDeleted() {
		console.log("NOTIFY DELETED LINK: SEND");
		// Determine which component is the iterator and which is the array
		let iteratorId, arrayId, direction;

		if (this.fromCompType === "iterator" && isArrayType(this.toCompType)) {
			iteratorId = this.link.from.componentId;
			arrayId = this.link.to.componentId;
			direction = this.link.to.side;
		} else if (
			this.toCompType === "iterator" &&
			isArrayType(this.fromCompType)
		) {
			iteratorId = this.link.to.componentId;
			arrayId = this.link.from.componentId;
			direction = this.link.from.side;
		} else {
			return; // Not an iterator-array link
		}

		// Dispatch an event to clear highlights
		const event = new CustomEvent("iterator-link-deleted", {
			detail: {
				iteratorId,
				linkedArrayId: arrayId,
				linkDirection: direction,
			},
		});
		window.dispatchEvent(event);
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
		components.update((comps) =>
			comps.filter((c) => c.id !== this.newComponent.id)
		);
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
		name,
	};

	executeCommand(new AddComponentCommand(component));
}

function generateColor(id) {
	// Generate a hex color based on the ID
	return `#${((id * 9631) % 0xffffff).toString(16).padStart(6, "0")}`;
}

export function addIteratorComponent() {
	const name = prompt("Enter Iterator name:");
	if (name === null || name === "") return;

	const component = {
		id: nextId++,
		type: "iterator",
		x: 100,
		y: 100,
		name,
		linkedArrays: [],
		maxIndex: 10,
		color: generateColor(nextId),
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

// In Whiteboard_back.js
export function createLink(fromNode, toNode) {
	if (!fromNode || !toNode) return;

	// Determine if an iterator is involved and which component it is
	const fromType = getComponentType(fromNode.componentId);
	const toType = getComponentType(toNode.componentId);

	let baseColor;
	let shade = 0;

	// If this link involves an iterator, use the iterator's color
	if (fromType === "iterator") {
		const iteratorComp = get(components).find(
			(c) => c.id === fromNode.componentId
		);
		baseColor = iteratorComp.color;
		// Count existing links to determine shade
		const existingLinks = get(links).filter(
			(l) =>
				l.from.componentId === fromNode.componentId ||
				l.to.componentId === fromNode.componentId
		);
		shade = existingLinks.length * 10; // 10% darker per link
	} else if (toType === "iterator") {
		const iteratorComp = get(components).find(
			(c) => c.id === toNode.componentId
		);
		baseColor = iteratorComp.color;
		// Count existing links to determine shade
		const existingLinks = get(links).filter(
			(l) =>
				l.from.componentId === toNode.componentId ||
				l.to.componentId === toNode.componentId
		);
		shade = existingLinks.length * 10; // 10% darker per link
	} else {
		// Not an iterator link, use random color
		baseColor =
			"#" +
			Math.floor(Math.random() * 0xffffff)
				.toString(16)
				.padStart(6, "0");
	}

	// Create the link with the adjusted color
	const link = {
		from: fromNode,
		to: toNode,
		color: shade > 0 ? adjustBrightness(baseColor, -shade) : baseColor,
	};

	// Create the link command
	executeCommand(new CreateLinkCommand(link));
	return link;
}

// Helper function to adjust color brightness
function adjustBrightness(hex, percent) {
	// Convert hex to RGB
	let r = parseInt(hex.slice(1, 3), 16);
	let g = parseInt(hex.slice(3, 5), 16);
	let b = parseInt(hex.slice(5, 7), 16);

	// Adjust brightness
	r = Math.max(0, Math.min(255, r + (r * percent) / 100));
	g = Math.max(0, Math.min(255, g + (g * percent) / 100));
	b = Math.max(0, Math.min(255, b + (b * percent) / 100));

	// Convert back to hex
	return (
		"#" +
		Math.round(r).toString(16).padStart(2, "0") +
		Math.round(g).toString(16).padStart(2, "0") +
		Math.round(b).toString(16).padStart(2, "0")
	);
}

// Helper function to get component type
function getComponentType(id) {
	const comp = get(components).find((c) => c.id === id);
	return comp ? comp.type : null;
}

export function deleteLink(link) {
	executeCommand(new DeleteLinkCommand(link));
}

// Function to calculate distance between two points
function getDistance(x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Function to get all possible connection points for a component
function getConnectionPoints(componentId) {
	// Get component to determine its type
	const component = get(components).find((c) => c.id === componentId);
	let sides = ["top", "right", "bottom", "left"];

	// Add type-specific connection points
	if (component) {
		switch (component.type) {
			case "binary-node":
				sides = ["top", "bottom-left", "bottom-right"];
				break;
			case "nary-node":
				sides = ["top", "bottom"];
				break;
			// Regular nodes and other components use default 4 sides
		}
	}

	const points = {};

	sides.forEach((side) => {
		const getNodeCenter = window.__getNodeCenterMap?.[`${componentId}-${side}`];
		if (getNodeCenter) {
			points[side] = getNodeCenter();
		}
	});

	return points;
}

// Function to find the shortest path between two components
export function optimizeLinkPath(link) {
	if (!link || !link.from || !link.to) return;

	const fromId = link.from.componentId;
	const toId = link.to.componentId;

	// Get component types to check for binary nodes
	const allComponents = get(components);
	const fromComponent = allComponents.find((c) => c.id === fromId);
	const toComponent = allComponents.find((c) => c.id === toId);

	const isBinaryConnection =
		fromComponent?.type === "binary-node" ||
		toComponent?.type === "binary-node";
	const bottomSides = ["bottom", "bottom-left", "bottom-right"];

	// Get all possible connection points
	const fromPoints = getConnectionPoints(fromId);
	const toPoints = getConnectionPoints(toId);

	let shortestDistance = Infinity;
	let bestFromSide = link.from.side;
	let bestToSide = link.to.side;

	// Try all combinations to find the shortest path
	for (const [fromSide, fromPos] of Object.entries(fromPoints)) {
		for (const [toSide, toPos] of Object.entries(toPoints)) {
			// Skip invalid bottom-to-bottom connections for binary nodes
			if (
				isBinaryConnection &&
				bottomSides.includes(fromSide) &&
				bottomSides.includes(toSide)
			) {
				continue; // Skip this combination
			}

			const distance = getDistance(fromPos.x, fromPos.y, toPos.x, toPos.y);
			if (distance < shortestDistance) {
				shortestDistance = distance;
				bestFromSide = fromSide;
				bestToSide = toSide;
			}
		}
	}

	// Update the link if we found a better path
	if (bestFromSide !== link.from.side || bestToSide !== link.to.side) {
		links.update((ls) => {
			return ls.map((l) => {
				if (l === link) {
					return {
						...l,
						from: {
							...l.from,
							side: bestFromSide,
							getNodeCenter:
								window.__getNodeCenterMap?.[`${fromId}-${bestFromSide}`] ||
								l.from.getNodeCenter,
						},
						to: {
							...l.to,
							side: bestToSide,
							getNodeCenter:
								window.__getNodeCenterMap?.[`${toId}-${bestToSide}`] ||
								l.to.getNodeCenter,
						},
					};
				}
				return l;
			});
		});
	}
}

// Function to optimize all links
export function optimizeAllLinks() {
	const currentLinks = get(links);
	currentLinks.forEach((link) => {
		optimizeLinkPath(link);
	});
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
		x: 70,
		y: 300,
		rows: 4,
		cols: 4,
	},
	{
		id: 3,
		type: "iterator",
		x: 400,
		y: 100,
		hoveredNode: null,
		linkedArrays: [],
		color: generateColor(10),
	},
	{
		id: 4,
		type: "node",
		x: 400,
		y: 300,
		hoveredNode: null,
	},
]);

export let linkEndpoints = writable([]);

let usePathfinding = false; // Toggle for pathfinding vs bezier

function makeBezierPath(x1, y1, x2, y2) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	// Determine control point distances - larger for greater separation
	const ctrlDist = Math.min(Math.max(absDx, absDy) * 0.5, 100);

	// Calculate control points based on direction
	let c1x, c1y, c2x, c2y;

	if (absDx > absDy) {
		// Horizontal dominant path
		c1x = x1 + ctrlDist * Math.sign(dx);
		c1y = y1;
		c2x = x2 - ctrlDist * Math.sign(dx);
		c2y = y2;
	} else {
		// Vertical dominant path
		c1x = x1;
		c1y = y1 + ctrlDist * Math.sign(dy);
		c2x = x2;
		c2y = y2 - ctrlDist * Math.sign(dy);
	}

	return `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
}

// Rectilinear path that avoids overlapping any component boundary box, with any number of corners
function makeRectilinearPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId) {
	const gridSize = 8;
	const margin = 7;
	const boundary = 15;

	const fromBox = getComponentBox(fromId);
	const toBox = getComponentBox(toId);

	let start = { x: x1, y: y1 };
	let end = { x: x2, y: y2 };

	if (fromBox) {
		switch (fromSide) {
			case "top":
				start = { x: fromBox.centerX, y: fromBox.top - boundary };
				break;
			case "bottom":
				start = { x: fromBox.centerX, y: fromBox.bottom + boundary };
				break;
			case "left":
				start = { x: fromBox.left - boundary, y: fromBox.centerY };
				break;
			case "right":
				start = { x: fromBox.right + boundary, y: fromBox.centerY };
				break;
		}
	}
	if (toBox) {
		switch (toSide) {
			case "top":
				end = { x: toBox.centerX, y: toBox.top - boundary };
				break;
			case "bottom":
				end = { x: toBox.centerX, y: toBox.bottom + boundary };
				break;
			case "left":
				end = { x: toBox.left - boundary, y: toBox.centerY };
				break;
			case "right":
				end = { x: toBox.right + boundary, y: toBox.centerY };
				break;
		}
	}

	function moveOutsideBoundary(pt, box, side) {
		if (!box) return pt;
		switch (side) {
			case "top":
				return { x: box.centerX, y: box.top - boundary - 15 };
			case "bottom":
				return { x: box.centerX, y: box.bottom + boundary + 15 };
			case "left":
				return { x: box.left - boundary - 15, y: box.centerY };
			case "right":
				return { x: box.right + boundary + 15, y: box.centerY };
			default:
				return pt;
		}
	}
	if (fromBox) start = moveOutsideBoundary(start, fromBox, fromSide);
	if (toBox) end = moveOutsideBoundary(end, toBox, toSide);

	const startGrid = {
		x: Math.round(start.x / gridSize),
		y: Math.round(start.y / gridSize),
	};
	const endGrid = {
		x: Math.round(end.x / gridSize),
		y: Math.round(end.y / gridSize),
	};

	const boxes = getAllComponentBoxes([]).map((b) => ({
		...b,
		left: b.left - boundary,
		right: b.right + boundary,
		top: b.top - boundary,
		bottom: b.bottom + boundary,
	}));

	// --- DEBUG: Draw blocked grid cells temporarily ---
	{
		const svg = document.querySelector("svg");
		if (svg) {
			// Remove previous debug grid cells
			const prevGridCells = svg.querySelectorAll(".debug-grid-cell");
			prevGridCells.forEach((r) => r.parentNode && r.parentNode.removeChild(r));

			// Compute grid bounds
			const minX = Math.min(startGrid.x, endGrid.x) - 10;
			const maxX = Math.max(startGrid.x, endGrid.x) + 10;
			const minY = Math.min(startGrid.y, endGrid.y) - 10;
			const maxY = Math.max(startGrid.y, endGrid.y) + 10;

			function isCellBlocked(gx, gy) {
				if (
					(gx === startGrid.x && gy === startGrid.y) ||
					(gx === endGrid.x && gy === endGrid.y)
				) {
					return false;
				}
				const px = gx * gridSize;
				const py = gy * gridSize;
				const blocked = boxes.some(
					(b) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom
				);
				return blocked;
			}

			for (let gx = minX; gx <= maxX; gx++) {
				for (let gy = minY; gy <= maxY; gy++) {
					const blocked = isCellBlocked(gx, gy);
					const rect = document.createElementNS(
						"http://www.w3.org/2000/svg",
						"rect"
					);
					rect.setAttribute("x", gx * gridSize);
					rect.setAttribute("y", gy * gridSize);
					rect.setAttribute("width", gridSize);
					rect.setAttribute("height", gridSize);
					rect.setAttribute("fill", blocked ? "#f44336" : "#4caf50");
					rect.setAttribute("fill-opacity", blocked ? "0.18" : "0.08");
					rect.setAttribute("stroke", blocked ? "#f44336" : "#4caf50");
					rect.setAttribute("stroke-width", "0.5");
					rect.setAttribute("class", "debug-grid-cell");
					rect.setAttribute("pointer-events", "none");
					svg.appendChild(rect);
				}
			}
		}
	}
	// --- END DEBUG ---

	const overlapsBox = (pt) =>
		boxes.some(
			(b) =>
				pt.x >= b.left && pt.x <= b.right && pt.y >= b.top && pt.y <= b.bottom
		);
	if (overlapsBox(start) || overlapsBox(end)) {
		return `M${start.x},${start.y} L${end.x},${end.y}`;
	}

	// --- Remove debug SVG drawing code for rectangles and grid cells ---

	function isCellBlocked(gx, gy) {
		if (
			(gx === startGrid.x && gy === startGrid.y) ||
			(gx === endGrid.x && gy === endGrid.y)
		) {
			return false;
		}
		const px = gx * gridSize;
		const py = gy * gridSize;
		const blocked = boxes.some(
			(b) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom
		);
		return blocked;
	}

	function allowedFirstStep(dx, dy, side) {
		// Allow any direction for diagonal pathfinding
		return true;
	}
	function allowedLastStep(prev, curr, side) {
		// Allow any direction for diagonal pathfinding
		return true;
	}

	// 8-directional A* (diagonal allowed)
	const open = [];
	const cameFrom = {};
	const gScore = {};
	const fScore = {};
	const key = (p) => `${p.x},${p.y}`;
	gScore[key(startGrid)] = 0;
	fScore[key(startGrid)] = Math.hypot(
		startGrid.x - endGrid.x,
		startGrid.y - endGrid.y
	);

	open.push({ ...startGrid, f: fScore[key(startGrid)] });

	let found = false;
	let steps = 0;
	const maxSteps = 10000;
	const directions = [
		{ dx: 1, dy: 0 },
		{ dx: -1, dy: 0 },
		{ dx: 0, dy: 1 },
		{ dx: 0, dy: -1 },
		{ dx: 1, dy: 1 },
		{ dx: 1, dy: -1 },
		{ dx: -1, dy: 1 },
		{ dx: -1, dy: -1 },
	];
	const visited = {};

	while (open.length && steps++ < maxSteps) {
		open.sort((a, b) => a.f - b.f);
		const current = open.shift();
		visited[key(current)] = true;
		if (current.x === endGrid.x && current.y === endGrid.y) {
			found = true;
			break;
		}
		for (const { dx, dy } of directions) {
			const neighbor = { x: current.x + dx, y: current.y + dy };
			const nKey = key(neighbor);

			if (visited[nKey]) continue;
			if (isCellBlocked(neighbor.x, neighbor.y)) continue;

			const currentScore = gScore[key(current)];
			if (currentScore === undefined) continue;

			const cost = dx === 0 || dy === 0 ? 1 : Math.SQRT2;
			const tentative = currentScore + cost;

			if (tentative < (gScore[nKey] === undefined ? Infinity : gScore[nKey])) {
				cameFrom[nKey] = current;
				gScore[nKey] = tentative;
				fScore[nKey] =
					tentative +
					Math.hypot(neighbor.x - endGrid.x, neighbor.y - endGrid.y);
				if (!open.some((p) => p.x === neighbor.x && p.y === neighbor.y))
					open.push({ ...neighbor, f: fScore[nKey] });
			}
		}
	}
	let path = [];
	if (found) {
		let curr = endGrid;
		while (curr && (curr.x !== startGrid.x || curr.y !== startGrid.y)) {
			path.push({ x: curr.x * gridSize, y: curr.y * gridSize });
			curr = cameFrom[key(curr)];
		}
		path.push({ x: startGrid.x * gridSize, y: startGrid.y * gridSize });
		path.reverse();

		function simplifyColinear(points) {
			if (points.length < 3) return points;
			const result = [points[0]];
			for (let i = 1; i < points.length - 1; i++) {
				const prev = result[result.length - 1];
				const curr = points[i];
				const next = points[i + 1];
				// If prev, curr, next are colinear (horizontal, vertical, or diagonal), skip curr
				if (
					(prev.x === curr.x && curr.x === next.x) ||
					(prev.y === curr.y && curr.y === next.y) ||
					(prev.x - curr.x) * (curr.y - next.y) ===
						(prev.y - curr.y) * (curr.x - next.x)
				) {
					continue;
				}
				result.push(curr);
			}
			result.push(points[points.length - 1]);
			return result;
		}
		path = simplifyColinear(path);
	} else {
		path = [
			{ x: start.x, y: start.y },
			{ x: end.x, y: end.y },
		];
	}

	let d = `M${path[0].x},${path[0].y}`;
	for (let i = 1; i < path.length; i++) {
		d += ` L${path[i].x},${path[i].y}`;
	}
	return d;
}

export function makeSmartOrBezierPath(
	x1,
	y1,
	x2,
	y2,
	fromSide,
	toSide,
	fromId,
	toId
) {
	if (usePathfinding) {
		return makeRectilinearPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId);
	} else {
		return makeBezierPath(x1, y1, x2, y2);
	}
}

// Helper to update linkTable and links array with new positions
export function updateLinks() {
	let changed = false;
	get(links).forEach((link) => {
		const fromPos = link.from.getNodeCenter();
		const toPos = link.to.getNodeCenter();
		// Only update if positions have changed
		if (
			link.from.x !== fromPos.x ||
			link.from.y !== fromPos.y ||
			link.to.x !== toPos.x ||
			link.to.y !== toPos.y
		) {
			changed = true;
			link.from.x = fromPos.x;
			link.from.y = fromPos.y;
			link.to.x = toPos.x;
			link.to.y = toPos.y;
		}
	});
	// Only trigger Svelte reactivity if changed
	if (changed) links.update((link) => [...link]);
}

// The problem is that getNodeCenter returns the previous position since the internal position of the component where getNodeCenter relies is still not updated. Try calling the updatelinks after updating the component's position

// Subscribe to both components and links to update positions

// Function to update linkEndpoints based on current links
export function updateLinkEndpoints() {
	const linksList = get(links);
	linkEndpoints.set(
		linksList.map((link) => {
			const fromPos = link.from.getNodeCenter
				? link.from.getNodeCenter()
				: null;
			const toPos = link.to.getNodeCenter ? link.to.getNodeCenter() : null;
			const fromSide = link.from.side;
			const toSide = link.to.side;
			const path =
				fromPos && toPos
					? makeSmartOrBezierPath(
							fromPos.x,
							fromPos.y,
							toPos.x,
							toPos.y,
							fromSide,
							toSide,
							link.from.componentId,
							link.to.componentId
					  )
					: "";
			// Assign a random color if not already present
			if (!link.color) {
				link.color =
					"#" +
					Math.floor(Math.random() * 0xffffff)
						.toString(16)
						.padStart(6, "0");
			}
			return { fromPos, toPos, link, path };
		})
	);
}

// In Whiteboard_back.js
export function addNodeComponent(value, x = 100, y = 100) {
	if (!value) {
		value = prompt("Enter node value:");
	}

	const component = {
		id: nextId++,
		type: "node",
		x,
		y,
		value: value || "",
		color: generateColor(nextId),
	};

	executeCommand(new AddComponentCommand(component));

	return component.id;
}

// Add Binary Node Component (1 parent above, 2 children below)
export function addBinaryNodeComponent(value, x = 100, y = 100) {
	if (!value) {
		value = prompt("Enter binary node value:");
	}

	const component = {
		id: nextId++,
		type: "binary-node",
		x,
		y,
		value: value || "",
		color: generateColor(nextId),
	};

	executeCommand(new AddComponentCommand(component));

	return component.id;
}

// Add N-ary Node Component (1 parent above, 1 child below)
export function addNaryNodeComponent(value, x = 100, y = 100, childCount = 3) {
	if (!value) {
		value = prompt("Enter n-ary node value:");
	}

	const component = {
		id: nextId++,
		type: "nary-node",
		x,
		y,
		value: value || "",
		childCount: childCount,
		color: generateColor(nextId),
	};

	executeCommand(new AddComponentCommand(component));

	return component.id;
}

// Helper function to create a node of the same type as the source
export function addNodeByType(type, value, x, y) {
	switch (type) {
		case "node":
			return addNodeComponent(value, x, y);
		case "binary-node":
			return addBinaryNodeComponent(value, x, y);
		case "nary-node":
			return addNaryNodeComponent(value, x, y);
		default:
			return addNodeComponent(value, x, y);
	}
}

// Subscribe to both components and links
components.subscribe(() => {
	// updateLinkEndpoints();
	// updateLinks();
	links.update((link) => [...link]);
	// components.update((components) => [...components]);
});

links.subscribe(() => {
	updateLinkEndpoints();
});

// Subscribe to svgRect to update link endpoints when scrolling
svgRect.subscribe(() => {
	updateLinkEndpoints();
});
