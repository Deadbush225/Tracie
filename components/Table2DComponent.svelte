<script>
	import { svgRect } from "../src/ui_store";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x;
	export let y;
	export let rows = 2; // new: number of rows
	export let cols = 3; // new: number of columns
	export let class_ = "";

	import { deleteComponent, updateLinkEndpoints } from "../src/Whiteboard_back";
	import { createEventDispatcher, onMount } from "svelte";
	const dispatch = createEventDispatcher();

	onMount(() => {
		return () => {};
	});

	// 2D array data
	let data = Array.from({ length: rows }, () => Array(cols).fill(""));

	// Update data if rows/cols change
	$: if (data.length !== rows || data[0]?.length !== cols) {
		const newData = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => data[r]?.[c] ?? ""));
		data = newData;
	}
</script>

<ComponentBox {id} {x} {y} {class_} on:move={(e) => dispatch("move", e.detail)} on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}>
	<!-- 2D Table -->
	<table style="border-collapse:collapse;">
		<tbody>
			<tr>
				<td></td>
				{#each Array(cols) as _, c}
					<td style="border:1px solid #888; padding:6px; background:#e3e3e3; text-align:center;">{c}</td>
				{/each}
			</tr>
			{#each Array(rows) as _, r}
				<tr>
					<td style="border:1px solid #888; padding:6px; background:#e3e3e3; text-align:center;">{r}</td>
					{#each Array(cols) as _, c}
						<td style="border:1px solid #888; padding:6px;">
							<input style="width:40px;" bind:value={data[r][c]} />
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</ComponentBox>

<style>
</style>
