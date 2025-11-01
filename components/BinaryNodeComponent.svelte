<script>
	import { createEventDispatcher } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x = 0;
	export let y = 0;
	export let value = "";
	export let class_ = "";
	export let selected = false;

	const dispatch = createEventDispatcher();

	// Handle creating a new connected node
	function createNodeInDirection(direction) {
		dispatch("createConnectedNode", {
			sourceId: id,
			direction,
		});
	}
</script>

<ComponentBox
	{id}
	{x}
	{y}
	{class_}
	connectionPoints={["top", "bottom-left", "bottom-right"]}
	borderRadius="50%"
	borderColor="#1976d2"
	on:move={(e) => dispatch("move", e.detail)}
	on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
	on:delete={(e) => dispatch("delete", e.detail)}
>
	<div class="binary-node-container">
		<!-- The binary node -->
		<div class="binary-node">
			<input
				bind:value
				class="node-input"
				on:change={(e) => {
					dispatch("propertyChange", {
						id,
						property: "value",
						value: e.target.value,
					});
				}}
			/>
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
			<!-- Two buttons below (left and right children) -->
			<button
				class="add-node-btn bottom-left"
				on:click={() => createNodeInDirection("bottom-left")}
				title="Add left child"
			>
				&#43;
			</button>
			<button
				class="add-node-btn bottom-right"
				on:click={() => createNodeInDirection("bottom-right")}
				title="Add right child"
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

	.binary-node-container {
		/* width: 80px;
		height: 40px; */
		position: relative;
	}

	.binary-node {
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
	}

	/* Plus button styling */
	.add-node-btn {
		position: absolute;
		width: 24px;
		height: 24px;
		background: #1976d2;
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
		background: #0d47a1;
	}

	.add-node-btn.top {
		top: -30px;
		left: 50%;
		transform: translateX(-50%);
	}

	.add-node-btn.bottom-left {
		bottom: -30px;
		left: 25%;
		transform: translateX(-50%);
	}

	.add-node-btn.bottom-right {
		bottom: -30px;
		right: 25%;
		transform: translateX(50%);
	}
</style>
