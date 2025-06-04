<script lang="ts">
	import ArrayComponent from "../components/ArrayComponent.svelte";
	import Table2DComponent from "../components/Table2DComponent.svelte";
	import PointerComponent from "../components/PointerComponent.svelte";
	import IteratorComponent from "../components/IteratorComponent.svelte";
	import NodeComponent from "../components/NodeComponent.svelte";

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
		addIteratorComponent,
		addNodeComponent,
	} from "./Whiteboard_back";

	import { onMount, setContext } from "svelte";
	import { updateSvgRect2, svgRect } from "./ui_store";
	import { writable } from "svelte/store";

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
	$: selectedComponentIds;

	$: comps = $components;
	$: ls = $links;

	function handleCreateConnectedNode(event) {
		console.log("New Node Created");
		const { sourceId, direction } = event.detail;
		console.log(event.detail);
		const sourceComponent = $components.find((c) => c.id === sourceId);
		if (!sourceComponent) return;

		// Calculate the position for the new node
		let newX = sourceComponent.x;
		let newY = sourceComponent.y;
		const offset = 150; // Distance between nodes

		switch (direction) {
			case "top":
				newY -= offset;
				break;
			case "right":
				newX += offset;
				break;
			case "bottom":
				newY += offset;
				break;
			case "left":
				newX -= offset;
				break;
		}

		// Create the new node using the proper function
		const newNodeId = addNodeComponent(newX, newY);
		const newNode = $components.find((c) => c.id === newNodeId);
		if (!newNode) return;

		// Create a link between the nodes
		const fromSide = direction === "top" ? "top" : direction === "right" ? "right" : direction === "bottom" ? "bottom" : "left";

		const toSide = direction === "top" ? "bottom" : direction === "right" ? "left" : direction === "bottom" ? "top" : "right";

		// Use the global getNodeCenterMap for the source node if available
		const sourceGetNodeCenter =
			window.__getNodeCenterMap?.[`${sourceId}-${fromSide}`] ||
			(() => {
				// Fallback implementation if map doesn't exist
				const sourceEl = document.getElementById(`comp-${sourceId}`);
				if (!sourceEl) return { x: 0, y: 0 };
				const rect = sourceEl.getBoundingClientRect();
				return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
			});

		// For the new node, create a temporary function until it's properly mounted
		const targetGetNodeCenter = () => {
			const targetEl = document.getElementById(`comp-${newNode.id}`);
			if (!targetEl) return { x: newX + 60, y: newY + 20 }; // Default approximation

			const rect = targetEl.getBoundingClientRect();
			return {
				x: rect.left + (toSide === "right" ? rect.width : toSide === "left" ? 0 : rect.width / 2),
				y: rect.top + (toSide === "bottom" ? rect.height : toSide === "top" ? 0 : rect.height / 2),
			};
		};

		createLink(
			{
				componentId: sourceId,
				side: fromSide,
				getNodeCenter: sourceGetNodeCenter,
			},
			{
				componentId: newNode.id,
				side: toSide,
				getNodeCenter: targetGetNodeCenter,
			}
		);

		console.log("After Custom Create Call");
		console.log($links);

		// Select the new node
		selectedComponentIds = [newNode.id];
	}

	// Create a store for iterator events
	const iteratorStore = writable({
		updates: [], // Store updates from all iterators
		lastUpdate: null, // Most recent update for convenience
	});
	setContext("iteratorStore", iteratorStore);

	function handleIteratorLinkDeleted(event) {
		console.log("NOTIFY DELETED LINK: RECIEVE");

		const { iteratorId, linkedArrayId, linkDirection } = event.detail;

		iteratorStore.update((store) => {
			// Remove the specific update for this iterator-array pair
			const updates = store.updates.filter((u) => !(u.iteratorId === iteratorId && u.linkedArrayId === linkedArrayId && u.linkDirection === linkDirection));

			return {
				...store,
				updates,
			};
		});
	}

	// Handle iterator index updates
	function handleIteratorIndexUpdate(event) {
		const { iteratorId, index, linkedArrays, color, linkDirection, linkedArrayId } = event.detail;

		iteratorStore.update((store) => {
			// Add/update this iterator's entry
			// Filter based on iteratorId + linkedArrayId + linkDirection
			const updates = store.updates.filter((u) => !(u.iteratorId === iteratorId && u.linkedArrayId === linkedArrayId && u.linkDirection === linkDirection));

			updates.push({
				iteratorId,
				index,
				linkedArrays,
				color,
				linkDirection,
				linkedArrayId,
			});

			return {
				updates,
				lastUpdate: { iteratorId, index, linkedArrays, linkDirection },
			};
		});
	}

	// Helper to get a component's bounding box by id
	function getComponentBox(id) {
		const el = document.getElementById(`comp-${id}`);
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

		return bounding_rect;
	}

	// Helper: get all bounding boxes except the source and target
	function getAllComponentBoxes(excludeIds = []) {
		return comps
			.filter((c) => !excludeIds.includes(c.id))
			.map((c) => ({ id: c.id, ...getComponentBox(c.id) }))
			.filter((b) => b.left !== undefined && b.top !== undefined);
	}

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

	function handleComponentMove(event) {
		const { id, dx, dy, final } = event.detail;

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
			selectedComponentIds.forEach((val) => {
				components.update((comps) =>
					comps.map((comp) => {
						if (comp.id == val) {
							return { ...comp, x: comp.x + dx, y: comp.y + dy };
						} else {
							return comp;
						}
					})
				);
			});
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

		window.addEventListener("iterator-link-deleted", handleIteratorLinkDeleted);
		return () => {
			window.removeEventListener("resize", updateSvgRect);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("iterator-link-deleted", handleIteratorLinkDeleted);
		};
	});

	function handleComponentClick(comp, event) {
		// Check if the event target is inside a component (avoid double selection if clicking on child elements)
		const isComponent = event.target.closest(".component-placeholder");
		if (!isComponent) return;

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

	// Selection box visualizer (add it to the relative position container)
	$: {
		$components;
		console.log("Creating selection visualizer");

		const selectionOverlay = document.querySelector(".group-selection-box");

		if (selectedComponentIds.length > 0) {
			// Find bounding box of all selected components
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			selectedComponentIds.forEach((id) => {
				const box = getComponentBox(id);
				if (box) {
					minX = Math.min(minX, box.left) - 3;
					minY = Math.min(minY, box.top) - 3;
					maxX = Math.max(maxX, box.right) + 4;
					maxY = Math.max(maxY, box.bottom) + 4;
				}
			});
			if (selectionOverlay) {
				selectionOverlay.style.left = `${minX}px`;
				selectionOverlay.style.top = `${minY}px`;
				selectionOverlay.style.width = `${maxX - minX}px`;
				selectionOverlay.style.height = `${maxY - minY}px`;
				selectionOverlay.style.opacity = "100%";
			}
		} else {
			if (selectionOverlay) {
				selectionOverlay.style.opacity = "0%";
			}
		}
	}

	// Add selection box for multi-select by dragging
	let selectionBox = null;
	let selectionStartPos = null;

	function handleSelectionStart(event) {
		// Only start selection box if not clicking on a component
		if (event.target === svgContainer) {
			selectionStartPos = { x: event.clientX - svgRect.left, y: event.clientY - svgRect.top };
			selectionBox = {
				x: event.clientX - svgRect.left,
				y: event.clientY - svgRect.top,
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
			const currentX = event.clientX - svgRect.left;
			const currentY = event.clientY - svgRect.top;

			selectionBox = {
				x: Math.min(selectionStartPos.x, currentX),
				y: Math.min(selectionStartPos.y, currentY),
				width: Math.abs(currentX - selectionStartPos.x),
				height: Math.abs(currentY - selectionStartPos.y),
			};
		}
	}

	function handleSelectionEnd(event) {
		if (selectionBox && selectionBox.width > 5 && selectionBox.height > 5) {
			// Select all components that intersect with the selection box
			const newSelection = [];

			for (const comp of comps) {
				const el = document.getElementById(`comp-${comp.id}`);
				if (el) {
					const originalRect = el.getBoundingClientRect();
					// Create a new object with adjusted coordinates
					const rect = {
						left: originalRect.left - svgRect.left,
						right: originalRect.right - svgRect.left,
						top: originalRect.top - svgRect.top,
						bottom: originalRect.bottom - svgRect.top,
					};

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
			console.log(selectedComponentIds);
		} else {
			// Check if the click was on a component or element before deselecting
			const isOnComponent = event.target.closest('[id^="comp-"]') || event.target.closest("path[stroke]") || event.target.closest(".node") || event.target.closest(".group-selection-box");

			if (!isOnComponent) {
				console.log("Background clicked, deselecting");
				selectedComponentIds = [];
				selectedLinks = [];
				selectedLink = null;
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
	on:mousedown={handleSelectionStart}
	on:mousemove={(e) => {
		handleSelectionMove(e);
	}}
	on:mouseup={(e) => {
		handleSelectionEnd(e);
	}}
	role="button"
	tabindex="0"
	on:keydown={() => {}}
>
	<div class="menu">
		<button on:click={addArrayComponent}>Add Array</button>
		<button on:click={add2DTableComponent}>Add 2D Table</button>
		<button on:click={addPointerComponent}>Add Pointer</button>
		<button on:click={addIteratorComponent}>Add Iterator</button>
		<button on:click={addNodeComponent}>Add Node</button>
		<div style="width: 20px;"></div>
		<!-- Spacer -->
		<button on:click={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"> Undo </button>
		<button on:click={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"> Redo </button>
	</div>

	<div>
		{#each comps as comp (comp.id)}
			{#if comp.type === "array"}
				<!-- Wrap ArrayComponent so we can handle clicks but not interfere with component's own dragging -->
				<div class="component-placeholder" on:mousedown={(e) => handleComponentClick(comp, e)} role="button" tabindex="0" on:keydown={() => {}}>
					<ArrayComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						length={comp.length}
						on:nodeMouseDown={handleNodeMouseDown}
						on:indexUpdate={handleIteratorIndexUpdate}
						on:move={handleComponentMove}
						on:redraw={() => {}}
					/>
				</div>
			{:else if comp.type === "2darray"}
				<div class="component-placeholder" on:mousedown={(e) => handleComponentClick(comp, e)} role="button" tabindex="0" on:keydown={() => {}}>
					<Table2DComponent id={comp.id} x={comp.x} y={comp.y} rows={comp.rows} cols={comp.cols} on:nodeMouseDown={handleNodeMouseDown} on:move={handleComponentMove} on:redraw={() => {}} />
				</div>
			{:else if comp.type === "pointer"}
				<div class="component-placeholder" on:mousedown={(e) => handleComponentClick(comp, e)} role="button" tabindex="0" on:keydown={() => {}}>
					<PointerComponent id={comp.id} x={comp.x} y={comp.y} value={comp.value} on:nodeMouseDown={handleNodeMouseDown} {hoveredNode} on:move={handleComponentMove} on:redraw={() => {}} />
				</div>
			{:else if comp.type === "iterator"}
				<div class="component-placeholder" on:mousedown={(e) => handleComponentClick(comp, e)} role="button" tabindex="0" on:keydown={() => {}}>
					<IteratorComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						linkedArrays={comp.linkedArrays || []}
						on:nodeMouseDown={handleNodeMouseDown}
						on:indexUpdate={handleIteratorIndexUpdate}
						{hoveredNode}
						on:move={handleComponentMove}
						on:redraw={() => {}}
						color={comp.color}
					/>
				</div>
			{:else if comp.type === "node"}
				<div class="component-placeholder" on:mousedown={(e) => handleComponentClick(comp, e)} role="button" tabindex="0" on:keydown={() => {}}>
					<NodeComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						value={comp.label}
						selected={selectedComponentIds.includes(comp.id)}
						on:nodeMouseDown={handleNodeMouseDown}
						on:createConnectedNode={handleCreateConnectedNode}
						on:move={handleComponentMove}
					></NodeComponent>
				</div>
			{/if}
		{/each}
		<div class="group-selection-box"></div>
	</div>

	<!-- Link rendering with selection highlighting -->
	<svg style="position:absolute; left:0; top:0; width:100vw; height:100vh; pointer-events:none; z-index:1;">
		{#each $linkEndpoints as { fromPos, toPos, link, path }}
			{#if fromPos && toPos}
				<!-- Thicker invisible path for easier selection -->
				<path d={path} stroke="transparent" stroke-width="16" fill="none" style="pointer-events:stroke" on:click={(e) => handleLinkClick(link, e)} role="button" tabindex="0" on:keydown={() => {}} />
				<path
					d={path}
					stroke={selectedLinks.includes(link) ? "#d32f2f" : link.color}
					stroke-width={selectedLinks.includes(link) ? 4 : 2}
					stroke-dasharray={selectedLinks.includes(link) ? "6,3" : "none"}
					fill="none"
					style="pointer-events:stroke"
					on:click={(e) => handleLinkClick(link, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
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

	.group-selection-box {
		outline: 2px dashed #2196f3 !important;
		outline-offset: 2px;
		box-shadow: 0 0 12px rgba(33, 150, 243, 0.5) !important;
		position: absolute;
		z-index: 0;
		pointer-events: none; /* This makes mouse events pass through */
		opacity: 0%;
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

	/* Add this to your <style> section */
	:global(path:focus) {
		outline: none !important; /* Remove default outline */
	}
</style>
