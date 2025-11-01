<script>
	import { createEventDispatcher } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x = 0;
	export let y = 0;
	export let value = "";
	export let class_ = "";
	export let selected = false;
	export let childCount = 3; // Default number of children

	const dispatch = createEventDispatcher();
	let editing = false;

	// Handle creating a new connected node
	function createNodeInDirection(direction) {
		dispatch("createConnectedNode", {
			sourceId: id,
			direction,
		});
	}

	function handleDblClick() {
		editing = true;
		setTimeout(() => {
			const input = document.getElementById(`nary-node-edit-${id}`);
			if (input) input.focus();
		}, 0);
	}

	function handleBlur() {
		editing = false;
	}

	function handleInput(e) {
		value = e.target.value;
	}

	// Calculate positions for N children
	$: childPositions = Array.from({ length: childCount }, (_, i) => {
		const spacing = 60; // Horizontal spacing between children
		const totalWidth = (childCount - 1) * spacing;
		const startX = -totalWidth / 2;
		return startX + i * spacing;
	});
</script>

<ComponentBox
	{id}
	{x}
	{y}
	{class_}
	connectionPoints={["top", "bottom"]}
	borderRadius="50%"
	borderColor="#2e7d32"
	on:move={(e) => dispatch("move", e.detail)}
	on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
	on:delete={(e) => dispatch("delete", e.detail)}
>
	<div class="nary-node-container">
		<!-- The n-ary node -->
		<div class="nary-node">
			<input id={"nary-node-edit-" + id} bind:value class="node-input" />
		</div>

		<!-- Plus buttons (show only when selected) -->
		{#if selected}
			<!-- One button above -->
			<button
				class="add-node-btn top"
				on:click={() => createNodeInDirection("top")}
				title="Add parent node"
			>
				&#43;
			</button>
			<!-- One button below -->
			<button
				class="add-node-btn bottom"
				on:click={() => createNodeInDirection("bottom")}
				title="Add child node"
			>
				&#43;
			</button>
		{/if}
	</div>
</ComponentBox>

<style>
	input {
		text-align: center;
	}

	.nary-node-container {
		position: relative;
	}

	.nary-node {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.node-input {
		width: 4em;
		border: none;
		background: transparent;
		font-size: 14px;
		outline: none;
		text-align: center;
	}

	/* Plus button styling */
	.add-node-btn {
		position: absolute;
		width: 24px;
		height: 24px;
		background: #2e7d32;
		color: white;
		border: none;
		border-radius: 50%;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
		z-index: 10;
		padding: 0;
		padding-bottom: 3px;
	}

	.add-node-btn:hover {
		background: #1b5e20;
	}

	.add-node-btn.top {
		top: -30px;
		left: 50%;
		transform: translateX(-50%);
	}

	.add-node-btn.bottom {
		bottom: -30px;
		left: 50%;
		transform: translateX(-50%);
	}
</style>
