<script lang="ts">
	import ArrayComponent from "../components/ArrayComponent.svelte";
	import Table2DComponent from "../components/Table2DComponent.svelte";
	import PointerComponent from "../components/PointerComponent.svelte";
	import IteratorComponent from "../components/IteratorComponent.svelte";
	import NodeComponent from "../components/NodeComponent.svelte";
	import BinaryNodeComponent from "../components/BinaryNodeComponent.svelte";
	import NaryNodeComponent from "../components/NaryNodeComponent.svelte";

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
		addBinaryNodeComponent,
		addNaryNodeComponent,
		addNodeByType,
		optimizeLinkPath,
		optimizeAllLinks,
	} from "./Whiteboard_back";

	import { onMount, setContext, tick } from "svelte";
	import { updateSvgRect2, svgRect } from "./ui_store";
	import { writable } from "svelte/store";
	import FileBrowser from "../components/FileBrowser.svelte";
	import { user, authLoading, signInWithGoogle, signOutUser } from "./firebase";
	import {
		currentFilename,
		isSaved,
		showFileBrowser,
		saveCurrentFile,
		createNewFile,
		exportAsImage,
		refreshFileList,
	} from "./fileManager";

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

	// Dropdown menu states
	let openDropdown = null;

	// Infinite canvas pan and zoom
	let panX = 0;
	let panY = 0;
	let zoom = 1;
	let isPanning = false;
	let panStartX = 0;
	let panStartY = 0;
	let panStartMouseX = 0;
	let panStartMouseY = 0;

	$: comps = $components;
	$: ls = $links;

	function handlePropertyChange(event) {
		console.log("Property Change:", event);
		const { id, property, value } = event;
		components.update((comps) =>
			comps.map((c) => (c.id === id ? { ...c, [property]: value } : c))
		);
	}

	function handleCreateConnectedNode(event) {
		console.log("New Node Created");
		const { sourceId, direction } = event.detail;
		console.log(event.detail);
		const sourceComponent = $components.find((c) => c.id === sourceId);
		if (!sourceComponent) return;

		// Calculate the position for the new node
		let newX = sourceComponent.x;
		let newY = sourceComponent.y;
		const offset_rl = 180; // Distance between nodes (horizontal)
		const offset_tb = 100; // Distance between nodes (vertical)
		const offset_diag = 150; // Distance for diagonal nodes

		switch (direction) {
			case "top":
				newY -= offset_tb;
				break;
			case "top-right":
				newX += offset_diag;
				newY -= offset_diag * 0.7;
				break;
			case "right":
				newX += offset_rl;
				break;
			case "bottom-right":
				newX += offset_diag;
				newY += offset_diag * 0.7;
				break;
			case "bottom":
				newY += offset_tb;
				break;
			case "bottom-left":
				newX -= offset_diag;
				newY += offset_diag * 0.7;
				break;
			case "left":
				newX -= offset_rl;
				break;
			case "top-left":
				newX -= offset_diag;
				newY -= offset_diag * 0.7;
				break;
		}

		// Create the new node using the same type as the source node
		const newNodeId = addNodeByType(sourceComponent.type, "", newX, newY);
		const newNode = $components.find((c) => c.id === newNodeId);
		if (!newNode) return;

		// Create a link between the nodes
		// Map primary and secondary directions based on component types
		let fromSide, toSide;

		// Determine appropriate sides based on component type
		const isBinaryNode = sourceComponent.type === "binary-node";
		const isNaryNode = sourceComponent.type === "nary-node";

		switch (direction) {
			case "top":
				fromSide = "top";
				// For binary nodes, always connect to top of child, never bottom
				toSide = "bottom";
				break;
			case "top-right":
				fromSide = isBinaryNode ? "top" : "top";
				toSide = isBinaryNode ? "bottom" : "bottom";
				break;
			case "right":
				fromSide = isBinaryNode ? "bottom-right" : "right";
				toSide = "left";
				break;
			case "bottom-right":
				fromSide = isBinaryNode ? "bottom-right" : "bottom";
				toSide = "top";
				break;
			case "bottom":
				fromSide = isBinaryNode
					? "bottom-right"
					: isNaryNode
						? "bottom"
						: "bottom";
				toSide = "top";
				break;
			case "bottom-left":
				fromSide = isBinaryNode ? "bottom-left" : "bottom";
				toSide = "top";
				break;
			case "left":
				fromSide = isBinaryNode ? "bottom-left" : "left";
				toSide = "right";
				break;
			case "top-left":
				fromSide = isBinaryNode ? "top" : "top";
				toSide = isBinaryNode ? "bottom" : "bottom";
				break;
			default:
				fromSide = "right";
				toSide = "left";
		}

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
			if (!targetEl) return { x: newX, y: newY }; // Default approximation

			const rect = targetEl.getBoundingClientRect();
			const width = rect ? rect.width : 120;
			const height = rect ? rect.height : 60;

			// Use the component's absolute position (newX, newY) instead of viewport coordinates
			// This matches the behavior in ComponentBox.svelte
			let _x = newX;
			let _y = newY;

			switch (toSide) {
				case "top":
					return { x: _x + width / 2, y: _y - 6 };
				case "bottom":
					return { x: _x + width / 2, y: _y + height + 6 };
				case "left":
					return { x: _x - 6, y: _y + height / 2 };
				case "right":
					return { x: _x + width + 6, y: _y + height / 2 };
			}
		};

		// Validate connection before creating link (prevent bottom-to-bottom for binary nodes)
		const isBinaryConnection =
			sourceComponent.type === "binary-node" || newNode.type === "binary-node";
		const bottomSides = ["bottom", "bottom-left", "bottom-right"];
		const isBottomToBottom =
			bottomSides.includes(fromSide) && bottomSides.includes(toSide);

		if (isBinaryConnection && isBottomToBottom) {
			console.warn(
				`Blocked invalid bottom-to-bottom connection for binary node: ${fromSide} -> ${toSide}`
			);
			// Don't create the link - just position the node
			return;
		}

		tick().then(() => {
			// Wait a bit more for the component to fully mount and register its getNodeCenter
			setTimeout(() => {
				// Try to get the registered getNodeCenter from the global map
				const registeredTargetGetNodeCenter =
					window.__getNodeCenterMap?.[`${newNode.id}-${toSide}`];

				createLink(
					{
						componentId: sourceId,
						side: fromSide,
						getNodeCenter: sourceGetNodeCenter,
					},
					{
						componentId: newNode.id,
						side: toSide,
						// Use the registered function if available, otherwise fallback to temporary
						getNodeCenter: registeredTargetGetNodeCenter || targetGetNodeCenter,
					}
				);
			}, 10);
		});

		console.log("After Custom Create Call");
		console.log($links);

		// Select the new node
		selectedComponentIds = [newNode.id];

		// Auto-layout the tree after a brief delay to ensure link is created
		// Only apply to binary and n-ary nodes
		if (
			sourceComponent.type === "binary-node" ||
			sourceComponent.type === "nary-node"
		) {
			setTimeout(async () => {
				// Find the root of the tree that contains this node
				const rootId = findTreeRoot(sourceComponent.id);
				if (rootId !== null && rootId !== undefined) {
					console.log("Auto-layouting tree from root:", rootId);
					await autoLayoutTree(rootId);
				} else {
					console.log("Could not find tree root for node:", sourceComponent.id);
				}
			}, 150); // Increased delay to ensure everything is ready
		}
	}

	// Handle component deletion from × button
	function handleComponentDelete(id) {
		deleteComponent(id);
		// Remove from selection if it was selected
		selectedComponentIds = selectedComponentIds.filter((cid) => cid !== id);
	}

	// Handle component name change
	function handleComponentNameChange(event) {
		const { id, name } = event.detail;
		components.update((comps) => {
			return comps.map((comp) => {
				if (comp.id === id) {
					return { ...comp, name };
				}
				return comp;
			});
		});
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
			const updates = store.updates.filter(
				(u) =>
					!(
						u.iteratorId === iteratorId &&
						u.linkedArrayId === linkedArrayId &&
						u.linkDirection === linkDirection
					)
			);

			return {
				...store,
				updates,
			};
		});
	}

	// Handle iterator index updates
	function handleIteratorIndexUpdate(event) {
		const {
			iteratorId,
			index,
			linkedArrays,
			color,
			linkDirection,
			linkedArrayId,
		} = event.detail;

		iteratorStore.update((store) => {
			// Add/update this iterator's entry
			// Filter based on iteratorId + linkedArrayId + linkDirection
			const updates = store.updates.filter(
				(u) =>
					!(
						u.iteratorId === iteratorId &&
						u.linkedArrayId === linkedArrayId &&
						u.linkDirection === linkDirection
					)
			);

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
			left: rect.left - $svgRect.left,
			right: rect.right - $svgRect.left,
			top: rect.top - $svgRect.top,
			bottom: rect.bottom - $svgRect.top,
			width: rect.width,
			height: rect.height,
			centerX: (rect.left + rect.right) / 2 - $svgRect.left,
			centerY: (rect.top + rect.bottom) / 2 - $svgRect.top,
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
			if (
				compId !== draggingLink.from.componentId &&
				window.__getNodeCenterMap &&
				window.__getNodeCenterMap[`${compId}-${side}`]
			) {
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
				(l.from.componentId === a.componentId &&
					l.from.side === a.side &&
					l.to.componentId === b.componentId &&
					l.to.side === b.side) ||
				(l.from.componentId === b.componentId &&
					l.from.side === b.side &&
					l.to.componentId === a.componentId &&
					l.to.side === a.side)
		);
	}

	function handleMouseUp(e) {
		window.removeEventListener("mousemove", handleMouseMove);
		window.removeEventListener("mouseup", handleMouseUp);

		if (
			hoveredNode &&
			draggingLink &&
			!linkExists(draggingLink.from, hoveredNode)
		) {
			// Validate connection for binary nodes - prevent bottom-to-bottom connections
			const fromComp = $components.find(
				(c) => c.id === draggingLink.from.componentId
			);
			const toComp = $components.find((c) => c.id === hoveredNode.componentId);

			const isBinaryConnection =
				(fromComp && fromComp.type === "binary-node") ||
				(toComp && toComp.type === "binary-node");

			const isBottomToBottom =
				(draggingLink.from.side === "bottom" ||
					draggingLink.from.side === "bottom-left" ||
					draggingLink.from.side === "bottom-right") &&
				(hoveredNode.side === "bottom" ||
					hoveredNode.side === "bottom-left" ||
					hoveredNode.side === "bottom-right");

			// Only create link if it's not a binary node with bottom-to-bottom connection
			if (!isBinaryConnection || !isBottomToBottom) {
				// Create the link using the command system
				createLink(draggingLink.from, hoveredNode);
			}
		}
		draggingLink = null;
		hoveredNode = null;
	}

	function handleComponentMove(event) {
		const { id, dx, dy, final } = event.detail;

		if (final) {
			// Only record history on final move (mouse up)
			if (
				selectedComponentIds.length > 1 &&
				selectedComponentIds.includes(id)
			) {
				// For multi-selection, use the totalDx/totalDy for history
				moveMultipleComponents(
					selectedComponentIds,
					event.detail.totalDx,
					event.detail.totalDy
				);
			} else {
				// For single component, use the totalDx/totalDy for history
				moveComponent(id, event.detail.totalDx, event.detail.totalDy);
			}

			// Optimize links connected to moved components after movement is complete
			const movedIds = selectedComponentIds.includes(id)
				? selectedComponentIds
				: [id];
			const affectedLinks = $links.filter(
				(link) =>
					movedIds.includes(link.from.componentId) ||
					movedIds.includes(link.to.componentId)
			);

			// Optimize each affected link to find shortest path
			affectedLinks.forEach((link) => optimizeLinkPath(link));
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

		// Auto-layout tree after movement
		if (final) {
			const movedIds = selectedComponentIds.includes(id)
				? selectedComponentIds
				: [id];

			// Check if any moved component is a tree node
			movedIds.forEach((nodeId) => {
				const node = $components.find((c) => c.id === nodeId);
				if (
					node &&
					(node.type === "binary-node" || node.type === "nary-node")
				) {
					autoLayoutTree(nodeId);
				}
			});
		}
	}

	// Get all children of a node with their connection info
	function getNodeChildren(nodeId) {
		return $links
			.filter((link) => link.from.componentId === nodeId)
			.map((link) => ({
				id: link.to.componentId,
				side: link.from.side,
			}));
	}

	// Get parent of a node
	function getNodeParent(nodeId) {
		const parentLink = $links.find((link) => link.to.componentId === nodeId);
		return parentLink ? parentLink.from.componentId : null;
	}

	// Calculate bounding box of a subtree (including all descendants)
	function calculateSubtreeBounds(nodeId, visited = new Set()) {
		if (visited.has(nodeId)) {
			return { width: 0, height: 0, depth: 0 };
		}
		visited.add(nodeId);

		const node = $components.find((c) => c.id === nodeId);
		if (!node) return { width: 0, height: 0, depth: 0 };

		const children = getNodeChildren(nodeId);

		// Base case: leaf node
		if (children.length === 0) {
			return { width: 80, height: 60, depth: 1 }; // Approximate node size
		}

		// Calculate bounds for all children
		const childBounds = children.map((child) =>
			calculateSubtreeBounds(child.id, visited)
		);

		// Total width is sum of all children widths plus spacing
		const spacing = 40;
		const totalWidth =
			childBounds.reduce((sum, bounds) => sum + bounds.width, 0) +
			(children.length - 1) * spacing;

		// Height includes vertical spacing between levels
		const maxChildHeight = Math.max(...childBounds.map((b) => b.height), 0);
		const totalHeight = 100 + maxChildHeight; // 100px vertical spacing between levels

		// Depth is max child depth + 1
		const maxDepth = Math.max(...childBounds.map((b) => b.depth), 0);

		return {
			width: Math.max(totalWidth, 80), // At least as wide as the node itself
			height: totalHeight,
			depth: maxDepth + 1,
			childBounds,
		};
	}

	// Layout subtree starting from a node, positioning children relative to parent
	function layoutSubtree(nodeId, parentX, parentY, visited = new Set()) {
		if (visited.has(nodeId)) return [];
		visited.add(nodeId);

		const node = $components.find((c) => c.id === nodeId);
		if (!node) return [];

		const positions = [];
		const children = getNodeChildren(nodeId);

		if (children.length === 0) {
			// Leaf node - just record its position
			return [{ id: nodeId, x: parentX, y: parentY }];
		}

		// Calculate bounds for each child subtree
		const childBounds = children.map((child) =>
			calculateSubtreeBounds(child.id, new Set([nodeId]))
		);

		// Calculate total width needed
		const spacing = 40;
		const totalWidth =
			childBounds.reduce((sum, bounds) => sum + bounds.width, 0) +
			(children.length - 1) * spacing;

		// Start position (leftmost child)
		let currentX = parentX - totalWidth / 2;

		// Position each child
		children.forEach((child, index) => {
			const childWidth = childBounds[index].width;
			const childCenterX = currentX + childWidth / 2;
			const childY = parentY + 100; // Fixed vertical spacing

			// Recursively layout this child's subtree
			const childPositions = layoutSubtree(
				child.id,
				childCenterX,
				childY,
				visited
			);
			positions.push(...childPositions);

			// Move to next child position
			currentX += childWidth + spacing;
		});

		// Add current node position
		positions.push({ id: nodeId, x: parentX, y: parentY });

		return positions;
	}

	// Find the root of the tree containing a node
	function findTreeRoot(nodeId) {
		let currentId = nodeId;
		let parent = getNodeParent(currentId);

		// Keep going up until we find no parent
		while (parent !== null) {
			currentId = parent;
			parent = getNodeParent(currentId);
		}

		return currentId;
	}

	// Auto-layout entire tree
	async function autoLayoutTree(nodeId) {
		const rootId = findTreeRoot(nodeId);
		const rootNode = $components.find((c) => c.id === rootId);
		if (!rootNode) return;

		// Calculate layout positions starting from root
		const positions = layoutSubtree(rootId, rootNode.x, rootNode.y, new Set());

		// Collect all node IDs that will be repositioned
		const repositionedIds = positions.map((p) => p.id);

		// Apply positions
		components.update((comps) => {
			return comps.map((comp) => {
				const newPos = positions.find((p) => p.id === comp.id);
				if (newPos) {
					return { ...comp, x: newPos.x, y: newPos.y };
				}
				return comp;
			});
		});

		// Wait for Svelte to update the DOM with new positions
		await tick();

		// Update links after repositioning
		updateLinks();

		// Wait again for link positions to update
		await tick();

		// Optimize all links connected to repositioned nodes
		const affectedLinks = $links.filter(
			(link) =>
				repositionedIds.includes(link.from.componentId) ||
				repositionedIds.includes(link.to.componentId)
		);
		affectedLinks.forEach((link) => optimizeLinkPath(link));

		// Update selection box after layout
		await tick();
		updateSelectionBox();
	}

	// Function to update the selection box
	// function updateSelectionBox() {
	// 	const selectionOverlay = document.querySelector(".group-selection-box");

	// 	if (selectedComponentIds.length > 0 && selectionOverlay) {
	// 		// Find bounding box of all selected components
	// 		let minX = Infinity;
	// 		let minY = Infinity;
	// 		let maxX = -Infinity;
	// 		let maxY = -Infinity;

	// 		selectedComponentIds.forEach((id) => {
	// 			const box = getComponentBox(id);
	// 			if (box) {
	// 				minX = Math.min(minX, box.left) - 3;
	// 				minY = Math.min(minY, box.top) - 3;
	// 				maxX = Math.max(maxX, box.right) + 4;
	// 				maxY = Math.max(maxY, box.bottom) + 4;
	// 			}
	// 		});

	// 		selectionOverlay.style.left = `${minX}px`;
	// 		selectionOverlay.style.top = `${minY}px`;
	// 		selectionOverlay.style.width = `${maxX - minX}px`;
	// 		selectionOverlay.style.height = `${maxY - minY}px`;
	// 		selectionOverlay.style.opacity = "100%";
	// 	}
	// }

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
		// Check if user is typing in an input or textarea
		const activeElement = document.activeElement;
		const isTyping =
			activeElement &&
			(activeElement.tagName === "INPUT" ||
				activeElement.tagName === "TEXTAREA" ||
				(activeElement as HTMLElement).contentEditable === "true");

		// File operations
		// New file with Ctrl+N
		if (event.ctrlKey && event.key === "n") {
			if (isTyping) return;
			event.preventDefault();
			createNewFile();
		}

		// Save with Ctrl+S
		if (event.ctrlKey && event.key === "s") {
			if (isTyping) return;
			event.preventDefault();

			if (!$user) {
				alert("Please sign in to save files");
				return;
			}

			const filename = prompt("Enter filename:", $currentFilename);
			if (filename) {
				saveCurrentFile($user.uid, filename)
					.then(() => alert("File saved successfully!"))
					.catch((err) => alert("Error saving file: " + err.message));
			}
		}

		// Export with Ctrl+E
		if (event.ctrlKey && event.key === "e") {
			if (isTyping) return;
			event.preventDefault();

			exportAsImage(svgContainer, $currentFilename).catch((err) =>
				alert("Error exporting image: " + err.message)
			);
		}

		// Reset view with Ctrl+0
		if (event.ctrlKey && event.key === "0") {
			event.preventDefault();
			panX = 0;
			panY = 0;
			zoom = 1;
		}

		// Delete component/link
		if (event.key === "Delete" || event.key === "Backspace") {
			// Don't delete components if user is typing
			if (isTyping) return;

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
			// Don't duplicate if user is typing
			if (isTyping) return;

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
			// Allow native Ctrl+A behavior when typing in input/textarea
			if (isTyping) return;

			event.preventDefault();
			selectedComponentIds = comps.map((comp) => comp.id);
		}

		// Undo with Ctrl+Z
		if (event.ctrlKey && event.key === "z") {
			// Allow native undo in input fields
			if (isTyping) return;

			event.preventDefault();
			undo();
		}

		// Redo with Ctrl+Y or Ctrl+Shift+Z
		if (
			(event.ctrlKey && event.key === "y") ||
			(event.ctrlKey && event.shiftKey && event.key === "z")
		) {
			// Allow native redo in input fields
			if (isTyping) return;

			event.preventDefault();
			redo();
		}

		// Optimize selected links with Ctrl+O
		if (event.ctrlKey && event.key === "o") {
			// Don't optimize if user is typing
			if (isTyping) return;

			event.preventDefault();

			if (selectedLinks.length > 0) {
				// Optimize only selected links
				selectedLinks.forEach((link) => optimizeLinkPath(link));
			} else {
				// Optimize all links if none are selected
				optimizeAllLinks();
			}
		}
	}

	// Subscribe to command history changes to enable/disable undo/redo buttons
	let canUndo = false;
	let canRedo = false;

	commandHistory.subscribe((h) => {
		canUndo = h.undoStack.length > 0;
		canRedo = h.redoStack.length > 0;
	});

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (openDropdown && !event.target.closest(".menu-item")) {
			openDropdown = null;
		}
	}

	onMount(() => {
		updateSvgRect();
		window.addEventListener("resize", updateSvgRect);
		window.addEventListener("scroll", updateSvgRect);
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("click", handleClickOutside);

		window.addEventListener("iterator-link-deleted", handleIteratorLinkDeleted);
		return () => {
			window.removeEventListener("resize", updateSvgRect);
			window.removeEventListener("scroll", updateSvgRect);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("click", handleClickOutside);
			window.removeEventListener(
				"iterator-link-deleted",
				handleIteratorLinkDeleted
			);
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
				selectedComponentIds = selectedComponentIds.filter(
					(id) => id !== comp.id
				);
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
		selectedComponentIds;
		updateSelectionBox();
	}

	function updateSelectionBox() {
		console.log("Creating selection visualizer");

		const selectionOverlay = document.querySelector(".group-selection-box");

		if (selectedComponentIds.length > 0) {
			// Find bounding box of all selected components in canvas space
			let minX = Infinity;
			let minY = Infinity;
			let maxX = -Infinity;
			let maxY = -Infinity;

			selectedComponentIds.forEach((id) => {
				const comp = $components.find((c) => c.id === id);
				if (comp) {
					const el = document.getElementById(`comp-${id}`);
					const width = el ? el.offsetWidth : 100;
					const height = el ? el.offsetHeight : 60;

					minX = Math.min(minX, comp.x) - 3;
					minY = Math.min(minY, comp.y) - 3;
					maxX = Math.max(maxX, comp.x + width) + 4;
					maxY = Math.max(maxY, comp.y + height) + 4;
				}
			});

			if (selectionOverlay) {
				// Since selection overlay is inside the transformed div,
				// use canvas coordinates directly (component x, y positions)
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
		// Only start selection box if not clicking on a component and not panning
		// Check if clicking on background (not on a component)
		const isBackground =
			!event.target.closest('[id^="comp-"]') &&
			!event.target.closest(".component-placeholder") &&
			event.button === 0 &&
			!isPanning;

		if (isBackground) {
			// Get container rect for accurate positioning
			const containerRect = svgContainer.getBoundingClientRect();

			// Convert screen coordinates to canvas coordinates
			// Transform: translate(panX, panY) scale(zoom)
			// So: screen = canvas * zoom + pan
			// Therefore: canvas = (screen - pan) / zoom
			const screenX = event.clientX - containerRect.left;
			const screenY = event.clientY - containerRect.top;
			const canvasX = (screenX - panX) / zoom;
			const canvasY = (screenY - panY) / zoom;

			console.log("=== SELECTION START ===");
			console.log(`Screen: (${screenX.toFixed(1)}, ${screenY.toFixed(1)})`);
			console.log(
				`Pan: (${panX.toFixed(1)}, ${panY.toFixed(1)}), Zoom: ${zoom.toFixed(2)}`
			);
			console.log(`Canvas: (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)})`);

			selectionStartPos = {
				x: canvasX,
				y: canvasY,
			};
			selectionBox = {
				x: canvasX,
				y: canvasY,
				width: 0,
				height: 0,
			};

			// Don't start component dragging
			event.stopPropagation();
		}
	}

	function handleSelectionMove(event) {
		if (selectionStartPos) {
			// Get container rect for accurate positioning
			const containerRect = svgContainer.getBoundingClientRect();

			// Update selection box dimensions
			const screenX = event.clientX - containerRect.left;
			const screenY = event.clientY - containerRect.top;
			const canvasX = (screenX - panX) / zoom;
			const canvasY = (screenY - panY) / zoom;

			selectionBox = {
				x: Math.min(selectionStartPos.x, canvasX),
				y: Math.min(selectionStartPos.y, canvasY),
				width: Math.abs(canvasX - selectionStartPos.x),
				height: Math.abs(canvasY - selectionStartPos.y),
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
					// Component positions are in canvas space already
					const compRect = {
						left: comp.x,
						right: comp.x + (el.offsetWidth || 100),
						top: comp.y,
						bottom: comp.y + (el.offsetHeight || 60),
					};

					// Check if component intersects with selection box (both in canvas space)
					if (
						compRect.left < selectionBox.x + selectionBox.width &&
						compRect.right > selectionBox.x &&
						compRect.top < selectionBox.y + selectionBox.height &&
						compRect.bottom > selectionBox.y
					) {
						newSelection.push(comp.id);
					}
				}
			}

			// If shift is not pressed, replace selection, otherwise add to it
			if (!event.shiftKey) {
				selectedComponentIds = newSelection;
			} else {
				selectedComponentIds = [
					...new Set([...selectedComponentIds, ...newSelection]),
				];
			}
			console.log(selectedComponentIds);
		} else {
			// Check if the click was on a component or element before deselecting
			const isOnComponent =
				event.target.closest('[id^="comp-"]') ||
				event.target.closest("path[stroke]") ||
				event.target.closest(".node") ||
				event.target.closest(".group-selection-box");

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

	// Pan and zoom handlers
	function handleWheel(event) {
		event.preventDefault();

		if (event.ctrlKey) {
			// Zoom with Ctrl+Wheel
			const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
			const newZoom = Math.max(0.1, Math.min(3, zoom * zoomFactor));

			// Zoom towards mouse position
			const mouseX = event.clientX;
			const mouseY = event.clientY - 40; // Account for menubar

			// Adjust pan to zoom towards mouse
			const dx = mouseX - panX;
			const dy = mouseY - panY;

			panX = mouseX - dx * (newZoom / zoom);
			panY = mouseY - dy * (newZoom / zoom);

			zoom = newZoom;
		} else {
			// Pan with wheel
			panX -= event.deltaX;
			panY -= event.deltaY;
		}
	}

	function handlePanStart(event) {
		// Middle mouse button for panning
		if (event.button === 1) {
			event.preventDefault();
			isPanning = true;
			panStartX = panX;
			panStartY = panY;
			panStartMouseX = event.clientX;
			panStartMouseY = event.clientY;
		}
	}

	function handlePanMove(event) {
		if (isPanning) {
			const dx = event.clientX - panStartMouseX;
			const dy = event.clientY - panStartMouseY;
			panX = panStartX + dx;
			panY = panStartY + dy;
		}
	}

	function handlePanEnd() {
		isPanning = false;
	}
</script>

<!-- Menu Bar -->
<div class="menubar">
	<!-- File Menu -->
	<div class="menu-item">
		<button
			class="menu-button"
			on:click={() => (openDropdown = openDropdown === "file" ? null : "file")}
		>
			File ▾
		</button>
		{#if openDropdown === "file"}
			<div class="dropdown">
				<button
					class="dropdown-item"
					on:click={() => {
						if (!$isSaved) {
							const confirmNew = confirm(
								"You have unsaved changes. Are you sure you want to create a new file and lose these changes?"
							);
							if (!confirmNew) {
								openDropdown = null;
								return;
							}
						}
						createNewFile();
						openDropdown = null;
					}}
				>
					<span class="shortcut">Ctrl+N</span> New
				</button>
				<button
					class="dropdown-item"
					on:click={async () => {
						if (!$user) {
							alert("Please sign in to open files");
							return;
						}
						await refreshFileList($user.uid);
						showFileBrowser.set(true);
						openDropdown = null;
					}}
					disabled={!$user}
				>
					<span class="shortcut">Ctrl+O</span> Open...
				</button>
				<button
					class="dropdown-item"
					on:click={async () => {
						if (!$user) {
							alert("Please sign in to save files");
							return;
						}
						const filename = prompt("Enter filename:", $currentFilename);
						if (filename) {
							try {
								await saveCurrentFile($user.uid, filename);
								alert("File saved successfully!");
							} catch (err) {
								alert("Error saving file: " + err.message);
							}
						}
						openDropdown = null;
					}}
					disabled={!$user}
				>
					<span class="shortcut">Ctrl+S</span> Save As...
				</button>
				<div class="dropdown-divider"></div>
				<button
					class="dropdown-item"
					on:click={async () => {
						try {
							await exportAsImage(svgContainer, $currentFilename);
						} catch (err) {
							alert("Error exporting image: " + err.message);
						}
						openDropdown = null;
					}}
				>
					<span class="shortcut">Ctrl+E</span> Export as Image
				</button>
			</div>
		{/if}
	</div>

	{#if $currentFilename}
		<!-- Components Menu -->
		<div class="menu-item">
			<button
				class="menu-button"
				on:click={() =>
					(openDropdown = openDropdown === "components" ? null : "components")}
			>
				Components ▾
			</button>
			{#if openDropdown === "components"}
				<div class="dropdown">
					<div class="dropdown-section">
						<div class="dropdown-label">Basic Components</div>
						<button
							class="dropdown-item"
							on:click={() => {
								addArrayComponent();
								openDropdown = null;
							}}
						>
							Array
						</button>
						<button
							class="dropdown-item"
							on:click={() => {
								add2DTableComponent();
								openDropdown = null;
							}}
						>
							2D Table
						</button>
						<button
							class="dropdown-item"
							on:click={() => {
								addPointerComponent();
								openDropdown = null;
							}}
						>
							Pointer
						</button>
						<button
							class="dropdown-item"
							on:click={() => {
								addIteratorComponent();
								openDropdown = null;
							}}
						>
							Iterator
						</button>
					</div>
					<div class="dropdown-divider"></div>
					<div class="dropdown-section">
						<div class="dropdown-label">Tree Nodes</div>
						<button
							class="dropdown-item"
							on:click={() => {
								addNodeComponent();
								openDropdown = null;
							}}
						>
							Simple Node
						</button>
						<button
							class="dropdown-item"
							on:click={() => {
								addBinaryNodeComponent();
								openDropdown = null;
							}}
						>
							Binary Node
						</button>
						<button
							class="dropdown-item"
							on:click={() => {
								addNaryNodeComponent();
								openDropdown = null;
							}}
						>
							N-ary Node
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Edit Menu -->
		<div class="menu-item">
			<button
				class="menu-button"
				disabled={!$currentFilename}
				title={!$currentFilename
					? "Open a file to enable edit actions"
					: "Edit menu"}
				on:click={() => {
					if (!$currentFilename) return;
					openDropdown = openDropdown === "edit" ? null : "edit";
				}}
			>
				Edit ▾
			</button>
			{#if openDropdown === "edit"}
				<div class="dropdown">
					<button
						class="dropdown-item"
						on:click={() => {
							undo();
							openDropdown = null;
						}}
						disabled={!$currentFilename || !canUndo}
					>
						<span class="shortcut">Ctrl+Z</span> Undo
					</button>
					<button
						class="dropdown-item"
						on:click={() => {
							redo();
							openDropdown = null;
						}}
						disabled={!$currentFilename || !canRedo}
					>
						<span class="shortcut">Ctrl+Y</span> Redo
					</button>
					<div class="dropdown-divider"></div>
					<button
						class="dropdown-item"
						on:click={() => {
							deleteSelectedLinks();
							openDropdown = null;
						}}
						disabled={!$currentFilename ||
							(selectedLinks.length === 0 && selectedComponentIds.length === 0)}
					>
						<span class="shortcut">Del</span> Delete Selected
					</button>
				</div>
			{/if}
		</div>

		<!-- Tools Menu -->
		<div class="menu-item">
			<button
				class="menu-button"
				on:click={() =>
					(openDropdown = openDropdown === "tools" ? null : "tools")}
			>
				Tools ▾
			</button>
			{#if openDropdown === "tools"}
				<div class="dropdown">
					<button
						class="dropdown-item"
						on:click={() => {
							if (selectedLinks.length > 0) {
								selectedLinks.forEach((link) => optimizeLinkPath(link));
							} else {
								optimizeAllLinks();
							}
							openDropdown = null;
						}}
					>
						<span class="shortcut">Ctrl+O</span>
						{selectedLinks.length > 0
							? "Optimize Selected Links"
							: "Optimize All Links"}
					</button>
					<button
						class="dropdown-item"
						on:click={() => {
							if (selectedComponentIds.length > 0) {
								selectedComponentIds.forEach((nodeId) => {
									const node = $components.find((c) => c.id === nodeId);
									if (
										node &&
										(node.type === "binary-node" || node.type === "nary-node")
									) {
										autoLayoutTree(nodeId);
									}
								});
							}
							openDropdown = null;
						}}
						disabled={selectedComponentIds.length === 0}
					>
						<span class="shortcut">Ctrl+L</span> Auto-Layout Tree
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Right side: Filename and Auth -->
	<div class="menubar-right">
		<div class="filename-display">
			{$currentFilename}{#if !$isSaved}*{/if}
		</div>

		{#if $authLoading}
			<div class="auth-loading">...</div>
		{:else if $user}
			<div class="user-info">
				<img src={$user.photoURL} alt="User" class="user-avatar" />
				<span class="user-name">{$user.displayName}</span>
				<button class="btn-signout" on:click={signOutUser}>Sign Out</button>
			</div>
		{:else}
			<button class="btn-signin" on:click={signInWithGoogle}>
				Sign In with Google
			</button>
		{/if}
	</div>
</div>

<FileBrowser />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	bind:this={svgContainer}
	style="position:relative; width:100vw; height:calc(100vh - 40px); margin-top:40px; background:#f8f8f8; overflow:hidden;"
	on:mousedown={(e) => {
		handlePanStart(e);
		if (e.button === 1) return; // if event is middle mouse button, don't start selection
		handleSelectionStart(e);
	}}
	on:mousemove={(e) => {
		handlePanMove(e);
		handleSelectionMove(e);
	}}
	on:mouseup={(e) => {
		handlePanEnd();
		if (e.button === 1) return; // if event is middle mouse button, don't end selection
		handleSelectionEnd(e);
	}}
	on:wheel={handleWheel}
	role="button"
	tabindex="0"
	on:keydown={() => {}}
>
	<!-- Grid background pattern -->
	<svg
		style="position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none;"
	>
		<defs>
			<pattern
				id="grid"
				width={20 * zoom}
				height={20 * zoom}
				patternUnits="userSpaceOnUse"
			>
				<rect width={20 * zoom} height={20 * zoom} fill="none" />
				<path
					d="M {20 * zoom} 0 L 0 0 0 {20 * zoom}"
					fill="none"
					stroke="#e0e0e0"
					stroke-width="0.5"
				/>
			</pattern>
		</defs>
		<rect width="100%" height="100%" fill="url(#grid)" />
	</svg>

	<!-- Canvas content with pan and zoom transform -->
	<div
		style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0; width: 5000px; height: 5000px; position:relative;"
	>
		{#each comps as comp (comp.id)}
			{#if comp.type === "array"}
				<!-- Wrap ArrayComponent so we can handle clicks but not interfere with component's own dragging -->
				<div
					class="component-placeholder"
					on:mousedown={(e) => handleComponentClick(comp, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
				>
					<ArrayComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						length={comp.length}
						on:nodeMouseDown={handleNodeMouseDown}
						on:propertyChange={(e) => handlePropertyChange(e.detail)}
						on:indexUpdate={handleIteratorIndexUpdate}
						on:move={handleComponentMove}
						on:redraw={() => {}}
						on:delete={(e) => handleComponentDelete(e.detail.id)}
					/>
				</div>
			{:else if comp.type === "2darray"}
				<div
					class="component-placeholder"
					on:mousedown={(e) => handleComponentClick(comp, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
				>
					<Table2DComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						rows={comp.rows}
						cols={comp.cols}
						on:nodeMouseDown={handleNodeMouseDown}
						on:propertyChange={(e) => handlePropertyChange(e.detail)}
						on:move={handleComponentMove}
						on:redraw={() => {}}
						on:delete={(e) => handleComponentDelete(e.detail.id)}
					/>
				</div>
			{:else if comp.type === "pointer"}
				<div
					class="component-placeholder"
					on:mousedown={(e) => handleComponentClick(comp, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
				>
					<PointerComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						value={comp.value}
						name={comp.name || "Pointer"}
						on:nodeMouseDown={handleNodeMouseDown}
						on:propertyChange={(e) => handlePropertyChange(e.detail)}
						{hoveredNode}
						on:move={handleComponentMove}
						on:redraw={() => {}}
						on:delete={(e) => handleComponentDelete(e.detail.id)}
					/>
				</div>
			{:else if comp.type === "iterator"}
				<div
					class="component-placeholder"
					on:mousedown={(e) => handleComponentClick(comp, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
				>
					<IteratorComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						linkedArrays={comp.linkedArrays || []}
						name={comp.name || "Iterator"}
						selected={selectedComponentIds.includes(comp.id)}
						on:nodeMouseDown={handleNodeMouseDown}
						on:indexUpdate={handleIteratorIndexUpdate}
						on:propertyChange={(e) => handlePropertyChange(e.detail)}
						{hoveredNode}
						on:move={handleComponentMove}
						on:redraw={() => {}}
						color={comp.color}
						on:delete={(e) => handleComponentDelete(e.detail.id)}
					/>
				</div>
			{:else if comp.type === "node"}
				<div
					class="component-placeholder"
					on:mousedown={(e) => handleComponentClick(comp, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
				>
					<NodeComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						value={comp.value}
						selected={selectedComponentIds.includes(comp.id)}
						on:propertyChange={(e) => handlePropertyChange(e.detail)}
						on:nodeMouseDown={handleNodeMouseDown}
						on:createConnectedNode={handleCreateConnectedNode}
						on:move={handleComponentMove}
						on:delete={(e) => handleComponentDelete(e.detail.id)}
					></NodeComponent>
				</div>
			{:else if comp.type === "binary-node"}
				<div
					class="component-placeholder"
					on:mousedown={(e) => handleComponentClick(comp, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
				>
					<BinaryNodeComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						value={comp.value}
						selected={selectedComponentIds.includes(comp.id)}
						on:nodeMouseDown={handleNodeMouseDown}
						on:propertyChange={(e) => handlePropertyChange(e.detail)}
						on:createConnectedNode={handleCreateConnectedNode}
						on:move={handleComponentMove}
						on:delete={(e) => handleComponentDelete(e.detail.id)}
					></BinaryNodeComponent>
				</div>
			{:else if comp.type === "nary-node"}
				<div
					class="component-placeholder"
					on:mousedown={(e) => handleComponentClick(comp, e)}
					role="button"
					tabindex="0"
					on:keydown={() => {}}
				>
					<NaryNodeComponent
						id={comp.id}
						x={comp.x}
						y={comp.y}
						value={comp.value}
						childCount={comp.childCount || 3}
						selected={selectedComponentIds.includes(comp.id)}
						on:propertyChange={(e) => handlePropertyChange(e.detail)}
						on:nodeMouseDown={handleNodeMouseDown}
						on:createConnectedNode={handleCreateConnectedNode}
						on:move={handleComponentMove}
						on:delete={(e) => handleComponentDelete(e.detail.id)}
					></NaryNodeComponent>
				</div>
			{/if}
		{/each}
		<div class="group-selection-box"></div>

		<!-- Link rendering with selection highlighting -->
		<svg
			style="position:absolute; left:0; top:0; width:5000px; height:5000px; pointer-events:none; z-index:1;"
		>
			<defs>
				<!-- Arrow marker for normal links -->
				<marker
					id="arrowhead"
					markerWidth="10"
					markerHeight="10"
					refX="9"
					refY="3"
					orient="auto"
					markerUnits="strokeWidth"
				>
					<polygon points="0 0, 10 3, 0 6" fill="context-stroke" />
				</marker>
				<!-- Arrow marker for selected links -->
				<marker
					id="arrowhead-selected"
					markerWidth="10"
					markerHeight="10"
					refX="9"
					refY="3"
					orient="auto"
					markerUnits="strokeWidth"
				>
					<polygon points="0 0, 10 3, 0 6" fill="#d32f2f" />
				</marker>
				<!-- Arrow marker for dragging link -->
				<marker
					id="arrowhead-dragging"
					markerWidth="10"
					markerHeight="10"
					refX="9"
					refY="3"
					orient="auto"
					markerUnits="strokeWidth"
				>
					<polygon points="0 0, 10 3, 0 6" fill="#1976d2" />
				</marker>
			</defs>
			{#each $linkEndpoints as { fromPos, toPos, link, path }}
				{#if fromPos && toPos}
					<!-- Thicker invisible path for easier selection -->
					<path
						d={path}
						stroke="transparent"
						stroke-width="16"
						fill="none"
						style="pointer-events:stroke"
						on:click={(e) => handleLinkClick(link, e)}
						role="button"
						tabindex="0"
						on:keydown={() => {}}
					/>
					<path
						d={path}
						stroke={selectedLinks.includes(link) ? "#d32f2f" : link.color}
						stroke-width={selectedLinks.includes(link) ? 4 : 2}
						stroke-dasharray={selectedLinks.includes(link) ? "6,3" : "none"}
						fill="none"
						marker-end={selectedLinks.includes(link)
							? "url(#arrowhead-selected)"
							: "url(#arrowhead)"}
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
							fromPos.x,
							fromPos.y,
							toPos.x,
							toPos.y,
							draggingLink.from.side,
							hoveredNode.side,
							draggingLink.from.componentId,
							hoveredNode.componentId
						)}
						stroke="#1976d2"
						stroke-width="2"
						stroke-dasharray="4"
						fill="none"
						marker-end="url(#arrowhead-dragging)"
					/>
				{:else}
					<!-- Show temp dashed line from node to mouse -->
					<line
						x1={fromPos.x}
						y1={fromPos.y}
						x2={mouse.x - $svgRect.left}
						y2={mouse.y - $svgRect.top}
						stroke="#1976d2"
						stroke-width="2"
						stroke-dasharray="6,6"
						fill="none"
					/>
				{/if}
			{/if}
		</svg>

		<!-- Selection box overlay -->
		{#if selectionBox}
			<div
				class="selection-box"
				style="position:absolute; left:{selectionBox.x}px; top:{selectionBox.y}px; width:{selectionBox.width}px; height:{selectionBox.height}px;"
			></div>
		{/if}

		<!-- Add the group selection box element -->
	</div>
	<!-- End of transformed canvas content -->

	<!-- Zoom and pan controls indicator -->
	<div class="canvas-info">
		<div>Zoom: {(zoom * 100).toFixed(0)}%</div>
		<!-- <div>Pan: X: {panX}px, Y: {panY}px</div> -->
		<div style="font-size: 11px; color: #666; margin-top: 4px;">
			Scroll: Pan | Ctrl+Scroll: Zoom | Middle Click: Pan | Ctrl+0: Reset
		</div>
	</div>
</div>

<style>
	.menubar {
		display: flex;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: linear-gradient(to bottom, #f5f5f5, #e8e8e8);
		border-bottom: 1px solid #ccc;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		padding: 0;
		height: 40px;
		user-select: none;
	}

	.menubar-right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 16px;
		padding-right: 16px;
	}

	.filename-display {
		font-size: 14px;
		font-weight: 500;
		color: #555;
		padding: 4px 12px;
		background: rgba(255, 255, 255, 0.5);
		border-radius: 4px;
	}

	.auth-loading {
		font-size: 14px;
		color: #999;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.user-avatar {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid #ddd;
	}

	.user-name {
		font-size: 14px;
		color: #333;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.btn-signin,
	.btn-signout {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.btn-signin {
		background: #4285f4;
		color: white;
	}

	.btn-signin:hover {
		background: #357ae8;
	}

	.btn-signout {
		background: #e0e0e0;
		color: #333;
	}

	.btn-signout:hover {
		background: #d0d0d0;
	}

	.menu-item {
		position: relative;
	}

	.menu-button {
		background: transparent;
		border: none;
		padding: 10px 16px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		color: #333;
		height: 40px;
		transition: background-color 0.15s;
	}

	.menu-button:hover {
		background-color: rgba(0, 0, 0, 0.08);
	}

	.dropdown {
		position: absolute;
		top: 40px;
		left: 0;
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		min-width: 220px;
		padding: 4px 0;
		z-index: 1001;
	}

	.dropdown-section {
		padding: 4px 0;
	}

	.dropdown-label {
		padding: 6px 12px;
		font-size: 11px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: 8px 12px;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
		font-size: 14px;
		color: #333;
		transition: background-color 0.1s;
	}

	.dropdown-item:hover:not(:disabled) {
		background-color: #e3f2fd;
	}

	.dropdown-item:disabled {
		color: #999;
		cursor: not-allowed;
	}

	.dropdown-divider {
		height: 1px;
		background-color: #e0e0e0;
		margin: 4px 0;
	}

	.shortcut {
		float: right;
		font-size: 12px;
		color: #888;
		margin-left: 20px;
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

	.canvas-info {
		position: fixed;
		bottom: 16px;
		right: 16px;
		background: rgba(255, 255, 255, 0.9);
		border: 1px solid #ccc;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 13px;
		font-family: monospace;
		z-index: 1000;
		pointer-events: none;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
