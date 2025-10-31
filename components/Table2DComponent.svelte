<script>
	import { get } from "svelte/store";
	import ComponentBox from "./ComponentBox.svelte";
	import { components } from "../src/Whiteboard_back";
	import { createEventDispatcher, onMount, getContext } from "svelte";

	export let id;
	export let x;
	export let y;
	export let rows = 2;
	export let cols = 3;
	export let class_ = "";

	const dispatch = createEventDispatcher();

	let highlightedCols = {};
	let highlightedRows = {};

	onMount(() => {
		const unsubscribe = getContext("iteratorStore").subscribe((store) => {
			if (!store) return;
			highlightedCols = {};
			highlightedRows = {};

			store.updates.forEach((update) => {
				console.log(`${update.linkedArrayId} - ${id}`);
				if (update.linkedArrayId !== id) return;
				// Find the link direction for this iterator to this table
				const comp = get(components).find((c) => c.id === update.iteratorId);
				const color = comp?.color || update.color || "#ffeb3b";
				// You need to know the direction of the link. Let's assume you store this info in update.linkDirection
				// For each link, you might have: {iteratorId, index, linkedArrays, color, linkDirection: "top"|"bottom"|"left"|"right"}
				// If not, you need to extend your link creation logic to store this.

				// Example: if linkDirection is "top" or "bottom", it's a column; if "left" or "right", it's a row

				if (update.linkDirection === "top" || update.linkDirection === "bottom") {
					if (!highlightedCols[update.index]) highlightedCols[update.index] = [];
					highlightedCols[update.index].push(color);
				} else if (update.linkDirection === "left" || update.linkDirection === "right") {
					if (!highlightedRows[update.index]) highlightedRows[update.index] = [];
					highlightedRows[update.index].push(color);
				}
			});
		});
		return () => unsubscribe();
	});

	// Helper: blend multiple colors with alpha
	function blendColors(colors) {
		if (!colors || colors.length === 0) return "";
		if (colors.length === 1) return hexToRgba(colors[0], 0.5);
		let [r, g, b, a] = hexToRgbaArr(colors[0], 0.5);
		for (let i = 1; i < colors.length; i++) {
			const [nr, ng, nb, na] = hexToRgbaArr(colors[i], 0.5);
			r = (r + nr) / 2;
			g = (g + ng) / 2;
			b = (b + nb) / 2;
			a = Math.max(a, na);
		}
		return `rgba(${r},${g},${b},${a})`;
	}
	function hexToRgba(hex, alpha = 0.5) {
		const [r, g, b] = hexToRgbaArr(hex, alpha);
		return `rgba(${r},${g},${b},${alpha})`;
	}
	function hexToRgbaArr(hex, alpha = 0.5) {
		let c = hex.replace("#", "");
		if (c.length === 3)
			c = c
				.split("")
				.map((x) => x + x)
				.join("");
		const num = parseInt(c, 16);
		return [(num >> 16) & 255, (num >> 8) & 255, num & 255, alpha];
	}

	let data = Array.from({ length: rows }, () => Array(cols).fill(""));
	$: if (data.length !== rows || data[0]?.length !== cols) {
		const newData = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => data[r]?.[c] ?? ""));
		data = newData;
	}

	// Add this function to handle intersections
	function getIntersectionColor(rowColors, colColors) {
		// If both row and column are highlighted, blend them
		if (rowColors?.length > 0 && colColors?.length > 0) {
			// Create a deeper blend for intersections
			const allColors = [...rowColors, ...colColors];
			return blendColors(allColors);
		}
		// If only row is highlighted
		else if (rowColors?.length > 0) {
			return blendColors(rowColors);
		}
		// If only column is highlighted
		else if (colColors?.length > 0) {
			return blendColors(colColors);
		}
		// No highlighting
		return "";
	}
</script>

<ComponentBox {id} {x} {y} {class_} on:move={(e) => dispatch("move", e.detail)} on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}>
	<table style="border-collapse:collapse;">
		<tbody>
			<tr>
				<td style="border:1px solid #888; padding:6px;"></td>
				{#each Array(cols) as _, c}
					<td class="header" style="border:1px solid #888; padding:6px; background:#e3e3e3; background:{blendColors(highlightedCols[c])}; text-align:center;">
						{c}
					</td>
				{/each}
			</tr>
			{#each Array(rows) as _, r}
				<tr>
					<td class="header" style="border:1px solid #888; padding:6px; text-align:center; background:#e3e3e3; background:{blendColors(highlightedRows[r])};">
						{r}
					</td>
					{#each Array(cols) as _, c}
						<td
							style="border:1px solid #888; padding:6px; 
                          background:{getIntersectionColor(highlightedRows[r], highlightedCols[c])};"
						>
							<input style="width:40px;" bind:value={data[r][c]} />
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</ComponentBox>

<style>
	input {
		background: transparent;
	}

	.header {
	}
</style>
