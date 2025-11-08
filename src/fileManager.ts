import { get } from "svelte/store";
import { components, links } from "./Whiteboard_back";
import {
	saveFile,
	loadFile,
	listFiles,
	deleteFile,
	listFileNames,
} from "./firebase";
import { nodeCenterMap } from "./ui_store";
import { toPng } from "html-to-image";
import { writable } from "svelte/store";

// Current file state
export const currentFilename = writable("");
export const isSaved = writable(true);
export const showFileBrowser = writable(false);
export const fileList = writable([]);

// Mark file as modified when components or links change
let initialState = null;
components.subscribe(() => {
	if (initialState !== null) {
		isSaved.set(false);
	}
});
links.subscribe(() => {
	if (initialState !== null) {
		isSaved.set(false);
	}
});

// Serialize current state
export function serializeState() {
	return {
		components: get(components),
		links: get(links).map((link) => ({
			from: {
				componentId: link.from.componentId,
				side: link.from.side,
			},
			to: {
				componentId: link.to.componentId,
				side: link.to.side,
			},
			color: link.color,
			path: link.path,
		})),
	};
}

// Deserialize and load state
export function loadState(data) {
	if (data.components) {
		// Reconstruct components and restore nested arrays from flattened object format
		const reconstructedComponents = data.components.map((comp) =>
			reconstructNestedArrays(comp)
		);
		components.set(reconstructedComponents);
	}
	if (data.links) {
		// Reconstruct links with getNodeCenter functions
		const reconstructedLinks = data.links.map((link) => ({
			from: {
				componentId: link.from.componentId,
				side: link.from.side,
				getNodeCenter: () => {
					const fn =
						get(nodeCenterMap)[`${link.from.componentId}-${link.from.side}`];
					return fn ? fn() : { x: 0, y: 0 };
				},
			},
			to: {
				componentId: link.to.componentId,
				side: link.to.side,
				getNodeCenter: () => {
					const fn =
						get(nodeCenterMap)[`${link.to.componentId}-${link.to.side}`];
					return fn ? fn() : { x: 0, y: 0 };
				},
			},
			color: link.color,
			path: link.path,
		}));
		links.set(reconstructedLinks);
	}

	initialState = serializeState();
	isSaved.set(true);
}

// Helper to reconstruct nested arrays from flattened object format
function reconstructNestedArrays(value) {
	if (value === null || value === undefined) return value;

	if (Array.isArray(value)) {
		return value.map(reconstructNestedArrays);
	}

	if (typeof value === "object") {
		// Check if this is a flattened nested array (has __isNestedArray marker)
		if (value.__isNestedArray && value.__length !== undefined) {
			const arr = [];
			for (let i = 0; i < value.__length; i++) {
				arr.push(reconstructNestedArrays(value[i.toString()]));
			}
			return arr;
		}

		// Regular object - recurse into its properties
		const out = {};
		for (const [k, v] of Object.entries(value)) {
			if (k === "__isNestedArray" || k === "__length") continue; // skip metadata
			out[k] = reconstructNestedArrays(v);
		}
		return out;
	}

	return value;
}

// Save current file to Firebase
export async function saveCurrentFile(userId, filename) {
	//check if same filename exists in the firestore, and warn user before overwriting
	if (!userId) throw new Error("Not authenticated");

	const existingFiles = await listFileNames(userId);
	console.log("Existing files:", existingFiles);
	if (existingFiles.includes(filename)) {
		const confirmOverwrite = confirm(
			"File already exists. Do you want to overwrite it?"
		);
		if (!confirmOverwrite) {
			let error = new Error("Save aborted by user: overwrite canceled");
			error.cause = "user_aborted";
			throw error;
		}
	}

	const data = serializeState();
	// Sanitize data to remove unsupported Firestore values (undefined, functions)
	const sanitized = sanitizeForFirestore(data);

	// Debug: log structure to find nested arrays
	// console.log(
	// 	"Serialized components sample:",
	// 	sanitized.components?.slice(0, 2)
	// );
	// console.log("Serialized links sample:", sanitized.links?.slice(0, 2));

	try {
		await saveFile(userId, filename, sanitized);
	} catch (err) {
		console.error("Failed to save file to Firebase. Full error:", err);
		console.error("Data sample:", {
			filename,
			sample: JSON.stringify(sanitized).slice(0, 500),
		});
		// Log component field types to find nested arrays
		if (sanitized.components) {
			sanitized.components.forEach((comp, idx) => {
				Object.entries(comp).forEach(([key, val]) => {
					if (Array.isArray(val)) {
						console.log(`Component[${idx}].${key} is array:`, val);
						// Check if any array element is itself an array
						val.forEach((item, i) => {
							if (Array.isArray(item)) {
								console.error(
									`NESTED ARRAY FOUND: Component[${idx}].${key}[${i}]`,
									item
								);
							}
						});
					}
				});
			});
		}
		throw err;
	}

	currentFilename.set(filename);
	isSaved.set(true);
	initialState = data;
}

// Replace undefined with null, remove functions, and flatten nested arrays so Firestore accepts the document
function sanitizeForFirestore(value, depth = 0) {
	if (value === undefined) return null;
	if (value === null) return null;

	if (Array.isArray(value)) {
		// Check if this array contains nested arrays (Firestore doesn't support nested arrays)
		const hasNestedArray = value.some((item) => Array.isArray(item));

		if (hasNestedArray) {
			// Convert nested array to object with numeric keys (e.g., 2D array -> { "0": [...], "1": [...] })
			const obj = {};
			value.forEach((item, idx) => {
				obj[idx.toString()] = sanitizeForFirestore(item, depth + 1);
			});
			// Add metadata to help with deserialization
			obj.__isNestedArray = true;
			obj.__length = value.length;
			return obj;
		}

		// Regular array without nesting
		return value.map((v) => sanitizeForFirestore(v, depth + 1));
	}

	if (typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) {
			if (v === undefined) {
				out[k] = null;
				continue;
			}
			if (typeof v === "function") {
				// skip functions entirely
				continue;
			}
			out[k] = sanitizeForFirestore(v, depth + 1);
		}
		return out;
	}
	// primitive (string, number, boolean)
	return value;
}

// Load file from Firebase
export async function loadFileFromFirebase(userId, filename) {
	if (!userId) throw new Error("Not authenticated");

	const data = await loadFile(userId, filename);
	loadState(data);
	currentFilename.set(filename);
}

// Refresh file list
export async function refreshFileList(userId) {
	if (!userId) throw new Error("Not authenticated");

	const files = await listFiles(userId);
	fileList.set(files);
	return files;
}

// Delete file
export async function deleteFileFromFirebase(userId, filename) {
	if (!userId) throw new Error("Not authenticated");

	await deleteFile(userId, filename);
	await refreshFileList(userId);
}

// Create new file (reset state)
export function createNewFile() {
	components.set([]);
	links.set([]);
	currentFilename.set("Untitled");
	isSaved.set(true);
	initialState = serializeState();
}

// Export canvas as image
export async function exportAsImage(containerElement, filename) {
	if (!containerElement) {
		throw new Error("Canvas container not found");
	}

	try {
		const dataUrl = await toPng(containerElement, {
			quality: 1.0,
			pixelRatio: 2,
			backgroundColor: "#f8f8f8",
		});

		// Download the image
		const link = document.createElement("a");
		link.download = `${filename || "tracie-export"}.png`;
		link.href = dataUrl;
		link.click();
	} catch (error) {
		console.error("Error exporting image:", error);
		throw error;
	}
}
