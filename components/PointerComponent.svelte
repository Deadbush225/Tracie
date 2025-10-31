<script>
	import { get } from "svelte/store";
	import { svgRect } from "../src/ui_store";

	export let id;
	export let x;
	export let y;
	export let value = "";
	export let hoveredNode = null;
	export let class_ = "";

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

	function handleMouseDown(event) {
		if (event.currentTarget === event.target) {
			dragging = true;
			offset = {
				x: event.clientX - pos.x,
				y: event.clientY - pos.y,
			};

			// Save starting position for tracking total movement
			startPos = { x: pos.x, y: pos.y };
			totalDx = 0;
			totalDy = 0;
		}
	}

	function handleMouseMove(event) {
		if (dragging) {
			const newPos = {
				x: event.clientX - offset.x,
				y: event.clientY - offset.y,
			};

			if (newPos.x !== pos.x || newPos.y !== pos.y) {
				// Calculate the delta movement for this frame
				const dx = newPos.x - pos.x;
				const dy = newPos.y - pos.y;

				// Update total movement
				totalDx += dx;
				totalDy += dy;

				pos = newPos;

				// Include delta in the event detail with final=false
				dispatch("move", { id, dx, dy, totalDx, totalDy, final: false });
				dispatch("redraw");
			}
		}
	}

	function handleMouseUp() {
		if (dragging) {
			// When releasing, dispatch final position with total movement
			dispatch("move", { id, dx: 0, dy: 0, totalDx, totalDy, final: true });
			dragging = false;
		}
	}

	$: {
		pos;
		if (!dragging) {
			console.log("POSITION CHANGED:");
			updateLinkEndpoints();
		}
	}

	onMount(() => {
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	});

	function getNodeCenter(side) {
		// Use the component's current position (pos.x, pos.y) instead of rect + scroll
		const width = rect.width;
		const height = rect.height;

		// Component positions are relative to the container, same as SVG
		switch (side) {
			case "top":
				return {
					x: pos.x + width / 2,
					y: pos.y - 6,
				};
			case "bottom":
				return {
					x: pos.x + width / 2,
					y: pos.y + height + 6,
				};
			case "left":
				return {
					x: pos.x - 6,
					y: pos.y + height / 2,
				};
			case "right":
				return {
					x: pos.x + width + 6,
					y: pos.y + height / 2,
				};
		}
	}

	function registerNode(side) {
		if (!window.__getNodeCenterMap) window.__getNodeCenterMap = {};
		window.__getNodeCenterMap[`${id}-${side}`] = () => getNodeCenter(side);
	}
	onMount(() => {
		["top", "bottom", "left", "right"].forEach(registerNode);
	});
</script>

<ComponentBox
	{id}
	{x}
	{y}
	{class_}
	on:move={(e) => dispatch("move", e.detail)}
	on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
>
	<!-- Editable line input -->
	<input
		type="text"
		bind:value
		style="width:100%; font-size:1.1em; border:none; outline:none; background:transparent; padding:4px;"
		on:input={() => dispatch("edit", { id, value })}
	/>
</ComponentBox>

<style>
	input[type="text"] {
		box-sizing: border-box;
	}
</style>
