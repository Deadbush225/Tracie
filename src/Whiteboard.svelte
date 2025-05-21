<script>
	import ArrayComponent from "../components/ArrayComponent.svelte";
	import { onMount } from "svelte";
	let nextId = 1;
	let components = [
		{
			id: nextId++,
			type: "array",
			x: 100,
			y: 100,
			length: 4,
		},
		{
			id: nextId++,
			type: "array",
			x: 200,
			y: 300,
			length: 4,
		},
	];
	let links = [];
	let linkingFrom = null;
	let draggingLink = null;
	let mouse = { x: 0, y: 0 };
	let svgContainer;
	let svgRect = { left: 0, top: 0 };

	let hoveredNode = null;
	let selectedLink = null;

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
		return components
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
				prevGridCells.forEach(
					(r) => r.parentNode && r.parentNode.removeChild(r)
				);

				// Compute grid bounds
				const minX = Math.min(startGrid.x, endGrid.x) - 10;
				const maxX = Math.max(startGrid.x, endGrid.x) + 10;
				const minY = Math.min(startGrid.y, endGrid.y) - 10;
				const maxY = Math.max(startGrid.y, endGrid.y) + 10;

				function isCellBlocked(gx, gy) {
					if (
						(gx === startGrid.x && gy === startGrid.y) ||
						(gx === endGrid.x && gy === endGrid.y)
					) {
						return false;
					}
					const px = gx * gridSize;
					const py = gy * gridSize;
					const blocked = boxes.some(
						(b) =>
							px >= b.left && px <= b.right && py >= b.top && py <= b.bottom
					);
					return blocked;
				}

				for (let gx = minX; gx <= maxX; gx++) {
					for (let gy = minY; gy <= maxY; gy++) {
						const blocked = isCellBlocked(gx, gy);
						const rect = document.createElementNS(
							"http://www.w3.org/2000/svg",
							"rect"
						);
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

		const overlapsBox = (pt) =>
			boxes.some(
				(b) =>
					pt.x >= b.left && pt.x <= b.right && pt.y >= b.top && pt.y <= b.bottom
			);
		if (overlapsBox(start) || overlapsBox(end)) {
			return `M${start.x},${start.y} L${end.x},${end.y}`;
		}

		// --- Remove debug SVG drawing code for rectangles and grid cells ---

		function isCellBlocked(gx, gy) {
			if (
				(gx === startGrid.x && gy === startGrid.y) ||
				(gx === endGrid.x && gy === endGrid.y)
			) {
				return false;
			}
			const px = gx * gridSize;
			const py = gy * gridSize;
			const blocked = boxes.some(
				(b) => px >= b.left && px <= b.right && py >= b.top && py <= b.bottom
			);
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
		fScore[key(startGrid)] = Math.hypot(
			startGrid.x - endGrid.x,
			startGrid.y - endGrid.y
		);

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

				if (
					tentative < (gScore[nKey] === undefined ? Infinity : gScore[nKey])
				) {
					cameFrom[nKey] = current;
					gScore[nKey] = tentative;
					fScore[nKey] =
						tentative +
						Math.hypot(neighbor.x - endGrid.x, neighbor.y - endGrid.y);
					if (!open.some((p) => p.x === neighbor.x && p.y === neighbor.y))
						open.push({ ...neighbor, f: fScore[nKey] });
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
					if (
						(prev.x === curr.x && curr.x === next.x) ||
						(prev.y === curr.y && curr.y === next.y) ||
						(prev.x - curr.x) * (curr.y - next.y) ===
							(prev.y - curr.y) * (curr.x - next.x)
					) {
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

	function addArrayComponent() {
		const len = parseInt(prompt("Enter array length:"), 10);
		if (isNaN(len) || len < 1) return;
		components = [
			...components,
			{
				id: nextId++,
				type: "array",
				x: 100,
				y: 100,
				length: len,
			},
		];
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
		return links.some(
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
			links = [
				...links,
				{
					from: draggingLink.from,
					to: hoveredNode,
				},
			];
		}
		draggingLink = null;
		hoveredNode = null;
	}

	// Helper to update linkTable and links array with new positions
	function updateLinkTableAndLinks() {
		linkTable = {};
		let changed = false;
		links = links.map((link) => {
			const fromPos = link.from.getNodeCenter();
			const toPos = link.to.getNodeCenter();
			if (!linkTable[link.from.componentId])
				linkTable[link.from.componentId] = [];
			if (!linkTable[link.to.componentId]) linkTable[link.to.componentId] = [];
			linkTable[link.from.componentId].push(link);
			linkTable[link.to.componentId].push(link);
			// Only update if positions have changed
			if (
				link.from.x !== fromPos.x ||
				link.from.y !== fromPos.y ||
				link.to.x !== toPos.x ||
				link.to.y !== toPos.y
			) {
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
		if (changed) links = [...links];
	}

	// Call this after any move or link change
	$: updateLinkTableAndLinks();

	function handleComponentMove(event) {
		const { id, x, y } = event.detail;
		components = components.map((comp) =>
			comp.id === id ? { ...comp, x, y } : comp
		);
		updateLinkTableAndLinks(); // Ensure links are updated immediately after move
	}

	// Smart grid-based A* pathfinding that never crosses any component (fix: check for edge crossing, not just node-in-box)
	function findSmartPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId) {
		const gridSize = 16;
		const margin = 10;
		const maxSteps = 4000;

		const start = {
			x: Math.round(x1 / gridSize),
			y: Math.round(y1 / gridSize),
		};
		const end = { x: Math.round(x2 / gridSize), y: Math.round(y2 / gridSize) };

		const boxes = getAllComponentBoxes([fromId, toId]);

		// Helper to check if a line segment crosses a box
		function segmentIntersectsBox(xa, ya, xb, yb, box) {
			const minX = Math.min(xa, xb),
				maxX = Math.max(xa, xb);
			const minY = Math.min(ya, yb),
				maxY = Math.max(ya, yb);
			// If both points are outside box in same direction, skip
			if (
				maxX < box.left - margin ||
				minX > box.right + margin ||
				maxY < box.top - margin ||
				minY > box.bottom + margin
			)
				return false;
			// Check for intersection with each box edge
			const lines = [
				// top
				[
					box.left - margin,
					box.top - margin,
					box.right + margin,
					box.top - margin,
				],
				// bottom
				[
					box.left - margin,
					box.bottom + margin,
					box.right + margin,
					box.bottom + margin,
				],
				// left
				[
					box.left - margin,
					box.top - margin,
					box.left - margin,
					box.bottom + margin,
				],
				// right
				[
					box.right + margin,
					box.top - margin,
					box.right + margin,
					box.bottom + margin,
				],
			];
			for (const [x3, y3, x4, y4] of lines) {
				if (segmentsIntersect(xa, ya, xb, yb, x3, y3, x4, y4)) return true;
			}
			// Also check if the segment is entirely inside the box
			if (
				xa > box.left - margin &&
				xa < box.right + margin &&
				ya > box.top - margin &&
				ya < box.bottom + margin &&
				xb > box.left - margin &&
				xb < box.right + margin &&
				yb > box.top - margin &&
				yb < box.bottom + margin
			)
				return true;
			return false;
		}

		// Helper: do two segments intersect
		function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
			function ccw(ax, ay, bx, by, cx, cy) {
				return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
			}
			return (
				ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
				ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
			);
		}

		function isBlocked(x, y, px, py) {
			const ax = x * gridSize,
				ay = y * gridSize;
			const bx = px * gridSize,
				by = py * gridSize;
			return boxes.some((b) => segmentIntersectsBox(ax, ay, bx, by, b));
		}

		function allowedFirstStep(dx, dy, side) {
			switch (side) {
				case "top":
					return dx === 0 && dy === -1;
				case "bottom":
					return dx === 0 && dy === 1;
				case "left":
					return dx === -1 && dy === 0;
				case "right":
					return dx === 1 && dy === 0;
			}
			return true;
		}
		function allowedLastStep(prev, curr, side) {
			switch (side) {
				case "top":
					return curr.y < prev.y;
				case "bottom":
					return curr.y > prev.y;
				case "left":
					return curr.x < prev.x;
				case "right":
					return curr.x > prev.x;
			}
			return true;
		}

		const open = new PriorityQueue();
		open.enqueue(start, 0);
		const cameFrom = {};
		const gScore = {};
		const fScore = {};
		const key = (p) => `${p.x},${p.y}`;
		gScore[key(start)] = 0;
		fScore[key(start)] = Math.abs(start.x - end.x) + Math.abs(start.y - end.y);

		let found = false;
		let steps = 0;
		while (open.items.length && steps++ < maxSteps) {
			const current = open.dequeue();
			if (current.x === end.x && current.y === end.y) {
				found = true;
				break;
			}
			const neighbors = [
				{ dx: 1, dy: 0 },
				{ dx: -1, dy: 0 },
				{ dx: 0, dy: 1 },
				{ dx: 0, dy: -1 },
			];
			for (const { dx, dy } of neighbors) {
				const neighbor = { x: current.x + dx, y: current.y + dy };
				const nKey = key(neighbor);

				// First step: must go in allowed direction from start
				if (key(current) === key(start) && !allowedFirstStep(dx, dy, fromSide))
					continue;

				// Last step: must approach end from allowed direction
				if (neighbor.x === end.x && neighbor.y === end.y) {
					if (!allowedLastStep(current, neighbor, toSide)) continue;
				}

				if (isBlocked(neighbor.x, neighbor.y, current.x, current.y)) continue;
				const tentative = (gScore[key(current)] || 99999) + 1;
				if (tentative < (gScore[nKey] || 99999)) {
					cameFrom[nKey] = current;
					gScore[nKey] = tentative;
					fScore[nKey] =
						tentative +
						Math.abs(neighbor.x - end.x) +
						Math.abs(neighbor.y - end.y);
					if (!open.items.some((p) => p.x === neighbor.x && p.y === neighbor.y))
						open.enqueue(neighbor, fScore[nKey]);
				}
			}
		}
		let path = [];
		if (found) {
			let curr = end;
			while (curr && (curr.x !== start.x || curr.y !== start.y)) {
				path.push({ x: curr.x * gridSize, y: curr.y * gridSize });
				curr = cameFrom[key(curr)];
			}
			path.push({ x: start.x * gridSize, y: start.y * gridSize });
			path.reverse();
		} else {
			// fallback: straight line
			path = [
				{ x: x1, y: y1 },
				{ x: x2, y: y2 },
			];
		}
		return path;
	}

	function makeSmartSVGPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId) {
		const pts = findSmartPath(x1, y1, x2, y2, fromSide, toSide, fromId, toId);
		let d = `M${pts[0].x},${pts[0].y}`;
		for (let i = 1; i < pts.length; i++) {
			d += ` L${pts[i].x},${pts[i].y}`;
		}
		return d;
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

	function makeSmartOrBezierPath(
		x1,
		y1,
		x2,
		y2,
		fromSide,
		toSide,
		fromId,
		toId
	) {
		if (usePathfinding) {
			return makeRectilinearPath(
				x1,
				y1,
				x2,
				y2,
				fromSide,
				toSide,
				fromId,
				toId
			);
		} else {
			return makeBezierPath(x1, y1, x2, y2);
		}
	}

	// Helper to get endpoints and path for all links (reactive)
	$: linkEndpoints = links.map((link) => {
		const fromPos = link.from.getNodeCenter ? link.from.getNodeCenter() : null;
		const toPos = link.to.getNodeCenter ? link.to.getNodeCenter() : null;
		const fromSide = link.from.side;
		const toSide = link.to.side;
		const path =
			fromPos && toPos
				? makeSmartOrBezierPath(
						fromPos.x - svgRect.left,
						fromPos.y - svgRect.top,
						toPos.x - svgRect.left,
						toPos.y - svgRect.top,
						fromSide,
						toSide,
						link.from.componentId,
						link.to.componentId
					)
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

	// Force redraw when any component moves (by tracking all positions)
	$: tick = components.map((c) => `${c.x},${c.y}`).join(";");

	function handleLinkClick(link, event) {
		event.stopPropagation();
		selectedLink = link;
	}

	function deleteSelectedLink() {
		if (selectedLink) {
			links = links.filter((l) => l !== selectedLink);
			selectedLink = null;
		}
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
</script>

<div
	bind:this={svgContainer}
	style="position:relative; width:100vw; height:100vh; background:#f8f8f8;"
>
	<button
		on:click={addArrayComponent}
		style="position:absolute; top:10px; left:10px; z-index:10;"
	>
		Add Array Component
	</button>
	<svg
		style="position:absolute; left:0; top:0; width:100vw; height:100vh; pointer-events:none; z-index:1;"
	>
		{#each linkEndpoints as { fromPos, toPos, link, path } (link)}
			{#if fromPos && toPos}
				<path
					d={path}
					stroke={selectedLink === link ? "#d32f2f" : link.color}
					stroke-width={selectedLink === link ? 4 : 2}
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
				<line
					x1={fromPos.x - svgRect.left}
					y1={fromPos.y - svgRect.top}
					x2={mouse.x - svgRect.left}
					y2={mouse.y - svgRect.top}
					stroke="#1976d2"
					stroke-width="2"
					stroke-dasharray="6,6"
					fill="none"
				/>
			{/if}
		{/if}
	</svg>
	<button
		on:click={() => (usePathfinding = !usePathfinding)}
		style="position:absolute; top:10px; left:160px; z-index:10;"
	>
		{usePathfinding ? "Use Bezier" : "Use Pathfinding"}
	</button>
	{#each components as comp (comp.id)}
		{#if comp.type === "array"}
			<ArrayComponent
				id={comp.id}
				x={comp.x}
				y={comp.y}
				length={comp.length}
				on:nodeMouseDown={handleNodeMouseDown}
				{hoveredNode}
				on:move={handleComponentMove}
				on:redraw={() => {}}
			/>
		{/if}
	{/each}
</div>
