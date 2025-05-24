export let svgRect;

export function updateSvgRect2(svgContainer) {
	if (svgContainer) {
		const rect = svgContainer.getBoundingClientRect();
		svgRect = { left: rect.left, top: rect.top };
	}
}
