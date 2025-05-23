<script>
	import ArrayComponent from "../components/ArrayComponent.svelte";
	import Table2DComponent from "../components/Table2DComponent.svelte";
	import PointerComponent from "../components/PointerComponent.svelte";

	import { components, links, addArrayComponent, add2DTableComponent, addPointerComponent, nextId, duplicateComponent } from "./Whiteboard_back";

	import { onMount } from "svelte";

	let linkingFrom = null;
	let draggingLink = null;
	let mouse = { x: 0, y: 0 };
	let svgContainer;
	let svgRect = { left: 0, top: 0 };

	let hoveredNode = null;

	// Change from single selectedLink to array model
	let selectedLinks = [];
	let selectedLink = null; // Keep for backward compatibility

	// Add component selection functionality
	let selectedComponentIds = [];

	$: comps = $components;
	$: ls = $links;

	// Table of link endpoints by component id for fast update
	let linkTable = {};

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

	// Rectilinear path that avoids overlapping any component boundary box, with any number of corners
	function makeRectilinearPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId) {
		const gridSize = 8;
		const margin = 7;
		const boundary = 15;

		const fromBox = getComponentBox(fromId);
		const toBox = getComponentBox(toId);

		let start = { x: x1, y: y1 };
		let end = { x: x2, y: y2 };

		if (fromBox) {
			switch (fromSide) {
				case "top":
					start = { x: fromBox.centerX, y: fromBox.top - boundary };
					break;
				case "bottom":
					start = { x: fromBox.centerX, y: fromBox.bottom + boundary };
					break;
				case "left":
					start = { x: fromBox.left - boundary, y: fromBox.centerY };
					break;
				case "right":
					start = { x: fromBox.right + boundary, y: fromBox.centerY };
					break;
			}
		}
		if (toBox) {
			switch (toSide) {
				case "top":
					end = { x: toBox.centerX, y: toBox.top - boundary };
					break;
				case "bottom":
					end = { x: toBox.centerX, y: toBox.bottom + boundary };
					break;
				case "left":
					end = { x: toBox.left - boundary, y: toBox.centerY };
					break;
				case "right":
					end = { x: toBox.right + boundary, y: toBox.centerY };
					break;
			}
		}

		function moveOutsideBoundary(pt, box, side) {
			if (!box) return pt;
			switch (side) {
				case "top":
					return { x: box.centerX, y: box.top - boundary - 15 };
				case "bottom":
					return { x: box.centerX, y: box.bottom + boundary + 15 };
				case "left":
					return { x: box.left - boundary - 15, y: box.centerY };
				case "right":
					return { x: box.right + boundary + 15, y: box.centerY };
				default:
					return pt;
			}
		}
		if (fromBox) start = moveOutsideBoundary(start, fromBox, fromSide);
		if (toBox) end = moveOutsideBoundary(end, toBox, toSide);

		const startGrid = {
			x: Math.round(start.x / gridSize),
			y: Math.round(start.y / gridSize),
		};
		const endGrid = {
			x: Math.round(end.x / gridSize),
			y: Math.round(end.y / gridSize),
		};

		const boxes = getAllComponentBoxes([]).map((b) => ({
			...b,
			left: b.left - boundary,
			right: b.right + boundary,
			top: b.top - boundary,
			bottom: b.bottom + boundary,
		}));

		// --- DEBUG: Draw blocked grid cells temporarily ---
		{
			const svg = document.querySelector("svg");
			if (svg) {
				// Remove previous debug grid cells
				const prevGridCells = svg.querySelectorAll(".debug-grid-cell");
				prevGridCells.forEach((r) => r.parentNode && r.parentNode.removeChild(r));

				// Compute grid bounds
				const minX = Math.min(startGrid.x, endGrid.x) - 10;
				const maxX = Math.max(startGrid.x, endGrid.x) + 10;
				const minY = Math.min(startGrid.y, endGrid.y) - 10;
				const maxY = Math.max(startGrid.y, endGrid.y) + 10;

				function isCellBlocked(gx, gy) {
					if ((gx === startGrid.x && gy === startGrid.y) || (gx === endGrid.x && gy === endGrid.y)) {
						return false;
					}
					const px = gx * gridSize;
					const py = gy * gridSize;
					const blocked = boxes.some((b) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom);
					return blocked;
				}

				for (let gx = minX; gx <= maxX; gx++) {
					for (let gy = minY; gy <= maxY; gy++) {
						const blocked = isCellBlocked(gx, gy);
						const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
						rect.setAttribute("x", gx * gridSize);
						rect.setAttribute("y", gy * gridSize);
						rect.setAttribute("width", gridSize);
						rect.setAttribute("height", gridSize);
						rect.setAttribute("fill", blocked ? "#f44336" : "#4caf50");
						rect.setAttribute("fill-opacity", blocked ? "0.18" : "0.08");
						rect.setAttribute("stroke", blocked ? "#f44336" : "#4caf50");
						rect.setAttribute("stroke-width", "0.5");
						rect.setAttribute("class", "debug-grid-cell");
						rect.setAttribute("pointer-events", "none");
						svg.appendChild(rect);
					}
				}
			}
		}
		// --- END DEBUG ---

		const overlapsBox = (pt) => boxes.some((b) => pt.x >= b.left && pt.x <= b.right && pt.y >= b.top && pt.y <= b.bottom);
		if (overlapsBox(start) || overlapsBox(end)) {
			return `M${start.x},${start.y} L${end.x},${end.y}`;
		}

		// --- Remove debug SVG drawing code for rectangles and grid cells ---

		function isCellBlocked(gx, gy) {
			if ((gx === startGrid.x && gy === startGrid.y) || (gx === endGrid.x && gy === endGrid.y)) {
				return false;
			}
			const px = gx * gridSize;
			const py = gy * gridSize;
			const blocked = boxes.some((b) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom);
			return blocked;
		}

		function allowedFirstStep(dx, dy, side) {
			// Allow any direction for diagonal pathfinding
			return true;
		}
		function allowedLastStep(prev, curr, side) {
			// Allow any direction for diagonal pathfinding
			return true;
		}

		// 8-directional A* (diagonal allowed)
		const open = [];
		const cameFrom = {};
		const gScore = {};
		const fScore = {};
		const key = (p) => `${p.x},${p.y}`;
		gScore[key(startGrid)] = 0;
		fScore[key(startGrid)] = Math.hypot(startGrid.x - endGrid.x, startGrid.y - endGrid.y);

		open.push({ ...startGrid, f: fScore[key(startGrid)] });

		let found = false;
		let steps = 0;
		const maxSteps = 10000;
		const directions = [
			{ dx: 1, dy: 0 },
			{ dx: -1, dy: 0 },
			{ dx: 0, dy: 1 },
			{ dx: 0, dy: -1 },
			{ dx: 1, dy: 1 },
			{ dx: 1, dy: -1 },
			{ dx: -1, dy: 1 },
			{ dx: -1, dy: -1 },
		];
		const visited = {};

		while (open.length && steps++ < maxSteps) {
			open.sort((a, b) => a.f - b.f);
			const current = open.shift();
			visited[key(current)] = true;
			if (current.x === endGrid.x && current.y === endGrid.y) {
				found = true;
				break;
			}
			for (const { dx, dy } of directions) {
				const neighbor = { x: current.x + dx, y: current.y + dy };
				const nKey = key(neighbor);

				if (visited[nKey]) continue;
				if (isCellBlocked(neighbor.x, neighbor.y)) continue;

				const currentScore = gScore[key(current)];
				if (currentScore === undefined) continue;

				const cost = dx === 0 || dy === 0 ? 1 : Math.SQRT2;
				const tentative = currentScore + cost;

				if (tentative < (gScore[nKey] === undefined ? Infinity : gScore[nKey])) {
					cameFrom[nKey] = current;
					gScore[nKey] = tentative;
					fScore[nKey] = tentative + Math.hypot(neighbor.x - endGrid.x, neighbor.y - endGrid.y);
					if (!open.some((p) => p.x === neighbor.x && p.y === neighbor.y)) open.push({ ...neighbor, f: fScore[nKey] });
				}
			}
		}
		let path = [];
		if (found) {
			let curr = endGrid;
			while (curr && (curr.x !== startGrid.x || curr.y !== startGrid.y)) {
				path.push({ x: curr.x * gridSize, y: curr.y * gridSize });
				curr = cameFrom[key(curr)];
			}
			path.push({ x: startGrid.x * gridSize, y: startGrid.y * gridSize });
			path.reverse();

			function simplifyColinear(points) {
				if (points.length < 3) return points;
				const result = [points[0]];
				for (let i = 1; i < points.length - 1; i++) {
					const prev = result[result.length - 1];
					const curr = points[i];
					const next = points[i + 1];
					// If prev, curr, next are colinear (horizontal, vertical, or diagonal), skip curr
					if ((prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y) || (prev.x - curr.x) * (curr.y - next.y) === (prev.y - curr.y) * (curr.x - next.x)) {
						continue;
					}
					result.push(curr);
				}
				result.push(points[points.length - 1]);
				return result;
			}
			path = simplifyColinear(path);
		} else {
			path = [
				{ x: start.x, y: start.y },
				{ x: end.x, y: end.y },
			];
		}

		let d = `M${path[0].x},${path[0].y}`;
		for (let i = 1; i < path.length; i++) {
			d += ` L${path[i].x},${path[i].y}`;
		}
		return d;
	}

	onMount(() => {
		updateSvgRect();
		window.addEventListener("resize", updateSvgRect);
		return () => window.removeEventListener("resize", updateSvgRect);
	});

	function updateSvgRect() {
		if (svgContainer) {
			const rect = svgContainer.getBoundingClientRect();
			svgRect = { left: rect.left, top: rect.top };
		}
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
			links.update((current) => [
				...current,
				{
					from: draggingLink.from,
					to: hoveredNode,
				},
			]);
		}
		draggingLink = null;
		hoveredNode = null;
	}

	// Helper to update linkTable and links array with new positions
	function updateLinkTableAndLinks() {
		linkTable = {};
		let changed = false;
		ls.map((link) => {
			const fromPos = link.from.getNodeCenter();
			const toPos = link.to.getNodeCenter();
			if (!linkTable[link.from.componentId]) linkTable[link.from.componentId] = [];
			if (!linkTable[link.to.componentId]) linkTable[link.to.componentId] = [];
			linkTable[link.from.componentId].push(link);
			linkTable[link.to.componentId].push(link);
			// Only update if positions have changed
			if (link.from.x !== fromPos.x || link.from.y !== fromPos.y || link.to.x !== toPos.x || link.to.y !== toPos.y) {
				changed = true;
				return {
					...link,
					from: { ...link.from, x: fromPos.x, y: fromPos.y },
					to: { ...link.to, x: toPos.x, y: toPos.y },
				};
			}
			return link;
		});
		// Only trigger Svelte reactivity if changed
		if (changed) links.update((link) => [...link]);
	}

	// Call this after any move or link change
	$: updateLinkTableAndLinks();

	function handleComponentMove(event) {
		const { id, x, y } = event.detail;
		components.update((comps) => comps.map((comp) => (comp.id === id ? { ...comp, x, y } : comp)));
		updateLinkTableAndLinks(); // Ensure links are updated immediately after move
	}

	let usePathfinding = false; // Toggle for pathfinding vs bezier

	function makeBezierPath(x1, y1, x2, y2) {
		const dx = Math.abs(x2 - x1);
		const dy = Math.abs(y2 - y1);
		const c1x = x1 + (dx > dy ? dx / 2 : 0);
		const c1y = y1 + (dx > dy ? 0 : dy / 2);
		const c2x = x2 - (dx > dy ? dx / 2 : 0);
		const c2y = y2 - (dx > dy ? 0 : dy / 2);
		return `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
	}

	function makeSmartOrBezierPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId) {
		if (usePathfinding) {
			return makeRectilinearPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId);
		} else {
			return makeBezierPath(x1, y1, x2, y2);
		}
	}

	// Helper to get endpoints and path for all links (reactive)
	$: linkEndpoints = ls.map((link) => {
		const fromPos = link.from.getNodeCenter ? link.from.getNodeCenter() : null;
		const toPos = link.to.getNodeCenter ? link.to.getNodeCenter() : null;
		const fromSide = link.from.side;
		const toSide = link.to.side;
		const path =
			fromPos && toPos
				? makeSmartOrBezierPath(fromPos.x - svgRect.left, fromPos.y - svgRect.top, toPos.x - svgRect.left, toPos.y - svgRect.top, fromSide, toSide, link.from.componentId, link.to.componentId)
				: "";
		// Assign a random color if not already present
		if (!link.color) {
			link.color =
				"#" +
				Math.floor(Math.random() * 0xffffff)
					.toString(16)
					.padStart(6, "0");
		}
		return { fromPos, toPos, link, path };
	});

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

	function deleteSelectedLink() {
		if (selectedLink) {
			links.update((current) => current.filter((l) => l !== selectedLink));
			selectedLink = null;
		}
	}

	function deleteSelectedLinks() {
		if (selectedLinks.length > 0) {
			links.update((current) => current.filter((link) => !selectedLinks.includes(link)));
			selectedLinks = [];
			selectedLink = null;
		}
	}

	function deleteComponent(id) {
		components.update((current) => current.filter((comp) => comp.id !== id));
		links.update((current) => current.filter((l) => l.from.componentId !== id && l.to.componentId !== id));
	}

	// Listen for delete key to remove selected link
	onMount(() => {
		const onKeyDown = (e) => {
			if ((e.key === "Delete" || e.key === "Backspace") && selectedLink) {
				deleteSelectedLink();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

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
	}

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
		console.log("Component clicked:", comp.id); // Add debug logging
		// Only select if we're not working with links
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
		} else {
			// Single selection (replace current selection)
			selectedComponentIds = [comp.id];
		}

		// Make sure we stop propagation so the background click doesn't immediately deselect
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

	function handleGroupDragEnd() {
		isDraggingGroup = false;
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
	on:mousemove={handleSelectionMove}
	on:mouseup={handleSelectionEnd}
>
	<div class="menu">
		<button on:click={addArrayComponent}> Add Array </button>
		<button on:click={add2DTableComponent}> Add 2D Table </button>
		<button on:click={addPointerComponent}> Add Pointer </button>
		<!-- <button on:click={() => (usePathfinding = !usePathfinding)}>
			{usePathfinding ? "Use Bezier" : "Use Pathfinding"}
		</button> -->
	</div>
	<!-- Link rendering with selection highlighting -->
	<svg style="position:absolute; left:0; top:0; width:100vw; height:100vh; pointer-events:none; z-index:1;">
		{#each linkEndpoints as { fromPos, toPos, link, path } (link)}
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

	{#each comps as comp (comp.id)}
		{#if comp.type === "array"}
			<div on:click|stopPropagation={(e) => handleComponentClick(comp, e)}>
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
			<div on:click|stopPropagation={(e) => handleComponentClick(comp, e)}>
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
			<div on:click|stopPropagation={(e) => handleComponentClick(comp, e)}>
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

	.selected-component-wrapper {
		z-index: 2; /* Bring selected component to front */
	}

	.selection-box {
		border: 1px dashed #2196f3;
		background: rgba(33, 150, 243, 0.1);
		pointer-events: none;
		z-index: 3;
	}
</style>
