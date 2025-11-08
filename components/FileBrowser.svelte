<script>
	import { onMount } from "svelte";
	import { user } from "../src/firebase";
	import {
		fileList,
		showFileBrowser,
		refreshFileList,
		loadFileFromFirebase,
		deleteFileFromFirebase,
	} from "../src/fileManager";

	let loading = false;
	let error = null;

	onMount(async () => {
		if ($user) {
			try {
				loading = true;
				await refreshFileList($user.uid);
			} catch (err) {
				error = err.message;
			} finally {
				loading = false;
			}
		}
	});

	async function handleLoadFile(filename) {
		try {
			loading = true;
			error = null;
			await loadFileFromFirebase($user.uid, filename);
			showFileBrowser.set(false);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	async function handleDeleteFile(filename) {
		if (!confirm(`Delete "${filename}"?`)) return;

		try {
			loading = true;
			error = null;
			await deleteFileFromFirebase($user.uid, filename);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	function handleClose() {
		showFileBrowser.set(false);
	}

	function formatDate(isoString) {
		if (!isoString) return "Unknown";
		const date = new Date(isoString);
		return date.toLocaleString();
	}
</script>

{#if $showFileBrowser}
	<div class="modal-backdrop" on:click={handleClose} role="presentation">
		<div
			class="modal"
			on:click|stopPropagation
			on:keydown|stopPropagation
			role="dialog"
			tabindex="-1"
			aria-modal="true"
		>
			<div class="modal-header">
				<h2>Browse Files</h2>
				<button class="close-btn" on:click={handleClose}>×</button>
			</div>

			<div class="modal-body">
				{#if error}
					<div class="error">{error}</div>
				{/if}

				{#if loading}
					<div class="loading">Loading...</div>
				{:else if $fileList.length === 0}
					<div class="empty">No files yet. Save your first file!</div>
				{:else}
					<div class="file-list">
						{#each $fileList as file}
							<div class="file-item">
								<div class="file-info">
									<div class="file-name">{file.name}</div>
									<div class="file-date">{formatDate(file.updatedAt)}</div>
								</div>
								<div class="file-actions">
									<button
										class="btn-load"
										on:click={() => handleLoadFile(file.name)}
										disabled={loading}
									>
										Open
									</button>
									<button
										class="btn-delete"
										on:click={() => handleDeleteFile(file.name)}
										disabled={loading}
									>
										Delete
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 20px;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 20px;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 28px;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: #333;
	}

	.modal-body {
		padding: 20px;
		overflow-y: auto;
		flex: 1;
	}

	.error {
		background: #ffebee;
		color: #c62828;
		padding: 12px;
		border-radius: 4px;
		margin-bottom: 16px;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.empty {
		text-align: center;
		padding: 40px;
		color: #999;
	}

	.file-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.file-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.file-item:hover {
		background: #f5f5f5;
	}

	.file-info {
		flex: 1;
	}

	.file-name {
		font-weight: 500;
		margin-bottom: 4px;
	}

	.file-date {
		font-size: 12px;
		color: #666;
	}

	.file-actions {
		display: flex;
		gap: 8px;
	}

	.btn-load,
	.btn-delete {
		padding: 6px 12px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.btn-load {
		background: #1976d2;
		color: white;
	}

	.btn-load:hover:not(:disabled) {
		background: #0d47a1;
	}

	.btn-delete {
		background: #e0e0e0;
		color: #333;
	}

	.btn-delete:hover:not(:disabled) {
		background: #d32f2f;
		color: white;
	}

	.btn-load:disabled,
	.btn-delete:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
