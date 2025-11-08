<script>
	import { get } from "svelte/store";
	import ComponentBox from "./ComponentBox.svelte";
	import { components } from "../src/Whiteboard_back";
	import { createEventDispatcher, onMount, getContext } from "svelte";

	export let id;
	export let x;
	export let y;
	export let rows = 2;
	export let cols = 3;
	export let class_ = "";

	const dispatch = createEventDispatcher();

	let highlightedCols = {};
	let highlightedRows = {};

	// Helper: blend multiple colors with alpha
	function blendColors(colors) {
		if (!colors || colors.length === 0) return "";
		if (colors.length === 1) return hexToRgba(colors[0], 0.5);
		let [r, g, b, a] = hexToRgbaArr(colors[0], 0.5);
		for (let i = 1; i < colors.length; i++) {
			const [nr, ng, nb, na] = hexToRgbaArr(colors[i], 0.5);
			r = (r + nr) / 2;
			g = (g + ng) / 2;
			b = (b + nb) / 2;
			a = Math.max(a, na);
		}
		return `rgba(${r},${g},${b},${a})`;
	}
	function hexToRgba(hex, alpha = 0.5) {
		const [r, g, b] = hexToRgbaArr(hex, alpha);
		return `rgba(${r},${g},${b},${alpha})`;
	}
	function hexToRgbaArr(hex, alpha = 0.5) {
		let c = hex.replace("#", "");
		if (c.length === 3)
			c = c
				.split("")
				.map((x) => x + x)
				.join("");
		const num = parseInt(c, 16);
		return [(num >> 16) & 255, (num >> 8) & 255, num & 255, alpha];
	}

	let data = Array.from({ length: rows }, () => Array(cols).fill(""));
	$: if (data.length !== rows || data[0]?.length !== cols) {
		const newData = Array.from({ length: rows }, (_, r) =>
			Array.from({ length: cols }, (_, c) => data[r]?.[c] ?? "")
		);
		data = newData;
	}

	// Drag state for columns
	let draggingColIndex = null;
	let hoverColIndex = null;
	let isReorderingCol = false;

	// Drag state for rows
	let draggingRowIndex = null;
	let hoverRowIndex = null;
	let isReorderingRow = false;

	// Drag state for cells
	let draggingCell = null; // {row, col}
	let hoverCell = null; // {row, col}
	let isDraggingCell = false;

	export let swap = true; // If true, swap elements; if false, insert

	// Column drag handlers
	function handleColMouseDown(colIdx, event) {
		draggingColIndex = colIdx;
		hoverColIndex = colIdx;
		isReorderingCol = true;
		event.stopPropagation();
	}

	function handleColMouseMove(colIdx) {
		if (
			isReorderingCol &&
			draggingColIndex !== null &&
			colIdx !== draggingColIndex
		) {
			hoverColIndex = colIdx;

			// Swap entire columns
			const newData = data.map((row) => [...row]);

			if (swap) {
				// Swap columns in each row
				newData.forEach((row) => {
					[row[draggingColIndex], row[hoverColIndex]] = [
						row[hoverColIndex],
						row[draggingColIndex],
					];
				});
			} else {
				// Move column (insert behavior)
				newData.forEach((row) => {
					const [moved] = row.splice(draggingColIndex, 1);
					row.splice(hoverColIndex, 0, moved);
				});
			}

			data = newData;
			draggingColIndex = hoverColIndex;
		}
	}

	function handleColMouseUp() {
		draggingColIndex = null;
		hoverColIndex = null;
		isReorderingCol = false;
	}

	// Row drag handlers
	function handleRowMouseDown(rowIdx, event) {
		draggingRowIndex = rowIdx;
		hoverRowIndex = rowIdx;
		isReorderingRow = true;
		event.stopPropagation();
	}

	function handleRowMouseMove(rowIdx) {
		if (
			isReorderingRow &&
			draggingRowIndex !== null &&
			rowIdx !== draggingRowIndex
		) {
			hoverRowIndex = rowIdx;

			const newData = [...data];

			if (swap) {
				// Swap entire rows
				[newData[draggingRowIndex], newData[hoverRowIndex]] = [
					newData[hoverRowIndex],
					newData[draggingRowIndex],
				];
			} else {
				// Move row (insert behavior)
				const [moved] = newData.splice(draggingRowIndex, 1);
				newData.splice(hoverRowIndex, 0, moved);
			}

			data = newData;
			draggingRowIndex = hoverRowIndex;
		}
	}

	function handleRowMouseUp() {
		draggingRowIndex = null;
		hoverRowIndex = null;
		isReorderingRow = false;
	}

	// Cell drag handlers (right-click to swap)
	function handleCellMouseDown(rowIdx, colIdx, event) {
		// Only start dragging on right-click (button 2)
		if (event.button !== 2) return;

		draggingCell = { row: rowIdx, col: colIdx };
		hoverCell = { row: rowIdx, col: colIdx };
		isDraggingCell = true;
		event.preventDefault(); // Prevent context menu
		event.stopPropagation();
	}

	function handleCellMouseMove(rowIdx, colIdx) {
		if (
			isDraggingCell &&
			draggingCell &&
			(rowIdx !== draggingCell.row || colIdx !== draggingCell.col)
		) {
			hoverCell = { row: rowIdx, col: colIdx };
		}
	}

	function handleCellMouseUp(rowIdx, colIdx, event) {
		if (
			isDraggingCell &&
			draggingCell &&
			(rowIdx !== draggingCell.row || colIdx !== draggingCell.col)
		) {
			// Swap cell values
			const newData = data.map((row) => [...row]);
			[newData[draggingCell.row][draggingCell.col], newData[rowIdx][colIdx]] = [
				newData[rowIdx][colIdx],
				newData[draggingCell.row][draggingCell.col],
			];
			data = newData;
		}

		draggingCell = null;
		hoverCell = null;
		isDraggingCell = false;
	}

	function handleCellContextMenu(event) {
		// Prevent default context menu when right-clicking cells
		event.preventDefault();
	}

	// Global mouse up handler
	onMount(() => {
		const handleGlobalMouseUp = () => {
			handleColMouseUp();
			handleRowMouseUp();
			if (isDraggingCell) {
				draggingCell = null;
				hoverCell = null;
				isDraggingCell = false;
			}
		};

		window.addEventListener("mouseup", handleGlobalMouseUp);

		const unsubscribe = getContext("iteratorStore").subscribe((store) => {
			if (!store) return;
			highlightedCols = {};
			highlightedRows = {};

			store.updates.forEach((update) => {
				console.log(`${update.linkedArrayId} - ${id}`);
				if (update.linkedArrayId !== id) return;
				const comp = get(components).find((c) => c.id === update.iteratorId);
				const color = comp?.color || update.color || "#ffeb3b";

				if (
					update.linkDirection === "top" ||
					update.linkDirection === "bottom"
				) {
					if (!highlightedCols[update.index])
						highlightedCols[update.index] = [];
					highlightedCols[update.index].push(color);
				} else if (
					update.linkDirection === "left" ||
					update.linkDirection === "right"
				) {
					if (!highlightedRows[update.index])
						highlightedRows[update.index] = [];
					highlightedRows[update.index].push(color);
				}
			});
		});

		return () => {
			window.removeEventListener("mouseup", handleGlobalMouseUp);
			unsubscribe();
		};
	});

	// Add this function to handle intersections
	function getIntersectionColor(rowColors, colColors) {
		// If both row and column are highlighted, blend them
		if (rowColors?.length > 0 && colColors?.length > 0) {
			// Create a deeper blend for intersections
			const allColors = [...rowColors, ...colColors];
			return blendColors(allColors);
		}
		// If only row is highlighted
		else if (rowColors?.length > 0) {
			return blendColors(rowColors);
		}
		// If only column is highlighted
		else if (colColors?.length > 0) {
			return blendColors(colColors);
		}
		// No highlighting
		return "";
	}
