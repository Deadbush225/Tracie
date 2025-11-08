import { writable } from "svelte/store";

export const svgRect = writable({ left: 0, top: 0, scrollX: 0, scrollY: 0 });

export function updateSvgRect2(svgContainer) {
	if (svgContainer) {
		const rect = svgContainer.getBoundingClientRect();
		// Store the viewport-relative position
		// This will be used to convert clientX/Y to container-relative coordinates
		svgRect.set({
			left: rect.left,
			top: rect.top,
			scrollX: window.scrollX,
			scrollY: window.scrollY,
		});
	}
}

export const selectedComponentIds = writable([]);

export const selectedLinks = writable([]);
export const selectedLink = writable(null);
