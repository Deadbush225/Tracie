<script>
	import { get } from "svelte/store";
	import ComponentBox from "../components/ComponentBox.svelte";

	export let id;
	export let x;
	export let y;
	export let length;

	export let class_ = ""; // Accept class prop
	let highlightsByIterator = {};

	import { components } from "../src/Whiteboard_back";
	import { createEventDispatcher, onMount, getContext } from "svelte";

	const dispatch = createEventDispatcher();

	onMount(() => {
		const unsubscribe = getContext("iteratorStore").subscribe((store) => {
			if (!store) return;

			// Reset highlights map
			highlightsByIterator = {};

			// Process all iterators pointing to this array
			store.updates.forEach((update, idx) => {
				if (update.linkedArrays && update.linkedArrays.includes(id)) {
					// Get color based on iterator position (or use iterator ID for consistency)
					const iteratorComp = get(components).find((c) => c.id === update.iteratorId);
					const color = iteratorComp?.color || update.color || "#ffeb3b";

					if (!highlightsByIterator[update.index]) highlightsByIterator[update.index] = [];
					highlightsByIterator[update.index].push(color);
					console.log(highlightsByIterator);
				}
			});
		});

		return () => {
			unsubscribe();
		};
	});

	let data = Array(length).fill("");
	$: if (data.length !== length) {
		// Adjust data array if length prop changes
		if (data.length < length) {
			data = [...data, ...Array(length - data.length).fill("")];
		} else {
			data = data.slice(0, length);
		}
	}

	// Row drag state
	let draggingRow = null;

	// Replace drag state with mouse-based reordering state
	let draggingColIndex = null;
	let hoverColIndex = null;
	let isReordering = false;

	function handleColMouseDown(i, event) {
		// Start column dragging/reordering
		draggingColIndex = i;
		hoverColIndex = i;
		isReordering = true;
		// Prevent component dragging when reordering columns
		event.stopPropagation();
	}

	function handleColMouseMove(i) {
		// Update hover target and perform reordering during drag
		if (isReordering && draggingColIndex !== null && i !== draggingColIndex) {
			hoverColIndex = i;

			// Reorder the data array immediately on hover
			const newData = [...data];

			if (swap) {
				// Swap the two values directly
				[newData[draggingColIndex], newData[hoverColIndex]] = [newData[hoverColIndex], newData[draggingColIndex]];
			} else {
				// Remove and insert (original behavior)
				const [moved] = newData.splice(draggingColIndex, 1);
				newData.splice(hoverColIndex, 0, moved);
			}

			data = newData;
			// Update draggingColIndex to follow the moved column
			draggingColIndex = hoverColIndex;
		}
	}

	// Add a property to control swap behavior
	export let swap = true; // If true, swap elements; if false, insert

	function handleColMouseUp() {
		// Reset state
		draggingColIndex = null;
		hoverColIndex = null;
		isReordering = false;
	}

	// Global mouse up handler to ensure reordering stops if mouse is released outside columns
	onMount(() => {
		// ...existing event listeners...

		window.addEventListener("mouseup", handleColMouseUp);
		return () => {
			// ...existing removeEventListeners...
			window.removeEventListener("mouseup", handleColMouseUp);
		};
	});

	// Helper: blend multiple colors with alpha
	function blendColors(colors) {
		if (!colors || colors.length === 0) return "";
		if (colors.length === 1) return hexToRgba(colors[0], 0.5);

		// Start with the first color
		let [r, g, b, a] = hexToRgbaArr(colors[0], 0.5);

		for (let i = 1; i < colors.length; i++) {
			const [nr, ng, nb, na] = hexToRgbaArr(colors[i], 0.5);
			// Simple alpha blending
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
</script>

<ComponentBox {id} {x} {y} {class_} on:move={(e) => dispatch("move", e.detail)} on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}>
	<!-- Table -->
	<table style="border-collapse:collapse;">
		<tbody>
			<tr>
				{#each Array(length) as _, i}
					<td
						style="position:relative; border:1px solid #888; padding:6px; background:#e3e3e3; cursor:move; 
                {draggingColIndex === i ? 'opacity:0.5;' : ''} 
                {hoverColIndex === i && draggingColIndex !== null && isReordering ? 'outline:2px dashed #1976d2;' : ''}; background:{blendColors(highlightsByIterator[i])};"
						on:mousedown={(e) => handleColMouseDown(i, e)}
						on:mousemove={() => handleColMouseMove(i)}>{i}</td
					>
				{/each}
			</tr>
			<tr>
				{#each Array(length) as _, i}
					<td style="border:1px solid #888; padding:6px; background:{blendColors(highlightsByIterator[i])};">
						<input style="width:40px;" bind:value={data[i]} />
					</td>
				{/each}
			</tr>
		</tbody>
	</table>
</ComponentBox>

<style>
</style>
