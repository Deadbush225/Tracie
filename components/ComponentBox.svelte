<script>
	import { createEventDispatcher, onMount } from "svelte";
	import { svgRect } from "../src/ui_store";
	export let id;
	export let x = 0;
	export let y = 0;
	export let class_ = "";
	export let hoveredNode = null;
	export let deletable = true;
	// New prop: array of connection point names (e.g., ["top", "bottom-left", "bottom-right"])
	export let connectionPoints = ["top", "bottom", "left", "right"];

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

		let _x = x + svgRect.left;
		let _y = y + svgRect.top;

		// Support custom connection point positions
		switch (side) {
			case "top":
				return { x: _x + width / 2, y: _y - 6 };
			case "bottom":
				return { x: _x + width / 2, y: _y + height + 6 };
			case "left":
				return { x: _x - 6, y: _y + height / 2 };
			case "right":
				return { x: _x + width + 6, y: _y + height / 2 };
			// Binary tree connections
			case "bottom-left":
				return { x: _x + width * 0.3, y: _y + height + 6 };
			case "bottom-right":
				return { x: _x + width * 0.7, y: _y + height + 6 };
			// Diagonal connections
			case "top-left":
				return { x: _x - 6, y: _y + height * 0.25 };
			case "top-right":
				return { x: _x + width + 6, y: _y + height * 0.25 };
			default:
				return { x: _x + width / 2, y: _y + height / 2 };
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
	style="position:absolute; left:{x}px; top:{y}px; border:1px solid #333; background:#fff; border-radius:6px; box-shadow:0 2px 8px #0002; user-select:none; cursor:{dragging
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
		<div
			class="node {hoveredNode &&
			hoveredNode.componentId === id &&
			hoveredNode.side === side
				? 'node-hovered'
				: ''}"
			data-comp-id={id}
			data-side={side}
			style="{side === 'top'
				? 'left:50%; top:-14px; transform:translateX(-50%);'
				: ''}
                   {side === 'bottom'
				? 'left:50%; bottom:-14px; transform:translateX(-50%);'
				: ''}
                   {side === 'left'
				? 'left:-14px; top:50%; transform:translateY(-50%);'
				: ''}
                   {side === 'right'
				? 'right:-14px; top:50%; transform:translateY(-50%);'
				: ''}
                   {side === 'bottom-left'
				? 'left:30%; bottom:-14px; transform:translateX(-50%);'
				: ''}
                   {side === 'bottom-right'
				? 'left:70%; bottom:-14px; transform:translateX(-50%);'
				: ''}
                   {side === 'top-left'
				? 'left:-14px; top:25%; transform:translateY(-50%);'
				: ''}
                   {side === 'top-right'
				? 'right:-14px; top:25%; transform:translateY(-50%);'
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
