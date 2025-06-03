<script>
	import { svgRect } from "../src/ui_store";

	export let id;
	export let x;
	export let y;
	export let class_ = "";
	export let hoveredNode = null;
	export let maxIndex = 10; // Maximum value for the iterator
	export let linkedArrays = []; // Array of IDs this iterator is linked to
	export let color = "black";

	import { deleteComponent, updateLinkEndpoints } from "../src/Whiteboard_back";
	import { createEventDispatcher, onMount } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";
	const dispatch = createEventDispatcher();
	let container;

	// Make pos reactive to x and y props
	$: pos = { x, y };
	let dragging = false;
	let offset = { x: 0, y: 0 };

	// Track total movement for history
	let startPos = { x: 0, y: 0 };
	let totalDx = 0;
	let totalDy = 0;
	let rect;

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

		return () => {
			window.removeEventListener("iterator-link-created", handleLinkCreated);
		};
	});
</script>

<ComponentBox {id} {x} {y} {class_} on:move={(e) => dispatch("move", e.detail)} on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}>
	<!-- Iterator Controls -->
	<div class="iterator-container">
		<div class="iterator-label" style="color: {color};">Iterator</div>
		<div class="iterator-controls">
			<button class="nav-button" on:click|stopPropagation={moveBackward} disabled={currentIndex <= 0}> ← </button>
			<div class="index-display">
				<span class="index-value">{currentIndex}</span>
			</div>
			<button class="nav-button" on:click|stopPropagation={moveForward} disabled={currentIndex >= maxIndex - 1}> → </button>
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
