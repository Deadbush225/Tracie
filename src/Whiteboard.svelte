<script>
	import ArrayComponent from "../components/ArrayComponent.svelte";
	import Table2DComponent from "../components/Table2DComponent.svelte";
	import PointerComponent from "../components/PointerComponent.svelte";

	import {
		components,
		links,
		addArrayComponent,
		add2DTableComponent,
		addPointerComponent,
		nextId,
		duplicateComponent,
		createLink,
		deleteLink,
		deleteComponent,
		moveComponent,
		moveMultipleComponents,
		undo,
		redo,
		commandHistory,
		makeSmartOrBezierPath,
		linkEndpoints,
		updateLinks,
	} from "./Whiteboard_back";

	import { onMount } from "svelte";
	import { updateSvgRect2, svgRect } from "./ui_store";

	let linkingFrom = null;
	let draggingLink = null;
	let mouse = { x: 0, y: 0 };
	let svgContainer;
	// let svgRect = { left: 0, top: 0 };

	let hoveredNode = null;

	// Change from single selectedLink to array model
	let selectedLinks = [];
	let selectedLink = null; // Keep for backward compatibility

	// Add component selection functionality
	let selectedComponentIds = [];

	$: comps = $components;
	$: ls = $links;

	// Helper to get a component's bounding box by id
	function getComponentBox(id) {
		const el = document.getElementById(`array-comp-${id}`);
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		const bounding_rect = {
			left: rect.left - svgRect.left,
			right: rect.right - svgRect.left,
			top: rect.top - svgRect.top,
			bottom: rect.bottom - svgRect.top,
			width: rect.width,
			height: rect.height,
			centerX: (rect.left + rect.right) / 2 - svgRect.left,
			centerY: (rect.top + rect.bottom) / 2 - svgRect.top,
		};

		// console.log(bounding_rect);
		return bounding_rect;
	}

	// Helper: get all bounding boxes except the source and target
	function getAllComponentBoxes(excludeIds = []) {
		return comps
			.filter((c) => !excludeIds.includes(c.id))
			.map((c) => ({ id: c.id, ...getComponentBox(c.id) }))
			.filter((b) => b.left !== undefined && b.top !== undefined);
	}

	onMount(() => {
		updateSvgRect();
		window.addEventListener("resize", updateSvgRect);
		return () => window.removeEventListener("resize", updateSvgRect);
	});

	function updateSvgRect() {
		updateSvgRect2(svgContainer);
	}

	function handleNodeMouseDown({ detail }) {
		draggingLink = {
			from: {
				componentId: detail.componentId,
				side: detail.side,
				getNodeCenter: detail.getNodeCenter,
			},
		};
		hoveredNode = null;
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
	}

	function handleMouseMove(e) {
		mouse = { x: e.clientX, y: e.clientY };
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (el && el.classList.contains("node")) {
			const compId = +el.getAttribute("data-comp-id");
			const side = el.getAttribute("data-side");
			if (compId !== draggingLink.from.componentId && window.__getNodeCenterMap && window.__getNodeCenterMap[`${compId}-${side}`]) {
				hoveredNode = {
					componentId: compId,
					side,
					getNodeCenter: window.__getNodeCenterMap[`${compId}-${side}`],
				};
				return;
			}
		}
		hoveredNode = null;
	}

	function linkExists(a, b) {
		return ls.some(
			(l) =>
				(l.from.componentId === a.componentId && l.from.side === a.side && l.to.componentId === b.componentId && l.to.side === b.side) ||
				(l.from.componentId === b.componentId && l.from.side === b.side && l.to.componentId === a.componentId && l.to.side === a.side)
		);
	}

	function handleMouseUp(e) {
		window.removeEventListener("mousemove", handleMouseMove);
		window.removeEventListener("mouseup", handleMouseUp);

		if (hoveredNode && draggingLink && !linkExists(draggingLink.from, hoveredNode)) {
			// Create the link using the command system
			createLink(draggingLink.from, hoveredNode);
		}
		draggingLink = null;
		hoveredNode = null;
	}

	// Call this after any move or link change
	// $: updateLinkTableAndLinks();

	function handleComponentMove(event) {
		const { id, dx, dy, final } = event.detail;

		// Problem: There's duplicate movement happening because:
		// 1. The component already updated its own position
		// 2. We're applying the delta again to the component here

		if (final) {
			// Only record history on final move (mouse up)
			if (selectedComponentIds.length > 1 && selectedComponentIds.includes(id)) {
				// For multi-selection, use the totalDx/totalDy for history
				moveMultipleComponents(selectedComponentIds, event.detail.totalDx, event.detail.totalDy);
			} else {
				// For single component, use the totalDx/totalDy for history
				moveComponent(id, event.detail.totalDx, event.detail.totalDy);
			}
		} else {
			// During drag, we should NOT update positions again - components already updated themselves
			// Let's update only OTHER selected components that need to move together
			if (selectedComponentIds.length > 1 && selectedComponentIds.includes(id)) {
				components.update((comps) =>
					comps.map((comp) => {
						// Only update OTHER selected components, not the one being dragged
						if (selectedComponentIds.includes(comp.id) && comp.id !== id) {
							return { ...comp, x: comp.x + dx, y: comp.y + dy };
						}
						return comp;
					})
				);
			}
		}

		updateLinks(); // Ensure links are updated immediately
	}

	// Helper to get endpoints and path for all links (reactive)

	function handleLinkClick(link, event) {
		event.stopPropagation();

		// Multi-selection with Shift key
		if (event.shiftKey) {
			if (selectedLinks.includes(link)) {
				// If already selected, remove it
				selectedLinks = selectedLinks.filter((l) => l !== link);
				if (selectedLink === link) selectedLink = null;
			} else {
				// Add to selection
				selectedLinks = [...selectedLinks, link];
				selectedLink = link; // Keep the legacy behavior of highlighting the last clicked link
			}
		} else {
			// Single selection
			selectedLinks = [link];
			selectedLink = link;
			// Clear component selection when selecting link without shift
			selectedComponentIds = [];
		}
	}

	function deleteSelectedLinks() {
		if (selectedLinks.length > 0) {
			// Delete each link individually to track in history
			for (const link of selectedLinks) {
				deleteLink(link);
			}
			selectedLinks = [];
			selectedLink = null;
		}
	}

	// Listen for keyboard shortcuts (Ctrl+D to duplicate, Delete to remove)
	function handleKeyDown(event) {
		// Delete component/link
		if (event.key === "Delete" || event.key === "Backspace") {
			// Delete links first if any are selected
			if (selectedLinks.length > 0) {
				deleteSelectedLinks();
			} else if (selectedComponentIds.length > 0) {
				// Delete all selected components
				for (const id of selectedComponentIds) {
					deleteComponent(id);
				}
				selectedComponentIds = [];
			}
		}

		// Duplicate selected components and links with Ctrl+D
		if (event.ctrlKey && event.key === "d") {
			event.preventDefault();

			// First, duplicate all selected components and collect their new IDs
			const oldToNewIdMap = {}; // Mapping of old IDs to new IDs (for link duplication)
			const newIds = [];

			// Duplicate components first
			if (selectedComponentIds.length > 0) {
				for (const selectedId of selectedComponentIds) {
					const newId = duplicateComponent(selectedId, 20, 20);
					if (newId) {
						newIds.push(newId);
						oldToNewIdMap[selectedId] = newId;
					}
				}
			}

			// Then duplicate any selected links
			if (selectedLinks.length > 0) {
				links.update((current) => {
					const newLinks = [...current];

					for (const link of selectedLinks) {
						// Only duplicate links if both components are selected and duplicated
						const fromId = link.from.componentId;
						const toId = link.to.componentId;

						if (oldToNewIdMap[fromId] && oldToNewIdMap[toId]) {
							// Create new link between the duplicated components
							const newLink = {
								...link,
								from: {
									...link.from,
									componentId: oldToNewIdMap[fromId],
								},
								to: {
									...link.to,
									componentId: oldToNewIdMap[toId],
								},
								// Generate a new color so it's not identical
								color:
									"#" +
									Math.floor(Math.random() * 0xffffff)
										.toString(16)
										.padStart(6, "0"),
							};

							newLinks.push(newLink);
						}
					}

					return newLinks;
				});
			}

			// Select the newly created components
			if (newIds.length > 0) {
				selectedComponentIds = newIds;
				selectedLinks = []; // Clear link selection since we have new components selected
				selectedLink = null;
			}
		}

		// Select all components with Ctrl+A
		if (event.ctrlKey && event.key === "a") {
			event.preventDefault();
			selectedComponentIds = comps.map((comp) => comp.id);
		}

		// Undo with Ctrl+Z
		if (event.ctrlKey && event.key === "z") {
			event.preventDefault();
			undo();
		}

		// Redo with Ctrl+Y or Ctrl+Shift+Z
		if ((event.ctrlKey && event.key === "y") || (event.ctrlKey && event.shiftKey && event.key === "z")) {
			event.preventDefault();
			redo();
		}
	}

	// Subscribe to command history changes to enable/disable undo/redo buttons
	let canUndo = false;
	let canRedo = false;

	commandHistory.subscribe((h) => {
		canUndo = h.undoStack.length > 0;
		canRedo = h.redoStack.length > 0;
	});

	onMount(() => {
		updateSvgRect();
		window.addEventListener("resize", updateSvgRect);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("resize", updateSvgRect);
			window.removeEventListener("keydown", handleKeyDown);
		};
	});

	function handleComponentClick(comp, event) {
		console.log("Component clicked:", comp.id);
		// Don't select if we're dragging a link
		if (draggingLink) {
			return;
		}

		// Multi-selection with Shift key
		if (event.shiftKey) {
			// If already selected, remove from selection
			if (selectedComponentIds.includes(comp.id)) {
				selectedComponentIds = selectedComponentIds.filter((id) => id !== comp.id);
			} else {
				// Add to selection
				selectedComponentIds = [...selectedComponentIds, comp.id];
			}
		} else if (!selectedComponentIds.includes(comp.id)) {
			// Only replace selection if clicking on an unselected component
			selectedComponentIds = [comp.id];
		}

		// Always stop propagation to prevent background deselection
		event.stopPropagation();
	}

	// This function will start the group drag operation
	function handleMouseDownOnComponent(comp, event) {
		console.log("Mouse down on component:", comp.id);

		// Only start group drag if clicking on a selected component
		if (selectedComponentIds.includes(comp.id)) {
			handleGroupDragStart(event);
		}

		// Stop propagation to prevent the background selection box
		event.stopPropagation();
	}

	// Selection box visualizer (add it to the relative position container)
	$: {
		if (selectedComponentIds.length > 0) {
			// Find bounding box of all selected components
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			selectedComponentIds.forEach((id) => {
				const box = getComponentBox(id);
				if (box) {
					minX = Math.min(minX, box.left);
					minY = Math.min(minY, box.top);
					maxX = Math.max(maxX, box.right);
					maxY = Math.max(maxY, box.bottom);
				}
			});

			// Update selection box styles
			const selectionOverlay = document.querySelector(".group-selection-box");
			if (selectionOverlay) {
				selectionOverlay.style.left = `${minX}px`;
				selectionOverlay.style.top = `${minY}px`;
				selectionOverlay.style.width = `${maxX - minX}px`;
				selectionOverlay.style.height = `${maxY - minY}px`;
				selectionOverlay.style.display = "block";
			}
		} else {
			const selectionOverlay = document.querySelector(".group-selection-box");
			if (selectionOverlay) {
				selectionOverlay.style.display = "none";
			}
		}
	}

	// Group movement functionality
	let isDraggingGroup = false;
	let groupDragStart = { x: 0, y: 0 };
	let componentStartPositions = [];

	function handleGroupDragStart(event) {
		if (selectedComponentIds.length > 0 && event.target.closest(".component-wrapper")) {
			isDraggingGroup = true;
			groupDragStart = { x: event.clientX, y: event.clientY };
			componentStartPositions = selectedComponentIds.map((id) => {
				const comp = comps.find((c) => c.id === id);
				return { id, x: comp.x, y: comp.y };
			});
			event.preventDefault();
		}
	}

	function handleGroupDragMove(event) {
		if (isDraggingGroup) {
			const dx = event.clientX - groupDragStart.x;
			const dy = event.clientY - groupDragStart.y;

			// Update UI directly during drag for better performance
			components.update((current) =>
				current.map((comp) => {
					if (selectedComponentIds.includes(comp.id)) {
						const startPos = componentStartPositions.find((p) => p.id === comp.id);
						return {
							...comp,
							x: startPos.x + dx,
							y: startPos.y + dy,
						};
					}
					return comp;
				})
			);
		}
	}

	function handleGroupDragEnd(event) {
		if (isDraggingGroup) {
			const dx = event.clientX - groupDragStart.x;
			const dy = event.clientY - groupDragStart.y;

			// Only add to history when the drag ends and there was actual movement
			if (dx !== 0 || dy !== 0) {
				moveMultipleComponents(selectedComponentIds, dx, dy);
			}

			isDraggingGroup = false;
		}
	}

	// Background click to deselect
	function handleBackgroundClick() {
		console.log("Background clicked, deselecting"); // Add debug logging
		selectedComponentIds = [];
		selectedLinks = [];
		selectedLink = null;
	}

	// Add selection box for multi-select by dragging
	let selectionBox = null;
	let selectionStartPos = null;

	function handleSelectionStart(event) {
		// Only start selection box if not clicking on a component
		if (event.target === svgContainer) {
			selectionStartPos = { x: event.clientX, y: event.clientY };
			selectionBox = {
				x: event.clientX,
				y: event.clientY,
				width: 0,
				height: 0,
			};

			// Don't start component dragging
			event.stopPropagation();
		}
	}

	function handleSelectionMove(event) {
		if (selectionStartPos) {
			// Update selection box dimensions
			const currentX = event.clientX;
			const currentY = event.clientY;

			selectionBox = {
				x: Math.min(selectionStartPos.x, currentX),
				y: Math.min(selectionStartPos.y, currentY),
				width: Math.abs(currentX - selectionStartPos.x),
				height: Math.abs(currentY - selectionStartPos.y),
			};
		}
	}

	function handleSelectionEnd() {
		if (selectionBox && selectionBox.width > 5 && selectionBox.height > 5) {
			// Select all components that intersect with the selection box
			const newSelection = [];

			for (const comp of comps) {
				const el = document.getElementById(`array-comp-${comp.id}`);
				if (el) {
					const rect = el.getBoundingClientRect();

					// Check if component intersects with selection box
					if (rect.left < selectionBox.x + selectionBox.width && rect.right > selectionBox.x && rect.top < selectionBox.y + selectionBox.height && rect.bottom > selectionBox.y) {
						newSelection.push(comp.id);
					}
				}
			}

			// If shift is not pressed, replace selection, otherwise add to it
			if (!event.shiftKey) {
				selectedComponentIds = newSelection;
			} else {
				selectedComponentIds = [...new Set([...selectedComponentIds, ...newSelection])];
			}
		}

		// Reset selection box
		selectionBox = null;
		selectionStartPos = null;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	bind:this={svgContainer}
	style="position:relative; width:100vw; height:100vh; background:#f8f8f8;"
	on:click={handleBackgroundClick}
	on:mousedown={handleSelectionStart}
	on:mousemove={(e) => {
		handleSelectionMove(e);
		handleGroupDragMove(e);
	}}
	on:mouseup={(e) => {
		handleSelectionEnd(e);
		handleGroupDragEnd();
	}}
>
	<div class="menu">
		<button on:click={addArrayComponent}>Add Array</button>
		<button on:click={add2DTableComponent}>Add 2D Table</button>
		<button on:click={addPointerComponent}>Add Pointer</button>
		<div style="width: 20px;"></div>
		<!-- Spacer -->
		<button on:click={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
			<span class="material-icons">undo</span>
		</button>
		<button on:click={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
			<span class="material-icons">redo</span>
		</button>
	</div>

	{#each comps as comp (comp.id)}
		{#if comp.type === "array"}
			<!-- Wrap ArrayComponent so we can handle clicks but not interfere with component's own dragging -->
			<div on:mousedown={(e) => handleComponentClick(comp, e)}>
				<ArrayComponent
					id={comp.id}
					x={comp.x}
					y={comp.y}
					length={comp.length}
					on:nodeMouseDown={handleNodeMouseDown}
					{hoveredNode}
					on:move={handleComponentMove}
					on:redraw={() => {}}
					class_={selectedComponentIds.includes(comp.id) ? "selected-component" : ""}
				/>
			</div>
		{:else if comp.type === "2darray"}
			<div on:mousedown={(e) => handleComponentClick(comp, e)}>
				<Table2DComponent
					id={comp.id}
					x={comp.x}
					y={comp.y}
					rows={comp.rows}
					cols={comp.cols}
					on:nodeMouseDown={handleNodeMouseDown}
					{hoveredNode}
					on:move={handleComponentMove}
					on:redraw={() => {}}
					class_={selectedComponentIds.includes(comp.id) ? "selected-component" : ""}
				/>
			</div>
		{:else if comp.type === "pointer"}
			<div on:mousedown={(e) => handleComponentClick(comp, e)}>
				<PointerComponent
					id={comp.id}
					x={comp.x}
					y={comp.y}
					value={comp.value}
					on:nodeMouseDown={handleNodeMouseDown}
					{hoveredNode}
					on:move={handleComponentMove}
					on:redraw={() => {}}
					class_={selectedComponentIds.includes(comp.id) ? "selected-component" : ""}
				/>
			</div>
		{/if}
	{/each}

	<!-- Link rendering with selection highlighting -->
	<svg style="position:absolute; left:0; top:0; width:100vw; height:100vh; pointer-events:none; z-index:1;">
		{#each $linkEndpoints as { fromPos, toPos, link, path }}
			{#if fromPos && toPos}
				<!-- Thicker invisible path for easier selection -->
				<path d={path} stroke="transparent" stroke-width="16" fill="none" style="pointer-events:stroke" on:click={(e) => handleLinkClick(link, e)} />
				<path
					d={path}
					stroke={selectedLinks.includes(link) ? "#d32f2f" : link.color}
					stroke-width={selectedLinks.includes(link) ? 4 : 2}
					stroke-dasharray={selectedLinks.includes(link) ? "6,3" : "none"}
					fill="none"
					style="pointer-events:stroke"
					on:click={(e) => handleLinkClick(link, e)}
				/>
			{/if}
		{/each}
		{#if draggingLink && draggingLink.from.getNodeCenter}
			{@const fromPos = draggingLink.from.getNodeCenter()}
			{#if hoveredNode}
				{@const toPos = hoveredNode.getNodeCenter()}
				<path
					d={makeSmartOrBezierPath(
						fromPos.x - svgRect.left,
						fromPos.y - svgRect.top,
						toPos.x - svgRect.left,
						toPos.y - svgRect.top,
						draggingLink.from.side,
						hoveredNode.side,
						draggingLink.from.componentId,
						hoveredNode.componentId
					)}
					stroke="#1976d2"
					stroke-width="2"
					stroke-dasharray="4"
					fill="none"
				/>
			{:else}
				<!-- Show temp dashed line from node to mouse -->
				<line x1={fromPos.x - svgRect.left} y1={fromPos.y - svgRect.top} x2={mouse.x - svgRect.left} y2={mouse.y - svgRect.top} stroke="#1976d2" stroke-width="2" stroke-dasharray="6,6" fill="none" />
			{/if}
		{/if}
	</svg>

	<!-- Selection box overlay -->
	{#if selectionBox}
		<div class="selection-box" style="position:absolute; left:{selectionBox.x}px; top:{selectionBox.y}px; width:{selectionBox.width}px; height:{selectionBox.height}px;"></div>
	{/if}

	<!-- Add the group selection box element -->
	<div class="group-selection-box"></div>
</div>

<style>
	.menu {
		display: flex;
		flex-direction: row;
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 10;
		gap: 10px;
	}

	:global(.selected-component) {
		outline: 2px dashed #2196f3 !important;
		outline-offset: 2px;
		box-shadow: 0 0 12px rgba(33, 150, 243, 0.5) !important;
	}

	.component-wrapper {
		position: relative;
		cursor: pointer;
	}

	.selection-box {
		border: 1px dashed #2196f3;
		background: rgba(33, 150, 243, 0.1);
		pointer-events: none;
		z-index: 3;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.material-icons {
		font-family: "Material Icons";
		font-weight: normal;
		font-style: normal;
		font-size: 24px;
		line-height: 1;
		letter-spacing: normal;
		text-transform: none;
		display: inline-block;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-smoothing: antialiased;
	}
</style>
