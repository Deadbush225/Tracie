<script lang="ts">
	/**
	 * ComponentBox - Reusable wrapper for all components with connection points
	 *
	 * This component encapsulates:
	 * - Component positioning and dragging
	 * - Connection point management and registration
	 * - Delete button
	 * - Custom styling (border, radius, etc.)
	 *
	 * Usage in child components:
	 * 1. Define connectionPoints array (e.g., ["top", "bottom", "left", "right"])
	 * 2. Pass connectionPoints prop to ComponentBox
	 * 3. ComponentBox handles all connection logic automatically
	 * 4. Child component just needs to dispatch events (move, nodeMouseDown, delete)
	 *
	 * Available connection points:
	 * - Basic: "top", "bottom", "left", "right"
	 * - Binary tree: "bottom-left", "bottom-right"
	 * - Diagonal: "top-left", "top-right"
	 */
	import { createEventDispatcher, onMount, onDestroy } from "svelte";
	import { get } from "svelte/store";
	import { svgRect, nodeCenterMap } from "../src/ui_store";
	export let id;
	export let x = 0;
	export let y = 0;
	export let class_ = "";
	export let hoveredNode = null;
	export let deletable = true;
	// Array of connection point names (e.g., ["top", "bottom-left", "bottom-right"])
	export let connectionPoints: (
		| "top"
		| "bottom"
		| "left"
		| "right"
		| "bottom-left"
		| "bottom-right"
		| "top-left"
		| "top-right"
	)[] = ["top", "bottom", "left", "right"];
	// Border radius for shape customization (default 6px for backwards compatibility)
	export let borderRadius = "6px";
	// Border color (default #333)
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
		// Guard against null container (component not mounted or destroyed)
		if (!container) {
			// Return fallback position based on last known x,y
			return { x: x + 60, y: y + 30 }; // center of default 120x60
		}
		rect = container.getBoundingClientRect();
		const width = rect ? rect.width : 120;
		const height = rect ? rect.height : 60;

		// Component positions (x, y) are relative to the container
		// SVG is also positioned relative to the same container at (0,0)
		// So we can use x, y directly without adding svgRect offset
		let _x = x;
		let _y = y;

		// Calculate common positions
		const z = typeof window !== "undefined" && window.zoom ? window.zoom : 1;
		const invZ = z === 0 ? 1 : 1 / z;
		// center/edge calculations should factor in current zoom (use division by zoom)
		const centerX = _x + (width / 2) * invZ;
		const centerY = _y + (height / 2) * invZ;
		const halfOffset = (CONNECTION_POINT_OFFSET / 2) * invZ;
		const leftEdge = _x - halfOffset;
		const rightEdge = _x + width * invZ + halfOffset;
		const topEdge = _y - halfOffset;
		const bottomEdge = _y + height * invZ + halfOffset;
		const leftThird = _x + width * 0.3 * invZ;
		const rightThird = _x + width * 0.7 * invZ;
		const upperQuarter = _y + height * 0.25 * invZ;

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
		nodeCenterMap.update((map) => {
			map[`${id}-${side}`] = () => getNodeCenter(side);
			return map;
		});
	}

	onMount(() => {
		// Register all connection points specified by the parent component
		connectionPoints.forEach(registerNode);
	});

	// Re-register when connection points change
	$: if (connectionPoints) {
		connectionPoints.forEach(registerNode);
	}

	onDestroy(() => {
		// Remove registered callbacks to avoid stale references
		nodeCenterMap.update((map) => {
			connectionPoints.forEach((side) => {
				//remove map[` ${id}-${side}`];
				delete map[`${id}-${side}`];
			});
			return map;
		});
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	bind:this={container}
	id={"comp-" + id}
	class={class_}
	style="--connection-point-size:{CONNECTION_POINT_SIZE}px; position:absolute; left:{x}px; top:{y}px; border:2px solid {borderColor}; background:#fff; border-radius:{borderRadius}; box-shadow:0 2px 8px #0002; user-select:none; cursor:{dragging
		? 'grabbing'
		: 'default'}; padding:8px;"
	on:mousedown={handleMouseDown}
	on:click|stopPropagation
	role="button"
	tabindex="0"
>
	{#if deletable}
		<button
			on:mousedown|stopPropagation
			on:click|stopPropagation={() => dispatch("delete", { id })}
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
		></div>
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