</script>

<ComponentBox
	{id}
	{x}
	{y}
	{class_}
	on:move={(e) => dispatch("move", e.detail)}
	on:nodeMouseDown={(e) => dispatch("nodeMouseDown", e.detail)}
	on:delete={(e) => dispatch("delete", e.detail)}
>
	<table style="border-collapse:collapse;">
		<tbody>
			<tr>
				<td style="border:1px solid #888; padding:6px;"></td>
				{#each Array(cols) as _, c}
					<td
						class="header"
						style="border:1px solid #888; padding:6px; background:#e3e3e3; cursor:move; text-align:center;
							{draggingColIndex === c ? 'opacity:0.5;' : ''}
							{hoverColIndex === c && draggingColIndex !== null && isReorderingCol
							? 'outline:2px dashed #1976d2;'
							: ''}
							background:{blendColors(highlightedCols[c])};"
						on:mousedown={(e) => handleColMouseDown(c, e)}
						on:mousemove={() => handleColMouseMove(c)}
					>
						{c}
					</td>
				{/each}
			</tr>
			{#each Array(rows) as _, r}
				<tr>
					<td
						class="header"
						style="border:1px solid #888; padding:6px; text-align:center; background:#e3e3e3; cursor:move;
							{draggingRowIndex === r ? 'opacity:0.5;' : ''}
							{hoverRowIndex === r && draggingRowIndex !== null && isReorderingRow
							? 'outline:2px dashed #1976d2;'
							: ''}
							background:{blendColors(highlightedRows[r])};"
						on:mousedown={(e) => handleRowMouseDown(r, e)}
						on:mousemove={() => handleRowMouseMove(r)}
					>
						{r}
					</td>
					{#each Array(cols) as _, c}
						<td
							style="border:1px solid #888; padding:6px; cursor:text;
								{isDraggingCell && draggingCell?.row === r && draggingCell?.col === c
								? 'opacity:0.5;'
								: ''}
								{hoverCell?.row === r && hoverCell?.col === c && isDraggingCell
								? 'outline:2px dashed #4caf50;'
								: ''}
								background:{getIntersectionColor(highlightedRows[r], highlightedCols[c])};"
							on:mousedown={(e) => handleCellMouseDown(r, c, e)}
							on:mousemove={() => handleCellMouseMove(r, c)}
							on:mouseup={(e) => handleCellMouseUp(r, c, e)}
							on:contextmenu={handleCellContextMenu}
						>
							<input
								style="width:40px;"
								bind:value={data[r][c]}
								on:change={(e) => {
									dispatch("propertyChange", {
										id,
										property: "data",
										value: data,
									});
								}}
							/>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</ComponentBox>

<style>
	input {
		background: transparent;
	}
</style>
