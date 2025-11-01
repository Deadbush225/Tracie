<script>
	import { createEventDispatcher } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x;
	export let y;
	export let value = "";
	export let class_ = "";
	export let color = "#4CAF50"; // Default color for the node
	export let hoveredNode = null;

	const dispatch = createEventDispatcher();

	// Define which connection points this component exposes
	// Variables typically have left and right connections
	const connectionPoints = ["left", "right"];

	// Handle value changes
	function handleValueChange(e) {
		value = e.target.value;
	}
</script>

<ComponentBox
	{id}
	{x}
	{y}
	{class_}
	{connectionPoints}
	{hoveredNode}
	borderRadius="50%"
	borderColor={color}
	on:move={(e) => dispatch("move", e.detail)}
	on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
	on:delete={(e) => dispatch("delete", e.detail)}
>
	<div class="node-container">
		<!-- The circular node -->
		<div class="node" style="background: {color};">
			<input
				class="node-value"
				type="text"
				bind:value
				on:input={handleValueChange}
				placeholder="value"
			/>
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
</style>
