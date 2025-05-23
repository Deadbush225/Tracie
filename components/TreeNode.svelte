<script>
	import TreeNode from "./TreeNode.svelte";
	export let node;
	export let depth = 0;
	export let x = 0;
	export let y = 0;
	export let addChild;
	export let parentCompId;
	export let path = "";
</script>

<div
	style="position:absolute; left:{x}px; top:{y}px; width:40px; height:40px; text-align:center;"
>
	<div
		style="width:40px; height:40px; border-radius:50%; background:#eee; border:2px solid #333; display:flex; align-items:center; justify-content:center; margin:auto; cursor:pointer;"
		on:pointerdown={handleNodePointerDown}
	>
		<span style="color:#333;">{node.value}</span>
	</div>
	<!-- Left child -->
	{#if node.left}
		<TreeNode
			node={node.left}
			depth={depth + 1}
			x={x - 60}
			y={y + 60}
			{addChild}
			{parentCompId}
			path={path ? path + ".L" : "L"}
			on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
		/>
	{:else}
		<div
			style="position:absolute; left:-20px; top:50px; width:20px; height:20px; cursor:pointer;"
			on:click={() => addChild(node, "left")}
		>
			<div
				style="width:20px; height:20px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center;"
			>
				<span style="color:#333;">+</span>
			</div>
		</div>
	{/if}
	<!-- Right child -->
	{#if node.right}
		<TreeNode
			node={node.right}
			depth={depth + 1}
			x={x + 60}
			y={y + 60}
			{addChild}
			{parentCompId}
			path={path ? path + ".R" : "R"}
			on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
		/>
	{:else}
		<div
			style="position:absolute; left:40px; top:50px; width:20px; height:20px; cursor:pointer;"
			on:click={() => addChild(node, "right")}
		>
			<div
				style="width:20px; height:20px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center;"
			>
				<span style="color:#333;">+</span>
			</div>
		</div>
	{/if}
</div>
