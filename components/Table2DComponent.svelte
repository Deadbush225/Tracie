<script>
	export let id;
	export let x;
	export let y;
	export let rows = 2; // new: number of rows
	export let cols = 3; // new: number of columns
	export let hoveredNode = null;
	export let class_ = "";

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

				// Notify parent of new position and deltas, but no history yet
				dispatch("move", { id, dx, dy, totalDx, totalDy, final: false });
				dispatch("redraw"); // notify parent to force SVG update
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

	// 2D array data
	let data = Array.from({ length: rows }, () => Array(cols).fill(""));

	// Update data if rows/cols change
	$: if (data.length !== rows || data[0]?.length !== cols) {
		const newData = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => data[r]?.[c] ?? ""));
		data = newData;
	}

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

	<!-- 2D Table -->
	<table style="border-collapse:collapse;">
		<tbody>
			<tr>
				<td></td>
				{#each Array(cols) as _, c}
					<td style="border:1px solid #888; padding:6px; background:#e3e3e3; text-align:center;">{c}</td>
				{/each}
			</tr>
			{#each Array(rows) as _, r}
				<tr>
					<td style="border:1px solid #888; padding:6px; background:#e3e3e3; text-align:center;">{r}</td>
					{#each Array(cols) as _, c}
						<td style="border:1px solid #888; padding:6px;">
							<input style="width:40px;" bind:value={data[r][c]} />
						</td>
					{/each}
				</tr>
			{/each}
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
