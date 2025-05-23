<script>
	import TreeNode from "./TreeNode.svelte";
	import { createEventDispatcher } from "svelte";

	export let id;
	export let x = 0;
	export let y = 0;
	export let name = "";
	export let tree = { value: "root", left: null, right: null };

	let editing = false;
	let inputValue = name;

	const dispatch = createEventDispatcher();

	$: inputValue = name;

	function handleDblClick() {
		editing = true;
		setTimeout(() => {
			const input = document.getElementById(`tree-edit-${id}`);
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

	function addChild(node, side) {
		node[side] = { value: "?", left: null, right: null };
		tree = { ...tree }; // Trigger reactivity
	}

	function forwardNodeMouseDown(event) {
		dispatch("nodeMouseDown", event.detail);
	}
</script>

<div style="position:absolute; left:{x}px; top:{y}px; min-width:120px;">
	{#if editing}
		<input
			id={"tree-edit-" + id}
			value={inputValue}
			on:input={handleInput}
			on:blur={handleBlur}
			style="margin-bottom:4px; width:80%;"
		/>
	{:else}
		<div
			style="text-align:center; color:#1976d2; font-weight:bold; margin-bottom:4px; cursor:pointer;"
			on:dblclick={handleDblClick}
		>
			{name}
		</div>
	{/if}
	<TreeNode
		node={tree}
		depth={0}
		x={60}
		y={30}
		{addChild}
		parentCompId={id}
		path="root"
		on:nodeMouseDown={forwardNodeMouseDown}
	/>
</div>
<!-- TreeNode logic moved to its own component (TreeNode.svelte) -->
