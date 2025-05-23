import { writable } from "svelte/store";

let nextId = 1;

export const components = writable([
	{
		id: nextId++,
		type: "array",
		x: 100,
		y: 100,
		length: 4,
	},
	{
		id: nextId++,
		type: "2darray",
		x: 200,
		y: 300,
		rows: 4,
		cols: 4,
	},
]);

export const links = writable([]);

export function addArrayComponent() {
	const len = parseInt(prompt("Enter array length:"), 10);
	if (isNaN(len) || len < 1) return;
	components.update((comps) => [
		...comps,
		{
			id: nextId++,
			type: "array",
			x: 100,
			y: 100,
			length: len,
		},
	]);
}

export function add2DTableComponent() {
	const rows = parseInt(prompt("Enter table rows length:"), 10);
	if (isNaN(rows) || rows < 1) return;
	const cols = parseInt(prompt("Enter table cols:"), 10);
	if (isNaN(cols) || cols < 1) return;
	components.update((comps) => [
		...comps,
		{
			id: nextId++,
			type: "2darray",
			x: 100,
			y: 100,
			rows,
			cols,
		},
	]);
}

export function addPointerComponent() {
	const name = prompt("Enter Pointer name:");
	if (name === "") return;
	components.update((comps) => [
		...comps,
		{
			id: nextId++,
			type: "pointer",
			x: 100,
			y: 100,
			value: name,
		},
	]);
}

export function deleteComponent(id) {
	components.update((comps) => comps.filter((c) => c.id !== id));
	links.update((ls) =>
		ls.filter((l) => l.from.componentId !== id && l.to.componentId !== id)
	);
}
