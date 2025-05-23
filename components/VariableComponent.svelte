<script>
	import { createEventDispatcher } from "svelte";
	export let id;
	export let x = 0;
	export let y = 0;
	export let name = "";
	export let value = "";

	let editingName = false;
	let editingValue = false;
	let inputName = name;
	let inputValue = value;

	const dispatch = createEventDispatcher();

	$: inputName = name;
	$: inputValue = value;

	function handleNameDblClick() {
		editingName = true;
		setTimeout(() => {
			const input = document.getElementById(`var-edit-name-${id}`);
			if (input) input.focus();
		}, 0);
	}
	function handleValueDblClick() {
		editingValue = true;
		setTimeout(() => {
			const input = document.getElementById(`var-edit-value-${id}`);
			if (input) input.focus();
		}, 0);
	}
	function handleNameBlur() {
		editingName = false;
		dispatch("nameChange", inputName);
	}
	function handleValueBlur() {
		editingValue = false;
		dispatch("valueChange", inputValue);
	}
	function handleNameInput(e) {
		inputName = e.target.value;
	}
	function handleValueInput(e) {
		inputValue = e.target.value;
	}
</script>

<div
	style="position:absolute; left:{x}px; top:{y}px; background:#fffde7; border:2px solid #fbc02d; border-radius:7px; width:80px; height:36px; display:flex; align-items:center; justify-content:space-between; padding:4px 8px; box-sizing:border-box;"
>
	{#if editingName}
		<input
			id={"var-edit-name-" + id}
			value={inputName}
			on:input={handleNameInput}
			on:blur={handleNameBlur}
			style="width:38px;"
		/>
	{:else}
		<span
			style="color:#fbc02d; font-size:14px; cursor:pointer;"
			on:dblclick={handleNameDblClick}>{name}</span
		>
	{/if}
	{#if editingValue}
		<input
			id={"var-edit-value-" + id}
			value={inputValue}
			on:input={handleValueInput}
			on:blur={handleValueBlur}
			style="width:28px;"
		/>
	{:else}
		<span
			style="color:#fbc02d; font-size:14px; cursor:pointer;"
			on:dblclick={handleValueDblClick}>{value}</span
		>
	{/if}
</div>
