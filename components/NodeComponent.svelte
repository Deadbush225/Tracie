<script>
	import { createEventDispatcher } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x = 0;
	export let y = 0;
	export let value = "";
	export let class_ = "";
	export let selected = false; // Add this to track selection state

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
			const input = document.getElementById(`node-edit-${id}`);
			if (input) input.focus();
		}, 0);
	}

	function handleBlur() {
		editing = false;
	}

	function handleInput(e) {
		value = e.target.value;
	}
</script>

<ComponentBox {id} {x} {y} {class_} on:move={(e) => dispatch("move", e.detail)} on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}>
	<div class="node-container">
		<!-- The rectangular node -->
		<div class="node">
			<!-- Main content -->
			{#if editing}
				<input id={"node-edit-" + id} {value} on:input={handleInput} on:blur={handleBlur} class="node-input" />
			{:else}
				<span class="node-value" on:dblclick={handleDblClick}>
					{value || "Value"}
				</span>
			{/if}

			<!-- Next pointer -->
			<!-- <div class="next-pointer">
				<span class="pointer-label">next</span>
				<div
					class="connector"
					data-comp-id={id}
					role="button"
					tabindex="0"
					on:mousedown={(e) =>
						dispatch("nodeMouseDown", {
							componentId: id,
							getNodeCenter: () => {
								const rect = e.target.getBoundingClientRect();
								return { x: rect.right, y: rect.top + rect.height / 2 };
							},
						})}
					on:keydown={() => {}}
				></div>
			</div> -->
		</div>
		<!-- Plus buttons (show only when selected) -->
		{#if selected}
			<button class="add-node-btn top" on:click={() => createNodeInDirection("top")}>&#43;</button>
			<button class="add-node-btn right" on:click={() => createNodeInDirection("right")}>&#43;</button>
			<button class="add-node-btn bottom" on:click={() => createNodeInDirection("bottom")}>&#43;</button>
			<button class="add-node-btn left" on:click={() => createNodeInDirection("left")}>&#43;</button>
		{/if}
	</div>
</ComponentBox>

<style>
	.node-container {
		width: 120px;
		height: 40px;
		position: relative;
	}

	.node {
		width: 100%;
		height: 100%;
		/* border: 2px solid #1976d2; */
		border-radius: 50%;
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		/* box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); */
		/* padding-left: 10px; */
	}

	.node-value {
		font-size: 14px;
		color: #333;
		cursor: text;
	}

	.node-input {
		width: 60px;
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

	.add-node-btn.right {
		right: -30px;
		top: 50%;
		transform: translateY(-50%);
	}

	.add-node-btn.bottom {
		bottom: -30px;
		left: 50%;
		transform: translateX(-50%);
	}

	.add-node-btn.left {
		left: -30px;
		top: 50%;
		transform: translateY(-50%);
	}

	/* Custom Node */
	.next-pointer {
		position: absolute;
		right: 0;
		top: 0;
		height: 100%;
		display: flex;
		align-items: center;
		padding-right: 20px;
	}

	.pointer-label {
		font-size: 12px;
		color: #666;
		margin-right: 4px;
	}

	.connector {
		width: 12px;
		height: 12px;
		background: #1976d2;
		border-radius: 50%;
		position: absolute;
		right: -6px;
		cursor: pointer;
	}

	.connector:hover {
		background: #0d47a1;
	}
</style>
