<script>
	import { createEventDispatcher } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x;
	export let y;
	export let value = "";
	export let hoveredNode = null;
	export let class_ = "";
	export let name = "Pointer"; // Display name for the pointer

	const dispatch = createEventDispatcher();

	// Define which connection points this component exposes
	// Pointers typically only need a right connection (pointing to something)
	const connectionPoints = ["right"];
</script>

<ComponentBox
	{id}
	{x}
	{y}
	{class_}
	{connectionPoints}
	{hoveredNode}
	on:move={(e) => dispatch("move", e.detail)}
	on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
	on:delete={(e) => dispatch("delete", e.detail)}
>
	<div class="pointer-content">
		<!-- Editable name input -->
		<input
			type="text"
			bind:value={name}
			placeholder="Pointer"
			class="pointer-name"
			on:input={() => dispatch("nameChange", { id, name })}
			on:click|stopPropagation
		/>
	</div>
</ComponentBox>

<style>
	.pointer-content {
		display: flex;
		align-items: center;
		min-width: 80px;
	}

	.pointer-name {
		width: 100%;
		font-size: 1.1em;
		border: none;
		outline: none;
		background: transparent;
		padding: 4px;
		box-sizing: border-box;
	}
</style>
