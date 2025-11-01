<script>
	import { createEventDispatcher, onMount } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x;
	export let y;
	export let class_ = "";
	export let hoveredNode = null;
	export let maxIndex = 10; // Maximum value for the iterator
	export let linkedArrays = []; // Array of IDs this iterator is linked to
	export let color = "black";
	export let name = "Iterator"; // Display name for the iterator
	export let selected = false; // Whether this iterator is selected

	const dispatch = createEventDispatcher();

	// Define connection points - iterators typically connect from bottom to arrays
	const connectionPoints = ["bottom"];

	// Iterator state
	let currentIndex = 0;

	function moveForward() {
		if (currentIndex < maxIndex - 1) {
			currentIndex++;
			notifyLinkedArrays();
		}
	}

	function moveBackward() {
		if (currentIndex > 0) {
			currentIndex--;
			notifyLinkedArrays();
		}
	}

	function notifyLinkedArrays() {
		console.log(linkedArrays);
		for (const link of linkedArrays) {
			dispatch("indexUpdate", {
				iteratorId: id,
				index: currentIndex,
				linkedArrayId: link.id,
				color,
				linkDirection: link.direction,
			});
		}
	}

	// Keyboard navigation when selected
	function handleKeyDown(event) {
		// Only respond to arrow keys when this iterator is selected
		if (!selected) return;

		// Check if user is typing in an input
		const activeElement = document.activeElement;
		const isTyping =
			activeElement &&
			(activeElement.tagName === "INPUT" ||
				activeElement.tagName === "TEXTAREA" ||
				(activeElement instanceof HTMLElement &&
					activeElement.isContentEditable));

		if (isTyping) return;

		if (event.key === "ArrowLeft") {
			event.preventDefault();
			moveBackward();
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			moveForward();
		}
	}

	onMount(() => {
		// Initial notification
		notifyLinkedArrays();

		function handleLinkCreated(e) {
			console.log("LINK created");
			// If this iterator is involved in the new link, notify linked arrays
			console.log(e);
			console.log(id);
			if (e.detail.fromId === id || e.detail.toId === id) {
				console.log("Notifying");
				Promise.resolve().then(() => {
					notifyLinkedArrays();
				});
			}
		}
		window.addEventListener("iterator-link-created", handleLinkCreated);
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.removeEventListener("iterator-link-created", handleLinkCreated);
			window.removeEventListener("keydown", handleKeyDown);
		};
	});
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
	<!-- Iterator Controls -->
	<div class="iterator-container">
		<input
			type="text"
			bind:value={name}
			class="iterator-label"
			style="color: {color};"
			placeholder="Iterator"
			on:input={(e) => dispatch("nameChange", { id, name: e.target.value })}
			on:click|stopPropagation
		/>
		<div class="iterator-controls">
			<button
				class="nav-button"
				on:click|stopPropagation={moveBackward}
				disabled={currentIndex <= 0}
			>
				←
			</button>
			<div class="index-display">
				<span class="index-value">{currentIndex}</span>
			</div>
			<button
				class="nav-button"
				on:click|stopPropagation={moveForward}
				disabled={currentIndex >= maxIndex - 1}
			>
				→
			</button>
		</div>
	</div>
</ComponentBox>

<style>
	.iterator-container {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.iterator-label {
		font-weight: bold;
		margin-bottom: 5px;
		font-size: 14px;
		border: none;
		background: transparent;
		outline: none;
		text-align: center;
		width: 100%;
		/* color: #444; */
	}
	.iterator-controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}
	.nav-button {
		background: #e3e3e3;
		border: 1px solid #888;
		border-radius: 4px;
		padding: 4px 10px;
		cursor: pointer;
		font-weight: bold;
	}
	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.nav-button:hover:not(:disabled) {
		background: #d0d0d0;
	}
	.index-display {
		border: 1px solid #888;
		border-radius: 4px;
		padding: 6px 12px;
		background: #f5f5f5;
		margin: 0 8px;
		min-width: 20px;
		text-align: center;
	}
	.index-value {
		font-weight: bold;
		font-size: 16px;
	}
	.delete-x {
		position: absolute;
		right: 4px;
		top: 2px;
		background: none;
		border: none;
		font-size: 18px;
		cursor: pointer;
		color: #888;
	}
	.delete-x:hover {
		color: #d32f2f;
	}
</style>
