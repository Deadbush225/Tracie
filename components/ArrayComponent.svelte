<script>
	export let id;
	export let x;
	export let y;
	export let length;
	export let hoveredNode = null;
	export let class_ = ""; // Accept class prop

	import { deleteComponent } from "../src/Whiteboard_back";
	import { createEventDispatcher, onMount } from "svelte";
	const dispatch = createEventDispatcher();
	let container;

	// Make pos reactive to x and y props
	$: pos = { x, y };
	let dragging = false;
	let offset = { x: 0, y: 0 };

	// Track total movement for history
	let startPos = { x: 0, y: 0 };
	let totalDx = 0;
	let totalDy = 0;

	function handleMouseDown(event) {
		// Only set dragging state if this is a direct mousedown on the component
		// not on a child element like the column headers
		if (event.currentTarget === event.target) {
			dragging = true;
			offset = {
				x: event.clientX - pos.x,
				y: event.clientY - pos.y,
			};

			// Save starting position for tracking total movement
			startPos = { x: pos.x, y: pos.y };
			totalDx = 0;
			totalDy = 0;
		}
	}

	function handleMouseMove(event) {
		if (dragging) {
			const newPos = {
				x: event.clientX - offset.x,
				y: event.clientY - offset.y,
			};

			if (newPos.x !== pos.x || newPos.y !== pos.y) {
				// Calculate the delta movement for this frame
				const dx = newPos.x - pos.x;
				const dy = newPos.y - pos.y;

				// Update total movement
				totalDx += dx;
				totalDy += dy;

				pos = newPos;
				// Only dispatch move if not dragging a row
				if (draggingRow === null) {
					// Include delta in the event detail with final=false
					dispatch("move", { id, dx, dy, totalDx, totalDy, final: false });
					dispatch("redraw"); // notify parent to force SVG update
				}
			}
		}
	}

	function handleMouseUp() {
		if (dragging) {
			// When releasing, dispatch final position with total movement
			dispatch("move", { id, dx: 0, dy: 0, totalDx, totalDy, final: true });
			dragging = false;
		}
	}

	onMount(() => {
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
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

	function getNodeCenter(side) {
		const rect = container.getBoundingClientRect();
		const scrollX = window.scrollX || window.pageXOffset;
		const scrollY = window.scrollY || window.pageYOffset;
		switch (side) {
			case "top":
				return {
					x: rect.left + rect.width / 2 + scrollX,
					y: rect.top + scrollY - 6,
				};
			case "bottom":
				return {
					x: rect.left + rect.width / 2 + scrollX,
					y: rect.bottom + scrollY + 6,
				};
			case "left":
				return {
					x: rect.left + scrollX - 6,
					y: rect.top + rect.height / 2 + scrollY,
				};
			case "right":
				return {
					x: rect.right + scrollX + 6,
					y: rect.top + rect.height / 2 + scrollY,
				};
		}
	}

	// Register getNodeCenter for hit detection
	function registerNode(side) {
		if (!window.__getNodeCenterMap) window.__getNodeCenterMap = {};
		window.__getNodeCenterMap[`${id}-${side}`] = () => getNodeCenter(side);
	}
	onMount(() => {
		["top", "bottom", "left", "right"].forEach(registerNode);
	});

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
</script>

<div
	bind:this={container}
	id={"array-comp-" + id}
	class={class_}
	style="position:absolute; left:{pos.x}px; top:{pos.y}px; border:1px solid #333; background:#fff; border-radius:6px; box-shadow:0 2px 8px #0002; user-select:none; cursor:{dragging
		? 'grabbing'
		: 'grab'}; padding:8px;"
	on:mousedown={handleMouseDown}
	on:click|stopPropagation
>
	<button on:click={() => deleteComponent(id)} class="delete-x" title="Delete"> × </button>
	<!-- Nodes on all sides -->
	<div
		class="node {hoveredNode && hoveredNode.componentId === id && hoveredNode.side === 'top' ? 'node-hovered' : ''}"
		data-comp-id={id}
		data-side="top"
		style="left:50%; top:-14px; transform:translateX(-50%);"
		on:mousedown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				componentId: id,
				side: "top",
				getNodeCenter: () => getNodeCenter("top"),
			})}
	/>
	<div
		class="node {hoveredNode && hoveredNode.componentId === id && hoveredNode.side === 'bottom' ? 'node-hovered' : ''}"
		data-comp-id={id}
		data-side="bottom"
		style="left:50%; bottom:-14px; transform:translateX(-50%);"
		on:mousedown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				componentId: id,
				side: "bottom",
				getNodeCenter: () => getNodeCenter("bottom"),
			})}
	/>
	<div
		class="node {hoveredNode && hoveredNode.componentId === id && hoveredNode.side === 'left' ? 'node-hovered' : ''}"
		data-comp-id={id}
		data-side="left"
		style="left:-14px; top:50%; transform:translateY(-50%);"
		on:mousedown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				componentId: id,
				side: "left",
				getNodeCenter: () => getNodeCenter("left"),
			})}
	/>
	<div
		class="node {hoveredNode && hoveredNode.componentId === id && hoveredNode.side === 'right' ? 'node-hovered' : ''}"
		data-comp-id={id}
		data-side="right"
		style="right:-14px; top:50%; transform:translateY(-50%);"
		on:mousedown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				componentId: id,
				side: "right",
				getNodeCenter: () => getNodeCenter("right"),
			})}
	/>

	<!-- Table -->
	<table style="border-collapse:collapse;">
		<tbody>
			<tr>
				{#each Array(length) as _, i}
					<td
						style="position:relative; border:1px solid #888; padding:6px; background:#e3e3e3; cursor:move; 
							{draggingColIndex === i ? 'opacity:0.5;' : ''} 
							{hoverColIndex === i && draggingColIndex !== null && isReordering ? 'outline:2px dashed #1976d2;' : ''}"
						on:mousedown={(e) => handleColMouseDown(i, e)}
						on:mousemove={() => handleColMouseMove(i)}>{i}</td
					>
				{/each}
			</tr>
			<tr>
				{#each Array(length) as _, i}
					<td style="border:1px solid #888; padding:6px;">
						<input style="width:40px;" bind:value={data[i]} />
					</td>
				{/each}
			</tr>
		</tbody>
	</table>
</div>

<style>
	.node {
		width: 12px;
		height: 12px;
		background: #1976d2;
		border-radius: 50%;
		position: absolute;
		transition:
			box-shadow 0.1s,
			border 0.1s,
			background 0.1s;
	}
	.node-hovered {
		box-shadow: 0 0 0 6px rgba(25, 118, 210, 0.2);
		border: 2px solid #1976d2;
		background: #fff;
	}
</style>
