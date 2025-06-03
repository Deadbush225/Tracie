<script>
	import { createEventDispatcher } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x = 0;
	export let y = 0;
	export let value = "";
	export let class_ = "";

	const dispatch = createEventDispatcher();
	let editing = false;

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
