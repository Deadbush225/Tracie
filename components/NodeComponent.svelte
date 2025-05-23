<script>
	import { createEventDispatcher } from "svelte";

	export let id;
	export let x = 0;
	export let y = 0;
	export let label = "";
	export let side = "";
	export let parentId = null;
	export let col = null;
	export let hoveredNode = null;

	let editing = false;
	let inputValue = label;

	const dispatch = createEventDispatcher();

	$: inputValue = label;

	function handleDblClick() {
		editing = true;
		setTimeout(() => {
			const input = document.getElementById(`node-edit-${id}`);
			if (input) input.focus();
		}, 0);
	}

	function handleBlur() {
		editing = false;
		dispatch("nameChange", inputValue);
	}

	function handleInput(e) {
		inputValue = e.target.value;
	}

	function handlePointerDown(e) {
		e.stopPropagation(); // Alternative to event modifier
		dispatch("nodeMouseDown", {
			id, // This is the component's main ID
			side, // Indicates the main body of the node
			parentId: parentId || id, // If parentId is not set, it's the main component
			col,
			getNodeCenter: () => {
				const rect = e.currentTarget.getBoundingClientRect();
				return {
					x: rect.left + rect.width / 2,
					y: rect.top + rect.height / 2,
				};
			},
		});
	}
</script>

<div
	class="node"
	tabindex="0"
	style="position:absolute; left:{x}px; top:{y}px; width:32px; height:32px; border-radius:50%; border:2px solid #1976d2; background:#fff; display:flex; align-items:center; justify-content:center; user-select:none; cursor:pointer;"
	on:pointerdown|stopPropagation={handlePointerDown}
	data-parent-id={parentId}
	data-comp-id={id}
	data-side={side}
	data-col={col}
>
	<!-- Nodes on all sides for linking -->
	<div
		class="node-link {hoveredNode &&
		hoveredNode.componentId == id && // Should be parentId if this is a sub-node, or use a unique ID for sub-nodes
		hoveredNode.side === 'top'
			? 'node-hovered'
			: ''}"
		data-parent-id={parentId || id}
		data-comp-id={id} // This might need to be a more specific sub-node ID if NodeComponent can have sub-nodes
		data-side="top"
		style="position:absolute; left:50%; top:-10px; transform:translateX(-50%); pointer-events:auto;"
		on:pointerdown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				id: parentId || id, // ID of the component this link point belongs to
				side: "top",
				parentId: parentId || id,
				col,
				getNodeCenter: () => {
					// This querySelector might need adjustment if NodeComponent is nested.
					// It's safer to get the rect from the event.currentTarget of *this* specific link point.
					const el = document.querySelector(
						`[data-comp-id="${id}"][data-side="top"]` // This selector might be problematic if id is not unique enough for sub-elements
					);
					if (!el) return {x:0,y:0};
					const rect = el.getBoundingClientRect();
					return {
						x: rect.left + rect.width / 2,
						y: rect.top + rect.height / 2,
					};
				},
			})}
	/>
	<div
		class="node-link {hoveredNode &&
		hoveredNode.componentId == id &&
		hoveredNode.side === 'bottom'
			? 'node-hovered'
			: ''}"
		data-parent-id={parentId || id}
		data-comp-id={id}
		data-side="bottom"
		style="position:absolute; left:50%; bottom:-10px; transform:translateX(-50%); pointer-events:auto;"
		on:pointerdown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				id: parentId || id,
				side: "bottom",
				parentId: parentId || id,
				col,
				getNodeCenter: () => {
					const el = document.querySelector(
						`[data-comp-id="${id}"][data-side="bottom"]` 
					);
					if (!el) return {x:0,y:0};
					const rect = el.getBoundingClientRect();
					return {
						x: rect.left + rect.width / 2,
						y: rect.top + rect.height / 2,
					};
				},
			})}
	/>
	<div
		class="node-link {hoveredNode &&
		hoveredNode.componentId == id &&
		hoveredNode.side === 'left'
			? 'node-hovered'
			: ''}"
		data-parent-id={parentId || id}
		data-comp-id={id}
		data-side="left"
		style="position:absolute; left:-10px; top:50%; transform:translateY(-50%); pointer-events:auto;"
		on:pointerdown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				id: parentId || id,
				side: "left",
				parentId: parentId || id,
				col,
				getNodeCenter: () => {
					const el = document.querySelector(
						`[data-comp-id="${id}"][data-side="left"]`
					);
					if (!el) return {x:0,y:0};
					const rect = el.getBoundingClientRect();
					return {
						x: rect.left + rect.width / 2,
						y: rect.top + rect.height / 2,
					};
				},
			})}
	/>
	<div
		class="node-link {hoveredNode &&
		hoveredNode.componentId == id &&
		hoveredNode.side === 'right'
			? 'node-hovered'
			: ''}"
		data-parent-id={parentId || id}
		data-comp-id={id}
		data-side="right"
		style="position:absolute; right:-10px; top:50%; transform:translateY(-50%); pointer-events:auto;"
		on:pointerdown|stopPropagation={() =>
			dispatch("nodeMouseDown", {
				id: parentId || id,
				side: "right",
				parentId: parentId || id,
				col,
				getNodeCenter: () => {
					const el = document.querySelector(
						`[data-comp-id="${id}"][data-side="right"]`
					);
					if (!el) return {x:0,y:0};
					const rect = el.getBoundingClientRect();
					return {
						x: rect.left + rect.width / 2,
						y: rect.top + rect.height / 2,
					};
				},
			})}
	/>
	<!-- Main node content -->
	{#if editing}
		<input
			id={"node-edit-" + id}
			value={inputValue}
			on:input={handleInput}
			on:blur={handleBlur}
			style="width:60px; font-size:13px;"
		/>
	{:else}
		<span style="color:#1976d2; font-size:13px;" on:dblclick={handleDblClick}
			>{label}</span
		>
	{/if}
</div>

<style>
	.node:focus {
		outline: 2px solid #1976d2;
	}
	.node-link {
		width: 12px;
		height: 12px;
		background: #1976d2;
		border-radius: 50%;
		position: absolute;
		transition:
			box-shadow 0.1s,
			border 0.1s,
			background 0.1s;
		pointer-events: auto;
	}
	.node-hovered {
		box-shadow: 0 0 0 6px rgba(25, 118, 210, 0.2);
		border: 2px solid #1976d2;
		background: #fff;
	}
</style>
