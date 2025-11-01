# Component Pattern Guide

## Creating New Components

All visual components in Tracie should use the `ComponentBox` wrapper to handle common functionality like dragging, connection points, and deletion.

### Basic Pattern

```svelte
<script>
	import { createEventDispatcher } from "svelte";
	import ComponentBox from "./ComponentBox.svelte";

	export let id;
	export let x;
	export let y;
	export let class_ = "";
	export let hoveredNode = null;
	// Add your custom props here

	const dispatch = createEventDispatcher();

	// Define which connection points this component exposes
	const connectionPoints = ["top", "bottom", "left", "right"];
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
	<!-- Your component content here -->
</ComponentBox>
```

### Available Connection Points

- **Basic**: `"top"`, `"bottom"`, `"left"`, `"right"`
- **Binary Tree**: `"bottom-left"`, `"bottom-right"`
- **Diagonal**: `"top-left"`, `"top-right"`

### Customization Options

#### Border Radius

Make circular components with `borderRadius="50%"`:

```svelte
<ComponentBox
	{...props}
	borderRadius="50%"
>
```

#### Border Color

Change the border color to match your component theme:

```svelte
<ComponentBox
	{...props}
	borderColor="#4CAF50"
>
```

#### Connection Points

Only expose the connection points your component needs:

```svelte
// Pointer - only needs right connection
const connectionPoints = ["right"];

// Iterator - only needs bottom connection
const connectionPoints = ["bottom"];

// Binary Node - needs top and bottom connections
const connectionPoints = ["top", "bottom-left", "bottom-right"];

// Full node - all 4 directions
const connectionPoints = ["top", "bottom", "left", "right"];
```

## Benefits of This Pattern

1. **Encapsulation**: Each component manages its own connection logic
2. **Consistency**: All components behave the same way
3. **Maintainability**: Changes to connection logic happen in one place (ComponentBox)
4. **Reusability**: Easy to create new components by following the pattern
5. **Clean API**: Parent components don't need to know implementation details

## Examples

See these components for reference:

- `PointerComponent.svelte` - Simple component with one connection
- `VariableComponent.svelte` - Circular component with left/right connections
- `IteratorComponent.svelte` - Component with bottom connection only
- `NodeComponent.svelte` - Component with all four basic connections
- `BinaryNodeComponent.svelte` - Tree node with specialized connections
