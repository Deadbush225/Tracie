<script>
	import { get } from "svelte/store";
	import ComponentBox from "./ComponentBox.svelte";
	import { components } from "../src/Whiteboard_back";
	import { createEventDispatcher, onMount, getContext } from "svelte";

	export let id;
	export let x;
	export let y;
	export let value = "";
	export let class_ = "";
	export let color = "#4CAF50"; // Default color for the node

	const dispatch = createEventDispatcher();
	const nodeRadius = 35; // Size of the circular node

	// Handle value changes
	function handleValueChange(e) {
		value = e.target.value;
	}
</script>

<ComponentBox {id} {x} {y} {class_} on:move={(e) => dispatch("move", e.detail)} on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}>
	<div class="node-container">
		<!-- The circular node -->
		<div class="node" style="background: {color};">
			<input class="node-value" type="text" bind:value on:input={handleValueChange} placeholder="value" />
		</div>

		<!-- Connection points -->
		<div class="connection-points">
			<!-- Left/prev connection -->
			<div
				class="node-connector left"
				data-comp-id={id}
				data-side="left"
				role="button"
				tabindex="0"
				on:mousedown={(e) =>
					dispatch("nodeMouseDown", {
						componentId: id,
						side: "left",
						getNodeCenter: () => {
							const rect = e.target.getBoundingClientRect();
							return { x: rect.left, y: rect.top + rect.height / 2 };
						},
					})}
				on:keydown={() => {}}
			></div>

			<!-- Right/next connection -->
			<div
				class="node-connector right"
				data-comp-id={id}
				data-side="right"
				role="button"
				tabindex="0"
				on:mousedown={(e) =>
					dispatch("nodeMouseDown", {
						componentId: id,
						side: "right",
						getNodeCenter: () => {
							const rect = e.target.getBoundingClientRect();
							return { x: rect.right, y: rect.top + rect.height / 2 };
						},
					})}
				on:keydown={() => {}}
			></div>
		</div>
	</div>
</ComponentBox>

<style>
	.node-container {
		position: relative;
		width: 70px;
		height: 70px;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.node {
		width: 70px;
		height: 70px;
		border-radius: 50%;
		display: flex;
		justify-content: center;
		align-items: center;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
	}

	.node-value {
		width: 50px;
		background: transparent;
		border: none;
		text-align: center;
		font-size: 14px;
		color: white;
		font-weight: bold;
	}

	.node-value:focus {
		outline: none;
	}

	.connection-points {
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		left: 0;
	}

	.node-connector {
		position: absolute;
		width: 12px;
		height: 12px;
		background: #2196f3;
		border-radius: 50%;
		cursor: pointer;
		z-index: 5;
	}

	.node-connector:hover {
		background: #0d47a1;
	}

	.node-connector.left {
		top: 50%;
		left: -6px;
		transform: translateY(-50%);
	}

	.node-connector.right {
		top: 50%;
		right: -6px;
		transform: translateY(-50%);
	}
</style>
