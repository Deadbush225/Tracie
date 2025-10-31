# Tracie - Interactive Algorithm Visualization Toolkit

Tracie is an interactive whiteboard tool designed to help visualize data structures and algorithms. It allows you to create, manipulate, and connect various data structure components to trace through algorithms step-by-step.

## Features

- Create and manipulate array, 2D table, and pointer components
- Connect components with links to show relationships and references
- Select and move multiple components together
- Full undo/redo functionality
- Intuitive drag-and-drop interface

## Live Preview

Try out Tracie: [Live Demo](https://tracie-viz.vercel.app/)

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tracie.git

# Navigate to the project directory
cd tracie

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## Keyboard Shortcuts & Controls

### Component Management

- **Select Component**: Click on any component
- **Multi-select**: Shift+Click on components
- **Select All**: Ctrl+A
- **Deselect All**: Click on the background
- **Delete Component(s)**: Delete or Backspace
- **Duplicate Component(s)**: Ctrl+D

### Selection Box

- **Create Selection Box**: Click and drag on the background
- **Add to Selection**: Shift+Click and drag

### Moving Components

- **Move Component**: Click and drag component
- **Move Multiple Components**: Select multiple components, then drag any selected component

### Linking Components

- **Create Link**: Drag from a connection node of one component to another
- **Select Link**: Click on any link
- **Multi-select Links**: Shift+Click on links
- **Delete Link(s)**: Select link(s) and press Delete

### History

- **Undo**: Ctrl+Z
- **Redo**: Ctrl+Y or Ctrl+Shift+Z

## Components

### Arrays

- 1D array with dragable indices and editable values
- Click and drag column headers to reorder array elements

### 2D Tables

- Two-dimensional arrays with row and column indices
- Editable cell values

### Pointers

- Named pointer elements
- Connect to arrays or other components

## Tips

- Use Shift+Click to select multiple components for group operations
- The selection box allows for easy visualization of group selections
- Component movement is optimized to only record final positions in the history

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
