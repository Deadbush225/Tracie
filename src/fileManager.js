import { get } from "svelte/store";
import { components, links } from "./Whiteboard_back";
import { saveFile, loadFile, listFiles, deleteFile } from "./firebase";
import { toPng } from "html-to-image";
import { writable } from "svelte/store";

// Current file state
export const currentFilename = writable("Untitled");
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
		components.set(data.components);
	}
	if (data.links) {
		// Reconstruct links with getNodeCenter functions
		const reconstructedLinks = data.links.map((link) => ({
			from: {
				componentId: link.from.componentId,
				side: link.from.side,
				getNodeCenter: () => {
					if (window.__getNodeCenterMap) {
						const fn =
							window.__getNodeCenterMap[
								`${link.from.componentId}-${link.from.side}`
							];
						return fn ? fn() : { x: 0, y: 0 };
					}
					return { x: 0, y: 0 };
				},
			},
			to: {
				componentId: link.to.componentId,
				side: link.to.side,
				getNodeCenter: () => {
					if (window.__getNodeCenterMap) {
						const fn =
							window.__getNodeCenterMap[
								`${link.to.componentId}-${link.to.side}`
							];
						return fn ? fn() : { x: 0, y: 0 };
					}
					return { x: 0, y: 0 };
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

// Save current file to Firebase
export async function saveCurrentFile(userId, filename) {
	if (!userId) throw new Error("Not authenticated");

	const data = serializeState();
	// Sanitize data to remove unsupported Firestore values (undefined, functions)
	const sanitized = sanitizeForFirestore(data);
	try {
		await saveFile(userId, filename, sanitized);
	} catch (err) {
		console.error("Failed to save file to Firebase. Data sample:", {
			filename,
			sample: JSON.stringify(sanitized).slice(0, 200),
		});
		throw err;
	}

	currentFilename.set(filename);
	isSaved.set(true);
	initialState = data;
}

// Replace undefined with null and remove functions so Firestore accepts the document
function sanitizeForFirestore(value) {
	if (value === undefined) return null;
	if (value === null) return null;
	if (Array.isArray(value)) return value.map(sanitizeForFirestore);
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
			out[k] = sanitizeForFirestore(v);
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
