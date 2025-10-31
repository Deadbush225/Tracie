<script>
	import { createEventDispatcher, onMount } from "svelte";
	import { get } from "svelte/store";
	import { svgRect } from "../src/ui_store";
	export let id;
	export let x = 0;
	export let y = 0;
	export let class_ = "";
	export let hoveredNode = null;
	export let deletable = true;
	// New prop: array of connection point names (e.g., ["top", "bottom-left", "bottom-right"])
	export let connectionPoints = ["top", "bottom", "left", "right"];
	// New prop: border radius for shape customization (default 6px for backwards compatibility)
	export let borderRadius = "6px";
	// New prop: border color (default #333)
	export let borderColor = "#333";

	// Constants for connection point positioning
	const CONNECTION_POINT_OFFSET = 18; // Distance from component edge
	const CONNECTION_POINT_SIZE = 12; // Size of the connection point circle

	let container;
	let dragging = false;
	let offset = { x: 0, y: 0 };
	let startPos = { x: 0, y: 0 };
	let totalDx = 0;
	let totalDy = 0;
	let rect;

	const dispatch = createEventDispatcher();

	function handleMouseDown(event) {
		// if (event.currentTarget === event.target) {
		dragging = true;
		offset = {
			x: event.clientX - x,
			y: event.clientY - y,
		};
		startPos = { x, y };
		totalDx = 0;
		totalDy = 0;
		// }
	}

	function handleMouseMove(event) {
		if (dragging) {
			const newPos = {
				x: event.clientX - offset.x,
				y: event.clientY - offset.y,
			};
			const dx = newPos.x - x;
			const dy = newPos.y - y;
			totalDx += dx;
			totalDy += dy;
			dispatch("move", { id, dx, dy, totalDx, totalDy, final: false });
			dispatch("redraw");
		}
	}

	function handleMouseUp() {
		if (dragging) {
			dispatch("move", { id, dx: 0, dy: 0, totalDx, totalDy, final: true });
			dragging = false;
		}
	}

	onMount(() => {
		rect = container.getBoundingClientRect();
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	});

	function getNodeCenter(side) {
		rect = container.getBoundingClientRect();
		const width = rect ? rect.width : 120;
		const height = rect ? rect.height : 60;

		// Component positions (x, y) are relative to the container
		// SVG is also positioned relative to the same container at (0,0)
		// So we can use x, y directly without adding svgRect offset
		let _x = x;
		let _y = y;

		// Calculate common positions
		const centerX = _x + width / 2;
		const centerY = _y + height / 2;
		const leftEdge = _x - CONNECTION_POINT_OFFSET / 2;
		const rightEdge = _x + width + CONNECTION_POINT_OFFSET / 2;
		const topEdge = _y - CONNECTION_POINT_OFFSET / 2;
		const bottomEdge = _y + height + CONNECTION_POINT_OFFSET / 2;
		const leftThird = _x + width * 0.3;
		const rightThird = _x + width * 0.7;
		const upperQuarter = _y + height * 0.25;

		// Support custom connection point positions
		switch (side) {
			case "top":
				return { x: centerX, y: topEdge };
			case "bottom":
				return { x: centerX, y: bottomEdge };
			case "left":
				return { x: leftEdge, y: centerY };
			case "right":
				return { x: rightEdge, y: centerY };
			// Binary tree connections
			case "bottom-left":
				return { x: leftThird, y: bottomEdge };
			case "bottom-right":
				return { x: rightThird, y: bottomEdge };
			// Diagonal connections
			case "top-left":
				return { x: leftEdge, y: upperQuarter };
			case "top-right":
				return { x: rightEdge, y: upperQuarter };
			default:
				return { x: centerX, y: centerY };
		}
	}

	function registerNode(side) {
		if (!window.__getNodeCenterMap) window.__getNodeCenterMap = {};
		window.__getNodeCenterMap[`${id}-${side}`] = () => getNodeCenter(side);
	}

	onMount(() => {
		// Register all connection points specified by the parent component
		connectionPoints.forEach(registerNode);
	});

	// Re-register when connection points change
	$: if (connectionPoints) {
		connectionPoints.forEach(registerNode);
	}
</script>

<div
	bind:this={container}
	id={"comp-" + id}
	class={class_}
	style="--connection-point-size:{CONNECTION_POINT_SIZE}px; position:absolute; left:{x}px; top:{y}px; border:2px solid {borderColor}; background:#fff; border-radius:{borderRadius}; box-shadow:0 2px 8px #0002; user-select:none; cursor:{dragging
		? 'grabbing'
		: 'default'}; padding:8px;"
	on:mousedown={handleMouseDown}
	on:click|stopPropagation
>
	{#if deletable}
		<button
			on:click={() => dispatch("delete", { id })}
			class="delete-x"
			title="Delete"
		>
			×
		</button>
	{/if}
	<!-- Nodes at custom connection points -->
	{#each connectionPoints as side}
		{@const nodeOffset = `-${CONNECTION_POINT_OFFSET - 2}px`}
		{@const centerPos = "50%"}
		{@const leftThirdPos = "30%"}
		{@const rightThirdPos = "70%"}
		{@const upperQuarterPos = "25%"}
		<div
			class="node {hoveredNode &&
			hoveredNode.componentId === id &&
			hoveredNode.side === side
				? 'node-hovered'
				: ''}"
			data-comp-id={id}
			data-side={side}
			style="{side === 'top'
				? `left:${centerPos}; top:${nodeOffset}; transform:translateX(-50%);`
				: ''}
                   {side === 'bottom'
				? `left:${centerPos}; bottom:${nodeOffset}; transform:translateX(-50%);`
				: ''}
                   {side === 'left'
				? `left:${nodeOffset}; top:${centerPos}; transform:translateY(-50%);`
				: ''}
                   {side === 'right'
				? `right:${nodeOffset}; top:${centerPos}; transform:translateY(-50%);`
				: ''}
                   {side === 'bottom-left'
				? `left:${leftThirdPos}; bottom:${nodeOffset}; transform:translateX(-50%);`
				: ''}
                   {side === 'bottom-right'
				? `left:${rightThirdPos}; bottom:${nodeOffset}; transform:translateX(-50%);`
				: ''}
                   {side === 'top-left'
				? `left:${nodeOffset}; top:${upperQuarterPos}; transform:translateY(-50%);`
				: ''}
                   {side === 'top-right'
				? `right:${nodeOffset}; top:${upperQuarterPos}; transform:translateY(-50%);`
				: ''}"
			on:mousedown|stopPropagation={() =>
				dispatch("nodeMouseDown", {
					componentId: id,
					side,
					getNodeCenter: () => getNodeCenter(side),
				})}
		/>
	{/each}

	<!-- Slot for custom content -->
	<slot />
</div>

<style>
	.node {
		width: var(--connection-point-size, 12px);
		height: var(--connection-point-size, 12px);
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
	/* .delete-x {
		position: absolute;
		top: 2px;
		right: 2px;
		background: transparent;
		border: none;
		font-size: 18px;
		cursor: pointer;
		color: #888;
	} */
</style>
