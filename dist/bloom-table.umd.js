(function(global, factory) {
	typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require("react"), require("react-dom/client"), require("react-dom"), require("@mui/material/Divider"), require("@mui/material/ListItemIcon"), require("@mui/material/ListItemText"), require("@mui/material/MenuItem"), require("@mui/material/ToggleButton"), require("react/jsx-runtime"), require("@mui/material/IconButton")) : typeof define === "function" && define.amd ? define([
		"exports",
		"react",
		"react-dom/client",
		"react-dom",
		"@mui/material/Divider",
		"@mui/material/ListItemIcon",
		"@mui/material/ListItemText",
		"@mui/material/MenuItem",
		"@mui/material/ToggleButton",
		"react/jsx-runtime",
		"@mui/material/IconButton"
	], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.BloomTable = {}, global.React, global.react_dom_client, global.ReactDOM, global._mui_material_Divider, global._mui_material_ListItemIcon, global._mui_material_ListItemText, global._mui_material_MenuItem, global._mui_material_ToggleButton, global.react_jsx_runtime, global._mui_material_IconButton));
})(this, function(exports, react, react_dom_client, react_dom, _mui_material_Divider, _mui_material_ListItemIcon, _mui_material_ListItemText, _mui_material_MenuItem, _mui_material_ToggleButton, react_jsx_runtime, _mui_material_IconButton) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region \0rolldown/runtime.js
	var __create = Object.create;
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __getProtoOf = Object.getPrototypeOf;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: ((k) => from[k]).bind(null, key),
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
		value: mod,
		enumerable: true
	}) : target, mod));
	//#endregion
	react = __toESM(react);
	_mui_material_Divider = __toESM(_mui_material_Divider);
	_mui_material_ListItemIcon = __toESM(_mui_material_ListItemIcon);
	_mui_material_ListItemText = __toESM(_mui_material_ListItemText);
	_mui_material_MenuItem = __toESM(_mui_material_MenuItem);
	_mui_material_ToggleButton = __toESM(_mui_material_ToggleButton);
	_mui_material_IconButton = __toESM(_mui_material_IconButton);
	//#region src/history.ts
	let restoreReattacher = () => {};
	function setRestoreReattacher(fn) {
		restoreReattacher = fn;
	}
	function pathFromTopLevel(top, table) {
		const path = [];
		let node = table;
		while (node !== top) {
			const parent = node.parentElement;
			if (!parent) return null;
			path.unshift(Array.prototype.indexOf.call(parent.children, node));
			node = parent;
		}
		return path;
	}
	function resolveOwnTable(top, path) {
		if (!path) return top;
		let node = top;
		for (const index of path) {
			const next = node.children[index];
			if (!next) return top;
			node = next;
		}
		return node.classList?.contains("bloom-table") ? node : top;
	}
	const labelOf = (d) => typeof d === "string" ? d : d.label;
	const detailOf = (d) => typeof d === "string" ? void 0 : d.detail;
	var TableHistoryManager = class {
		constructor() {
			this.history = [];
			this.redoStack = [];
			this.maxEntriesPerTable = 50;
			this.attachedTables = /* @__PURE__ */ new Set();
			this.operationInProgress = false;
		}
		reset() {
			this.history = [];
			this.redoStack = [];
			this.attachedTables = /* @__PURE__ */ new Set();
			this.operationInProgress = false;
		}
		getEntriesForDebug() {
			return this.history.map((e) => this.toDebugEntry(e));
		}
		getRedoEntriesForDebug() {
			return this.redoStack.map((e) => this.toDebugEntry(e));
		}
		toDebugEntry(e) {
			return {
				label: e.label,
				detail: e.detail,
				timestamp: e.timestamp,
				tableInDom: !!e.table && document.body.contains(e.table)
			};
		}
		captureTableState(table) {
			const attributes = {};
			if (table.attributes) for (let i = 0; i < table.attributes.length; i++) {
				const attr = table.attributes[i];
				if (attr && attr.name) attributes[attr.name] = attr.value || "";
			}
			return {
				innerHTML: table.innerHTML,
				attributes
			};
		}
		addHistoryEntry(table, description, performOperation, undoOperation, redoOperation) {
			const label = labelOf(description);
			const detail = detailOf(description);
			const topLevelTable = this.findTopLevelTable(table);
			if (!topLevelTable || !this.isAttached(topLevelTable)) {
				console.warn("TableHistoryManager: Attempted to add history entry for a detached or null table.");
				return false;
			}
			if (this.operationInProgress) {
				console.warn("TableHistoryManager: Operation already in progress. Skipping new history entry.");
				return false;
			}
			const stateBeforeOperation = this.captureTableState(topLevelTable);
			const ownTablePath = pathFromTopLevel(topLevelTable, table) ?? void 0;
			this.operationInProgress = true;
			let operationSuccess = false;
			try {
				performOperation();
				operationSuccess = true;
				const entry = {
					state: stateBeforeOperation,
					timestamp: Date.now(),
					label,
					detail,
					table: topLevelTable,
					ownTablePath,
					undoOperation,
					redoOperation
				};
				this.history.push(entry);
				let countForTable = this.history.filter((e) => e.table === topLevelTable).length;
				while (countForTable > this.maxEntriesPerTable) {
					const oldest = this.history.findIndex((e) => e.table === topLevelTable);
					this.history.splice(oldest, 1);
					countForTable--;
				}
				this.redoStack = this.redoStack.filter((e) => e.table !== topLevelTable);
			} catch (error) {
				console.error("TableHistoryManager: Error during operation execution:", error);
				try {
					this.defaultUndoOperation(topLevelTable, stateBeforeOperation);
				} catch (restoreError) {
					console.error("TableHistoryManager: Failed to restore the table after a failed operation:", restoreError);
				}
			} finally {
				this.operationInProgress = false;
				if (operationSuccess) {
					const event = new CustomEvent("tableHistoryUpdated", { detail: {
						operation: label,
						operationDetail: detail,
						table: topLevelTable,
						canUndo: this.canUndo(),
						canRedo: this.canRedo()
					} });
					document.dispatchEvent(event);
				}
			}
			return operationSuccess;
		}
		undo(table) {
			if (!this.canUndo()) {
				console.warn("TableHistoryManager: Cannot undo. Either history is empty or an operation is in progress.");
				return false;
			}
			const topLevelTable = this.findTopLevelTable(table);
			if (!topLevelTable || !this.isAttached(topLevelTable)) {
				console.warn("TableHistoryManager: Cannot undo. Top-level table not found or not attached.");
				return false;
			}
			const newestEntry = this.history[this.history.length - 1];
			if (newestEntry.table && newestEntry.table !== topLevelTable) {
				console.warn("TableHistoryManager: Cannot undo. The most recent operation belongs to a different table.");
				return false;
			}
			const entry = this.history.pop();
			if (!entry) {
				console.warn("TableHistoryManager: History is empty, cannot undo.");
				return false;
			}
			this.operationInProgress = true;
			let undoSuccess = false;
			try {
				const owner = entry.table ?? topLevelTable;
				entry.redoState = this.captureTableState(owner);
				if (entry.undoOperation) entry.undoOperation(resolveOwnTable(owner, entry.ownTablePath), entry.state);
				else this.defaultUndoOperation(owner, entry.state);
				this.reattachRestoredTables(owner);
				undoSuccess = true;
				this.redoStack.push(entry);
			} catch (error) {
				console.error("TableHistoryManager: Error during undo operation:", error);
				entry.redoState = void 0;
				this.history.push(entry);
			} finally {
				this.operationInProgress = false;
				const event = new CustomEvent("tableHistoryUpdated", { detail: {
					operation: `Undo ${entry.label}`,
					operationDetail: entry.detail,
					table: entry.table ?? topLevelTable,
					undoSuccess,
					canUndo: this.canUndo(),
					canRedo: this.canRedo()
				} });
				document.dispatchEvent(event);
			}
			return undoSuccess;
		}
		redo(table) {
			if (!this.canRedo()) {
				console.warn("TableHistoryManager: Cannot redo. Either the redo stack is empty or an operation is in progress.");
				return false;
			}
			const topLevelTable = this.findTopLevelTable(table);
			if (!topLevelTable || !this.isAttached(topLevelTable)) {
				console.warn("TableHistoryManager: Cannot redo. Top-level table not found or not attached.");
				return false;
			}
			const newestEntry = this.redoStack[this.redoStack.length - 1];
			if (newestEntry.table && newestEntry.table !== topLevelTable) {
				console.warn("TableHistoryManager: Cannot redo. The most recent undone operation belongs to a different table.");
				return false;
			}
			const entry = this.redoStack.pop();
			if (!entry) {
				console.warn("TableHistoryManager: Redo stack is empty, cannot redo.");
				return false;
			}
			if (!entry.redoState) {
				console.warn(`TableHistoryManager: Dropping redo entry "${entry.label}" because it has no captured state.`);
				return false;
			}
			this.operationInProgress = true;
			let redoSuccess = false;
			try {
				const owner = entry.table ?? topLevelTable;
				if (entry.redoOperation) entry.redoOperation(resolveOwnTable(owner, entry.ownTablePath));
				else this.defaultUndoOperation(owner, entry.redoState);
				this.reattachRestoredTables(owner);
				redoSuccess = true;
				entry.redoState = void 0;
				this.history.push(entry);
			} catch (error) {
				console.error("TableHistoryManager: Error during redo operation:", error);
				this.redoStack.push(entry);
			} finally {
				this.operationInProgress = false;
				const event = new CustomEvent("tableHistoryUpdated", { detail: {
					operation: `Redo ${entry.label}`,
					operationDetail: entry.detail,
					table: entry.table ?? topLevelTable,
					redoSuccess,
					canUndo: this.canUndo(),
					canRedo: this.canRedo()
				} });
				document.dispatchEvent(event);
			}
			return redoSuccess;
		}
		undoLast() {
			if (!this.canUndo()) return false;
			while (this.history.length > 0) {
				const entry = this.history[this.history.length - 1];
				if (entry.table && this.isAttached(entry.table)) return this.undo(entry.table);
				console.warn(`TableHistoryManager: Dropping history entry "${entry.label}" because its table is no longer attached.`);
				this.history.pop();
			}
			return false;
		}
		redoLast() {
			if (!this.canRedo()) return false;
			while (this.redoStack.length > 0) {
				const entry = this.redoStack[this.redoStack.length - 1];
				if (entry.table && this.isAttached(entry.table)) return this.redo(entry.table);
				console.warn(`TableHistoryManager: Dropping redo entry "${entry.label}" because its table is no longer attached.`);
				this.redoStack.pop();
			}
			return false;
		}
		attachTable(table) {
			this.attachedTables.add(table);
		}
		detachTable(table) {
			this.attachedTables.delete(table);
			const before = this.history.length + this.redoStack.length;
			this.history = this.history.filter((e) => e.table !== table);
			this.redoStack = this.redoStack.filter((e) => e.table !== table);
			if (this.history.length + this.redoStack.length < before) {
				const event = new CustomEvent("tableHistoryUpdated", { detail: {
					operation: "Detach Table",
					table,
					canUndo: this.canUndo(),
					canRedo: this.canRedo()
				} });
				document.dispatchEvent(event);
			}
		}
		isAttached(table) {
			return this.attachedTables.has(table);
		}
		canUndo(table) {
			if (!table) return this.history.length > 0 && !this.operationInProgress;
			const e = this.history[this.history.length - 1];
			const top = this.findTopLevelTable(table);
			return !!e && !this.operationInProgress && this.isAttached(top) && (!e.table || e.table === top);
		}
		canRedo(table) {
			if (!table) return this.redoStack.length > 0 && !this.operationInProgress;
			const e = this.redoStack[this.redoStack.length - 1];
			const top = this.findTopLevelTable(table);
			return !!e && !this.operationInProgress && this.isAttached(top) && (!e.table || e.table === top);
		}
		getLastOperationLabel() {
			if (this.history.length === 0) return null;
			return this.history[this.history.length - 1].label;
		}
		getNextRedoLabel() {
			if (this.redoStack.length === 0) return null;
			return this.redoStack[this.redoStack.length - 1].label;
		}
		clearHistory() {
			this.history = [];
			this.redoStack = [];
			const event = new CustomEvent("tableHistoryUpdated", { detail: {
				operation: "Clear History",
				canUndo: false,
				canRedo: false
			} });
			document.dispatchEvent(event);
		}
		defaultUndoOperation(table, prevState) {
			const attributesToRemove = [];
			for (let i = 0; i < table.attributes.length; i++) {
				const attr = table.attributes[i];
				if (attr && attr.name) attributesToRemove.push(attr.name);
			}
			attributesToRemove.forEach((name) => {
				table.removeAttribute(name);
			});
			if (prevState.attributes) Object.entries(prevState.attributes).forEach(([name, value]) => {
				table.setAttribute(name, value);
			});
			table.innerHTML = prevState.innerHTML;
		}
		reattachRestoredTables(table) {
			table.querySelectorAll(".bloom-table").forEach((nested) => restoreReattacher(nested));
		}
		findTopLevelTable(table) {
			let currentTable = table;
			let parentTable = currentTable.parentElement?.closest(".bloom-table");
			while (parentTable) {
				currentTable = parentTable;
				parentTable = currentTable.parentElement?.closest(".bloom-table");
			}
			return currentTable;
		}
	};
	const tableHistoryManager = new TableHistoryManager();
	//#endregion
	//#region src/components/icons/cell-content-text.svg
	var cell_content_text_default = "data:image/svg+xml,<svg width=\"17\" height=\"16\" viewBox=\"0 0 17 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<g clip-path=\"url(%23clip0_5668_220)\">%0A<path d=\"M9.64396 12.7432L5.89396 2.74316C5.84482 2.61211 5.75686 2.49917 5.64183 2.41944C5.52679 2.33972 5.39017 2.297 5.25021 2.297C5.11024 2.297 4.97362 2.33972 4.85858 2.41944C4.74355 2.49917 4.65559 2.61211 4.60645 2.74316L0.856455 12.7432C0.794432 12.9135 0.802158 13.1013 0.877951 13.266C0.953745 13.4306 1.09147 13.5586 1.26118 13.6222C1.43089 13.6858 1.61884 13.6798 1.78416 13.6056C1.94948 13.5313 2.07879 13.3948 2.14395 13.2257L3.27395 10.2125C3.27841 10.2006 3.28638 10.1904 3.29683 10.1831C3.30727 10.1758 3.31968 10.1719 3.33239 10.1719H7.16802C7.18073 10.1719 7.19314 10.1758 7.20358 10.1831C7.21403 10.1904 7.222 10.2006 7.22646 10.2125L8.35645 13.2257C8.42162 13.3948 8.55093 13.5313 8.71625 13.6056C8.88157 13.6798 9.06952 13.6858 9.23923 13.6222C9.40893 13.5586 9.54666 13.4306 9.62246 13.266C9.69825 13.1013 9.70598 12.9135 9.64396 12.7432ZM3.83645 8.71191L5.19177 5.09785C5.19627 5.08599 5.20426 5.07578 5.2147 5.06858C5.22514 5.06137 5.23752 5.05752 5.25021 5.05752C5.26289 5.05752 5.27527 5.06137 5.28571 5.06858C5.29615 5.07578 5.30414 5.08599 5.30864 5.09785L6.66396 8.71254C6.66748 8.72198 6.66868 8.73214 6.66743 8.74215C6.66618 8.75215 6.66253 8.76171 6.65679 8.77C6.65105 8.77829 6.64339 8.78507 6.63446 8.78975C6.62553 8.79444 6.6156 8.7969 6.60552 8.79691H3.89489C3.88481 8.7969 3.87488 8.79444 3.86595 8.78975C3.85702 8.78507 3.84936 8.77829 3.84362 8.77C3.83788 8.76171 3.83423 8.75215 3.83298 8.74215C3.83173 8.73214 3.83293 8.72198 3.83645 8.71254V8.71191ZM13.0243 5.29691C11.7205 5.28754 10.553 6.04285 10.0555 7.21566C9.98424 7.3835 9.98255 7.57277 10.0508 7.74184C10.1191 7.91092 10.2517 8.04595 10.4196 8.11723C10.5874 8.1885 10.7767 8.19019 10.9458 8.12191C11.1148 8.05364 11.2499 7.921 11.3211 7.75316C11.5986 7.10035 12.2515 6.67691 12.9874 6.67191C13.9974 6.66504 14.8127 7.50004 14.8127 8.51098C14.8127 8.52314 14.808 8.53483 14.7995 8.54358C14.7911 8.55233 14.7796 8.55745 14.7674 8.55785C14.0824 8.57691 13.2699 8.62254 12.5449 8.70785C10.834 8.9091 9.81271 9.84191 9.81271 11.2032C9.81271 11.9279 10.0865 12.5782 10.5836 13.0369C11.0502 13.4666 11.6877 13.7032 12.3752 13.7032C13.344 13.7032 14.178 13.4532 14.8108 12.9775H14.8127C14.8123 13.0678 14.8297 13.1573 14.8639 13.2409C14.8981 13.3244 14.9484 13.4004 15.012 13.4645C15.0755 13.5287 15.1511 13.5796 15.2344 13.6145C15.3176 13.6494 15.407 13.6676 15.4972 13.668C15.5875 13.6684 15.677 13.651 15.7606 13.6168C15.8441 13.5826 15.9201 13.5323 15.9842 13.4687C16.0484 13.4052 16.0993 13.3296 16.1342 13.2463C16.1691 13.1631 16.1873 13.0738 16.1877 12.9835V8.51473C16.1877 6.7591 14.7815 5.30973 13.0243 5.29691ZM12.3752 12.3282C11.8274 12.3282 11.1877 12.0335 11.1877 11.2032C11.1877 10.8697 11.3074 10.6363 11.5761 10.446C11.8377 10.2607 12.2386 10.1285 12.7055 10.0735C13.3655 9.99566 14.1061 9.95285 14.7411 9.93379C14.7496 9.93378 14.758 9.93549 14.7658 9.93883C14.7736 9.94216 14.7806 9.94705 14.7865 9.95319C14.7923 9.95932 14.7969 9.96659 14.7998 9.97453C14.8028 9.98248 14.8041 9.99095 14.8036 9.99941C14.719 11.5657 13.9208 12.3282 12.3752 12.3282Z\" fill=\"white\"/>%0A</g>%0A<defs>%0A<clipPath id=\"clip0_5668_220\">%0A<rect width=\"16\" height=\"16\" fill=\"white\" transform=\"translate(0.5)\"/>%0A</clipPath>%0A</defs>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/cell-content-table.svg
	var cell_content_table_default = "data:image/svg+xml,<svg width=\"29\" height=\"28\" viewBox=\"0 0 29 28\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M27.1 0H1.9C1.5287 0 1.1726 0.1475 0.91005 0.41005C0.6475 0.672601 0.5 1.0287 0.5 1.4V26.6C0.5 26.9713 0.6475 27.3274 0.91005 27.59C1.1726 27.8525 1.5287 28 1.9 28H27.1C27.4713 28 27.8274 27.8525 28.09 27.59C28.3525 27.3274 28.5 26.9713 28.5 26.6V1.4C28.5 1.0287 28.3525 0.672601 28.09 0.41005C27.8274 0.1475 27.4713 0 27.1 0ZM8.9 25.2H3.3V19.6H8.9V25.2ZM8.9 16.8H3.3V11.2H8.9V16.8ZM8.9 8.4H3.3V2.8H8.9V8.4ZM17.3 25.2H11.7V19.6H17.3V25.2ZM17.3 16.8H11.7V11.2H17.3V16.8ZM17.3 8.4H11.7V2.8H17.3V8.4ZM25.7 25.2H20.1V19.6H25.7V25.2ZM25.7 16.8H20.1V11.2H25.7V16.8ZM25.7 8.4H20.1V2.8H25.7V8.4Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/cell-content-image.svg
	var cell_content_image_default = "data:image/svg+xml,<svg width=\"31\" height=\"28\" viewBox=\"0 0 31 28\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.4167 4.75935C10.5581 2.8239 11.7076 0.148281 14.1445 0.118092C16.8273 -0.0556603 19.5814 1.3524 20.9641 3.51244C22.6317 5.99843 19.6904 10.7683 19.319 10.9246C20.437 10.4919 21.4153 9.7667 22.3907 9.04357C23.7809 8.01293 25.1654 6.98658 26.9403 6.81773C30.0077 6.81867 30.8203 10.5466 30.1679 12.8246C29.7148 15.9463 26.3527 18.4318 23.0568 17.4065C22.8324 17.3502 22.5705 17.2745 22.3081 17.1985C21.3021 16.9074 20.2888 16.6142 21.3532 17.4084C21.5409 17.5485 21.7224 17.6996 21.8981 17.8546C22.4581 18.3487 23.1377 18.7823 23.8231 19.2196C25.3726 20.2082 26.9516 21.2156 27.2437 22.9825C27.2822 23.2149 27.2763 23.454 27.2269 23.6843C26.6223 26.5023 22.7549 27.495 20.0895 27.1047C16.9188 26.8528 14.9337 23.8319 15.2689 20.9691C15.4234 18.9594 14.7825 20.594 14.3816 21.6164C14.3289 21.7509 14.2803 21.8749 14.2382 21.9785C14.0458 22.4354 13.8811 22.9553 13.7107 23.4932C13.1277 25.3337 12.478 27.3845 10.4213 27.8417C10.2198 27.8865 10.0111 27.8977 9.80537 27.8806C6.53799 27.6089 4.53986 24.0627 4.60752 21.1769C4.58482 18.4834 7.11465 16.7127 9.6401 16.0399C9.90624 15.969 10.3148 15.782 10.0475 15.7155C9.73029 15.6365 8.99513 15.6175 8.34882 15.6008C7.9324 15.5901 7.55286 15.5802 7.34576 15.556C7.09261 15.5575 6.82466 15.5641 6.54707 15.5709C4.36664 15.6242 1.59196 15.692 0.734425 13.4679C-0.0102457 10.2608 3.07575 7.25165 6.17966 6.54064C8.97595 5.84924 12.57 9.73971 13.0242 10.2471C13.0452 10.2705 13.0806 10.2589 13.0721 10.2286V10.2286C12.7617 9.11815 11.9017 6.15103 11.4167 4.75935ZM13.4075 17.2491C11.0869 15.439 12.4616 11.4148 15.4794 11.2917C17.543 11.071 19.4797 12.7182 19.4358 14.7058C19.5802 17.5652 15.551 19.2704 13.4075 17.2491Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/cell-content-video.svg
	var cell_content_video_default = "data:image/svg+xml,<svg width=\"21\" height=\"20\" viewBox=\"0 0 21 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<g clip-path=\"url(%23clip0_5668_226)\">%0A<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M5.86538 15.0302C5.85942 11.025 5.85645 9.02267 5.85645 9.02267C5.92669 8.11899 6.33798 7.72966 7.08987 7.85461C7.55267 8.07083 7.78258 8.55499 7.77918 9.30627C7.9482 11.5092 8.03293 12.6107 8.03293 12.6107C8.18833 13.0854 8.58727 13.0908 9.23013 12.6271C13.2208 8.60003 15.216 6.58629 15.216 6.58629C16.1577 6.05397 16.7572 6.57768 16.4677 7.35402C14.0008 10.1797 12.7674 11.5926 12.7674 11.5926C12.681 11.9557 12.8687 12.0556 13.3294 11.8931C16.4494 9.36739 18.0094 8.10491 18.0094 8.10491C18.9546 7.71597 19.4693 8.34931 18.88 9.15627C16.0986 11.6816 14.708 12.9443 14.708 12.9443C14.5202 13.3643 14.6957 13.5589 15.2342 13.5283C18.0154 11.7262 19.4059 10.8249 19.4059 10.8249C19.7793 10.7873 20.0334 10.8488 20.168 11.0086C20.4034 11.2988 20.4094 11.566 20.1859 11.8096C17.441 13.801 16.0683 14.7967 16.0683 14.7967C15.8125 15.2017 15.9333 15.4047 16.4311 15.4058C18.5837 14.3486 19.66 13.8202 19.66 13.8202C20.0454 13.7278 20.2813 13.7999 20.3673 14.0372C20.4414 14.3118 20.3085 14.5621 19.9683 14.7881C15.5719 17.6447 12.824 19.2276 11.7243 19.5359C9.56613 19.8775 7.85498 19.3154 6.59086 17.8504C6.18469 17.0255 5.94287 16.0854 5.86538 15.0302Z\" fill=\"white\"/>%0A<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M1.33219 9.52342C2.70868 10.7846 3.98426 11.8638 5.15936 12.7608C5.15936 12.7608 5.15936 11.7651 5.15936 9.77366C3.03097 8.68318 1.967 8.1383 1.967 8.1383C1.06694 8.09486 0.855344 8.5567 1.33219 9.52342Z\" fill=\"white\"/>%0A<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M6.95933 7.19512C6.04012 7.16182 5.83447 7.49555 5.83447 7.49555C5.83447 7.49555 5.83617 5.54606 5.84809 1.8637C6.187 0.824912 7.48727 1.07717 7.60776 1.96358C8.0067 5.30127 8.20595 6.9699 8.20595 6.9699C8.6249 7.21002 8.88546 7.15948 8.98765 6.8187C8.93826 2.76969 8.91357 0.745409 8.91357 0.745409C9.25632 -0.262043 10.5642 -0.00430422 10.818 0.995704C10.8422 5.11208 10.8546 7.17009 10.8546 7.17009C11.0982 7.2778 11.334 7.23354 11.5618 7.03651C12.0455 3.82144 12.2873 2.21392 12.2873 2.21392C12.7944 1.36432 13.5778 1.8187 13.7566 2.48106C13.4543 5.78505 13.3032 7.43724 13.3032 7.43724C10.7759 9.9183 9.51224 11.1584 9.51224 11.1584C9.12135 11.5838 8.81267 11.3017 8.76839 11.1086C8.64747 9.22846 8.43758 8.1799 8.43758 8.1799C8.21788 7.57239 7.65844 7.15516 6.95933 7.19512Z\" fill=\"white\"/>%0A</g>%0A<defs>%0A<clipPath id=\"clip0_5668_226\">%0A<rect width=\"20\" height=\"20\" fill=\"white\" transform=\"translate(0.5)\"/>%0A</clipPath>%0A</defs>%0A</svg>%0A";
	//#endregion
	//#region src/table-model.ts
	function assert$2(condition, message) {
		if (!condition) throw new Error(message);
	}
	const warnedBadJSONAttrs = /* @__PURE__ */ new Set();
	function parseJSONAttr(el, name) {
		const s = el.getAttribute(name);
		if (!s) return null;
		try {
			return JSON.parse(s);
		} catch {
			const key = `${name}=${s}`;
			if (!warnedBadJSONAttrs.has(key)) {
				warnedBadJSONAttrs.add(key);
				console.warn(`Invalid JSON in ${name}; ignoring it. Value: ${s}`);
			}
			return null;
		}
	}
	function setJSONAttr(el, name, value) {
		if (value == null) el.removeAttribute(name);
		else el.setAttribute(name, JSON.stringify(value));
	}
	const defaultColumnWidth = "fill";
	const defaultRowHeight = "hug";
	/**
	* THE tokenizer for the two size-list attributes (data-column-widths /
	* data-row-heights). Every reader of those attributes goes through
	* getColumnWidths / getRowHeights, which call this — so the whole codebase
	* agrees on what a malformed attribute means.
	*
	* Positional semantics: the attribute declares one position per comma-separated
	* token, and positions are never dropped. An empty or whitespace-only token
	* (persisted HTML is user-editable, so "100px,,50px" can arrive) means "the
	* default size for that position" and is substituted, keeping the count — a
	* reader that silently dropped it would disagree with every other layer about
	* how many columns/rows the table has, misplacing every cell after it.
	* An entirely empty (or absent) attribute declares zero positions.
	*/
	function parseSizeList(raw, defaultSize) {
		const v = (raw || "").trim();
		if (v === "") return [];
		return v.split(",").map((token) => token.trim() || defaultSize);
	}
	function getColumnWidths(table) {
		assert$2(table.classList.contains("bloom-table"), "getColumnWidths: not a table");
		return parseSizeList(table.getAttribute("data-column-widths"), defaultColumnWidth);
	}
	function setColumnWidths(table, widths) {
		assert$2(table.classList.contains("bloom-table"), "setColumnWidths: not a table");
		table.setAttribute("data-column-widths", widths.join(","));
	}
	function getRowHeights(table) {
		assert$2(table.classList.contains("bloom-table"), "getRowHeights: not a table");
		return parseSizeList(table.getAttribute("data-row-heights"), "hug");
	}
	function setRowHeights(table, heights) {
		assert$2(table.classList.contains("bloom-table"), "setRowHeights: not a table");
		table.setAttribute("data-row-heights", heights.join(","));
	}
	function getSpan(cell) {
		assert$2(cell.classList.contains("bloom-cell"), "getSpan: not a cell");
		const x = parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1;
		const y = parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1;
		return {
			x: Math.max(1, x),
			y: Math.max(1, y)
		};
	}
	function getGapX(table) {
		assert$2(table.classList.contains("bloom-table"), "getGapX: not a table");
		const v = (table.getAttribute("data-gap-x") || "").trim();
		if (!v) return [];
		return v.split(",").map((s) => s.trim());
	}
	function setGapX(table, gaps) {
		assert$2(table.classList.contains("bloom-table"), "setGapX: not a table");
		const v = Array.isArray(gaps) ? gaps.join(",") : gaps;
		table.setAttribute("data-gap-x", v);
	}
	function getGapY(table) {
		assert$2(table.classList.contains("bloom-table"), "getGapY: not a table");
		const v = (table.getAttribute("data-gap-y") || "").trim();
		if (!v) return [];
		return v.split(",").map((s) => s.trim());
	}
	function setGapY(table, gaps) {
		assert$2(table.classList.contains("bloom-table"), "setGapY: not a table");
		const v = Array.isArray(gaps) ? gaps.join(",") : gaps;
		table.setAttribute("data-gap-y", v);
	}
	function getEdgesH(table) {
		assert$2(table.classList.contains("bloom-table"), "getEdgesH: not a table");
		return parseJSONAttr(table, "data-edges-h");
	}
	function setEdgesH(table, edges) {
		assert$2(table.classList.contains("bloom-table"), "setEdgesH: not a table");
		setJSONAttr(table, "data-edges-h", edges);
	}
	function getEdgesV(table) {
		assert$2(table.classList.contains("bloom-table"), "getEdgesV: not a table");
		return parseJSONAttr(table, "data-edges-v");
	}
	function setEdgesV(table, edges) {
		assert$2(table.classList.contains("bloom-table"), "setEdgesV: not a table");
		setJSONAttr(table, "data-edges-v", edges);
	}
	function getEdgeDefault(table) {
		assert$2(table.classList.contains("bloom-table"), "getEdgeDefault: not a table");
		return parseJSONAttr(table, "data-border-default");
	}
	function setEdgeDefault(table, border) {
		assert$2(table.classList.contains("bloom-table"), "setEdgeDefault: not a table");
		setJSONAttr(table, "data-border-default", border);
	}
	function getCellAlign(cell) {
		assert$2(cell.classList.contains("bloom-cell"), "getCellAlign: not a cell");
		const v = cell.getAttribute("data-align");
		return v === "start" || v === "center" || v === "end" ? v : null;
	}
	function setCellAlign(cell, align) {
		assert$2(cell.classList.contains("bloom-cell"), "setCellAlign: not a cell");
		if (!align) cell.removeAttribute("data-align");
		else cell.setAttribute("data-align", align);
	}
	function getCellPadding(cell) {
		assert$2(cell.classList.contains("bloom-cell"), "getCellPadding: not a cell");
		const v = cell.getAttribute("data-pad");
		return v && v.trim() ? v.trim() : null;
	}
	function setCellPadding(cell, padding) {
		assert$2(cell.classList.contains("bloom-cell"), "setCellPadding: not a cell");
		if (!padding || !padding.trim()) cell.removeAttribute("data-pad");
		else cell.setAttribute("data-pad", padding.trim());
	}
	function getTableCorners(table) {
		assert$2(table.classList.contains("bloom-table"), "getTableCorners: not a table");
		return parseJSONAttr(table, "data-corners");
	}
	function setTableCorners(table, corners) {
		assert$2(table.classList.contains("bloom-table"), "setTableCorners: not a table");
		setJSONAttr(table, "data-corners", corners);
	}
	function getCellCorners(cell) {
		assert$2(cell.classList.contains("bloom-cell"), "getCellCorners: not a cell");
		return parseJSONAttr(cell, "data-corners");
	}
	function setCellCorners(cell, corners) {
		assert$2(cell.classList.contains("bloom-cell"), "setCellCorners: not a cell");
		setJSONAttr(cell, "data-corners", corners);
	}
	function getCellBackground(cell) {
		assert$2(cell.classList.contains("bloom-cell"), "getCellBackground: not a cell");
		const v = cell.getAttribute("data-bg");
		return v && v.trim() ? v.trim() : null;
	}
	function setCellBackground(cell, color) {
		assert$2(cell.classList.contains("bloom-cell"), "setCellBackground: not a cell");
		if (!color || !color.trim()) cell.removeAttribute("data-bg");
		else cell.setAttribute("data-bg", color.trim());
	}
	function getTableBackground(table) {
		assert$2(table.classList.contains("bloom-table"), "getTableBackground: not a table");
		const v = table.getAttribute("data-bg");
		return v && v.trim() ? v.trim() : null;
	}
	function setTableBackground(table, color) {
		assert$2(table.classList.contains("bloom-table"), "setTableBackground: not a table");
		if (!color || !color.trim()) table.removeAttribute("data-bg");
		else table.setAttribute("data-bg", color.trim());
	}
	//#endregion
	//#region src/defaults.ts
	/**
	* Default edge (border) spec.
	* IMPORTANT: Keep in sync with CSS variables in src/bloom-table.css:
	*   --edge-default-weight, --edge-default-style, --edge-default-color
	*/
	const EDGE_DEFAULT = {
		weight: 1,
		style: "solid",
		color: "#000"
	};
	//#endregion
	//#region src/edge-entries.ts
	const isBorderSpec = (e) => {
		if (!e || typeof e !== "object") return false;
		const o = e;
		return typeof o.weight === "number" || Object.prototype.hasOwnProperty.call(o, "style") || Object.prototype.hasOwnProperty.call(o, "color");
	};
	const splitV = (e) => {
		if (isBorderSpec(e)) return {
			west: e,
			east: e
		};
		if (e && typeof e === "object") {
			const s = e;
			return {
				west: s.west ?? null,
				east: s.east ?? null
			};
		}
		return {
			west: null,
			east: null
		};
	};
	const splitH = (e) => {
		if (isBorderSpec(e)) return {
			north: e,
			south: e
		};
		if (e && typeof e === "object") {
			const s = e;
			return {
				north: s.north ?? null,
				south: s.south ?? null
			};
		}
		return {
			north: null,
			south: null
		};
	};
	const hasPositiveGap = (tokens, i) => {
		const token = (tokens[Math.min(Math.max(0, i), Math.max(0, (tokens.length || 1) - 1))] || "").trim();
		if (!token) return false;
		const n = parseFloat(token);
		if (!isNaN(n)) return n > 0;
		return token !== "0" && token !== "0px";
	};
	function entryAtV(edgesV, cols, r, c) {
		const row = edgesV && edgesV[r] || void 0;
		if (!row) return void 0;
		if (row.length === cols + 1) return row[c];
		else if (row.length === Math.max(0, cols - 1)) {
			if (c >= 1 && c <= cols - 1) return row[c - 1];
		} else if (row.length === 1 && cols >= 2) {
			if (c === 1) return row[0];
		}
	}
	function entryAtH(edgesH, rows, r, c) {
		if (!edgesH) return void 0;
		if (edgesH.length === rows + 1) return edgesH[r] && edgesH[r][c];
		else if (edgesH.length === Math.max(0, rows - 1)) {
			if (r >= 1 && r <= rows - 1) return edgesH[r - 1] && edgesH[r - 1][c];
		} else if (edgesH.length === 1 && rows >= 2) {
			if (r === 1) return edgesH[0] && edgesH[0][c];
		}
	}
	//#endregion
	//#region src/table-renderer.ts
	const MIN_COLUMN_WIDTH = "60px";
	const MIN_ROW_HEIGHT = "20px";
	function makeSizeRule(size, minimum) {
		const s = (size || "").trim();
		if (s === "hug") return `minmax(${minimum},max-content)`;
		if (s === "fill") return `minmax(${minimum},1fr)`;
		return s;
	}
	/** The number in a "120px" width, or null for any other kind of width. */
	function pixelWidth(size) {
		const match = /^(\d+(?:\.\d+)?)px$/.exec((size || "").trim());
		return match ? parseFloat(match[1]) : null;
	}
	/**
	* The column half of the grid template.
	*
	* No column track may be wider than the space the table itself has: the grid
	* overflows its own box otherwise, and the host clips the right-hand column.
	* Two kinds of track can do that when the container loses space.
	*
	* A "fill" or "hug" column carries a floor of MIN_COLUMN_WIDTH so that a column
	* stays wide enough to use, and N of them need N * 60px. Where the table has
	* less than that, the floor drops to an equal share of what there is, so the
	* columns divide the table between them instead of overflowing it.
	*
	* A column given a width in pixels keeps that width while it fits. Past that,
	* every pixel column shrinks by the same proportion, so the relative widths a
	* person set by dragging boundaries survive a container that has lost space.
	* The alternative, dropping such a column back to "fill", would throw those
	* widths away.
	*
	* Both rules are written as CSS min() against the table's own width, so the
	* table re-fits whenever its container changes, with nothing to observe and
	* nothing to recompute.
	*/
	function buildColumnTemplate(widths, nested) {
		const pixels = widths.map(pixelWidth);
		const totalPixels = pixels.reduce((sum, px) => sum + (px ?? 0), 0);
		const minimum = nested ? "0" : `min(${MIN_COLUMN_WIDTH},calc(100% / ${widths.length}))`;
		return widths.map((width, index) => {
			const px = pixels[index];
			if (px === null) return makeSizeRule(width, minimum);
			if (nested || totalPixels <= 0) return width.trim();
			return `min(${width.trim()},calc(100% * ${px} / ${totalPixels}))`;
		}).join(" ");
	}
	function getCells(table) {
		const result = [];
		Array.from(table.children).forEach((child) => {
			if (child instanceof HTMLElement && child.classList.contains("bloom-cell")) result.push(child);
		});
		return result;
	}
	function normalize(spec) {
		if (!spec) return null;
		if (spec.style === "none") return {
			weight: 0,
			style: "none",
			color: spec.color || "#000"
		};
		if (!(Object.prototype.hasOwnProperty.call(spec, "weight") || Object.prototype.hasOwnProperty.call(spec, "style") || Object.prototype.hasOwnProperty.call(spec, "color"))) return null;
		const weight = Number.isFinite(spec.weight) ? spec.weight : 1;
		const style = spec.style || "solid";
		const color = spec.color || "#000";
		if (style === "none" || weight <= 0) return {
			weight: 0,
			style: "none",
			color
		};
		return {
			weight,
			style,
			color
		};
	}
	function stylePrecedence(style) {
		switch (style) {
			case "double": return 4;
			case "solid": return 3;
			case "dashed": return 2;
			case "dotted": return 1;
			default: return 0;
		}
	}
	function resolveEdgeDefault(table) {
		const authored = normalize(getEdgeDefault(table));
		if (authored) return authored;
		const cs = getComputedStyle(table);
		let wRaw = cs.getPropertyValue("--edge-default-weight").trim();
		let sRaw = cs.getPropertyValue("--edge-default-style").trim();
		let cRaw = cs.getPropertyValue("--edge-default-color").trim();
		if (!wRaw) wRaw = table.style.getPropertyValue("--edge-default-weight").trim();
		if (!sRaw) sRaw = table.style.getPropertyValue("--edge-default-style").trim();
		if (!cRaw) cRaw = table.style.getPropertyValue("--edge-default-color").trim();
		if (wRaw || sRaw || cRaw) {
			const w = wRaw ? parseFloat(wRaw) : EDGE_DEFAULT.weight;
			const s = sRaw || EDGE_DEFAULT.style;
			const c = cRaw || EDGE_DEFAULT.color;
			return normalize({
				weight: isFinite(w) ? w : EDGE_DEFAULT.weight,
				style: s,
				color: c
			});
		}
		return normalize({ ...EDGE_DEFAULT });
	}
	function isNestedTable$1(table) {
		return !!(table.parentElement && table.parentElement.classList && table.parentElement.classList.contains("bloom-cell"));
	}
	function buildRenderModel(table) {
		const columnWidths = getColumnWidths(table);
		const rowHeights = getRowHeights(table);
		const nestedSizing = isNestedTable$1(table);
		const minRow = nestedSizing ? "0" : MIN_ROW_HEIGHT;
		const templateColumns = buildColumnTemplate(columnWidths, nestedSizing);
		const templateRows = rowHeights.map((x) => makeSizeRule(x, minRow)).join(" ");
		const cells = getCells(table);
		const spans = cells.map((cell, index) => {
			const x = parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1;
			const y = parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1;
			return {
				index,
				x: Math.max(1, x),
				y: Math.max(1, y)
			};
		});
		const cellBorders = cells.map(() => ({
			top: null,
			right: null,
			bottom: null,
			left: null
		}));
		const rows = rowHeights.length;
		const cols = columnWidths.length;
		const nested = isNestedTable$1(table);
		function idx(r, c) {
			return r * cols + c;
		}
		const coverOf = [];
		for (let i = 0; i < rows * cols; i++) coverOf[i] = i;
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
			const i = idx(r, c);
			const cell = cells[i];
			if (!cell || cell.classList.contains("bloom-skip")) continue;
			const sx = spans[i] ? spans[i].x : 1;
			const sy = spans[i] ? spans[i].y : 1;
			if (sx === 1 && sy === 1) continue;
			for (let dr = 0; dr < sy && r + dr < rows; dr++) for (let dc = 0; dc < sx && c + dc < cols; dc++) coverOf[idx(r + dr, c + dc)] = i;
		}
		const rowOf = (i) => Math.floor(i / cols);
		const colOf = (i) => i % cols;
		function writeVSide(pos, side, spec) {
			const t = coverOf[pos];
			if (!cells[t]) return;
			if (rowOf(pos) !== rowOf(t)) return;
			cellBorders[t][side] = spec;
		}
		function writeHSide(pos, side, spec) {
			const t = coverOf[pos];
			if (!cells[t]) return;
			if (colOf(pos) !== colOf(t)) return;
			cellBorders[t][side] = spec;
		}
		const edgesH = getEdgesH(table);
		const edgesV = getEdgesV(table);
		const edgeDefault = resolveEdgeDefault(table);
		const gapX = getGapX(table);
		const gapY = getGapY(table);
		const hasPositiveGapX = (c) => hasPositiveGap(gapX, c);
		const hasPositiveGapY = (r) => hasPositiveGap(gapY, r);
		function borderScore(spec) {
			const s = spec && spec.style ? spec.style : "none";
			const w = spec && Number.isFinite(spec.weight) ? spec.weight : 0;
			return [
				s !== "none" && w > 0 ? 1 : 0,
				w,
				stylePrecedence(s)
			];
		}
		function pickSide(a, b, tieFavor) {
			const aPresent = !!a;
			const bPresent = !!b;
			if (aPresent && !bPresent) return "a";
			if (!aPresent && bPresent) return "b";
			if (!aPresent && !bPresent) return null;
			const sa = borderScore(a);
			const sb = borderScore(b);
			if (sa[0] !== sb[0]) return sa[0] > sb[0] ? "a" : "b";
			if (sa[1] !== sb[1]) return sa[1] > sb[1] ? "a" : "b";
			if (sa[2] !== sb[2]) return sa[2] > sb[2] ? "a" : "b";
			return tieFavor === "leftTop" ? "a" : "b";
		}
		function readV(r, c) {
			const s = splitV(entryAtV(edgesV, cols, r, c));
			return {
				west: normalize(s.west),
				east: normalize(s.east)
			};
		}
		function readH(r, c) {
			const s = splitH(entryAtH(edgesH, rows, r, c));
			return {
				north: normalize(s.north),
				south: normalize(s.south)
			};
		}
		function paintedSpec(spec) {
			return !!spec && spec.style !== "none" && spec.weight > 0;
		}
		function radiusAt(pos) {
			const cell = cells[coverOf[pos]];
			if (!cell) return 0;
			const cc = getCellCorners(cell);
			const r = cc && Number.isFinite(cc.radius) ? cc.radius : 0;
			return r > 0 ? r : 0;
		}
		function hSidePainted(r, c, which) {
			const b = which === "top" ? r : r + 1;
			const { north, south } = readH(b, c);
			const facing = which === "top" ? south : north;
			if (b === 0 || b === rows) return paintedSpec(facing ?? (nested ? null : edgeDefault));
			if (hasPositiveGapY(b - 1)) return paintedSpec(facing ?? edgeDefault);
			return paintedSpec(((pickSide(north || null, south || null, "leftTop") ?? "a") === "a" ? north : south) ?? edgeDefault);
		}
		function vSidePainted(r, c, which) {
			const b = which === "left" ? c : c + 1;
			const { west, east } = readV(r, b);
			const facing = which === "left" ? east : west;
			if (b === 0 || b === cols) return paintedSpec(facing ?? (nested ? null : edgeDefault));
			if (hasPositiveGapX(b - 1)) return paintedSpec(facing ?? edgeDefault);
			return paintedSpec(((pickSide(west || null, east || null, "leftTop") ?? "a") === "a" ? west : east) ?? edgeDefault);
		}
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
			const iLeft = idx(r, c);
			const iRight = idx(r, c + 1);
			if (!cells[iLeft] || !cells[iRight]) continue;
			if (coverOf[iLeft] === coverOf[iRight]) continue;
			const { west, east } = readV(r, c + 1);
			if (hasPositiveGapX(c)) {
				writeVSide(iLeft, "right", (west ?? edgeDefault) || null);
				writeVSide(iRight, "left", (east ?? edgeDefault) || null);
			} else {
				const a = west || null;
				const b = east || null;
				if (radiusAt(iLeft) > 0 || radiusAt(iRight) > 0) {
					writeVSide(iLeft, "right", (west ?? edgeDefault) || null);
					writeVSide(iRight, "left", (east ?? edgeDefault) || null);
					continue;
				}
				const scoreLeft = (hSidePainted(r, c, "top") ? 1 : 0) + (hSidePainted(r, c, "bottom") ? 1 : 0);
				const tieFavor = (hSidePainted(r, c + 1, "top") ? 1 : 0) + (hSidePainted(r, c + 1, "bottom") ? 1 : 0) > scoreLeft ? "rightBottom" : "leftTop";
				let side = pickSide(a, b, tieFavor);
				if (!side && edgeDefault) side = tieFavor === "rightBottom" ? "b" : "a";
				if (!side) continue;
				const winner = side === "a" ? a || edgeDefault : b || edgeDefault;
				if (!winner) continue;
				if (side === "a") {
					writeVSide(iLeft, "right", winner);
					writeVSide(iRight, "left", b && b.style === "none" ? b : null);
				} else {
					writeVSide(iRight, "left", winner);
					writeVSide(iLeft, "right", a && a.style === "none" ? a : null);
				}
			}
		}
		for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
			const iTop = idx(r, c);
			const iBottom = idx(r + 1, c);
			if (!cells[iTop] || !cells[iBottom]) continue;
			if (coverOf[iTop] === coverOf[iBottom]) continue;
			const { north, south } = readH(r + 1, c);
			if (hasPositiveGapY(r)) {
				writeHSide(iTop, "bottom", (north ?? edgeDefault) || null);
				writeHSide(iBottom, "top", (south ?? edgeDefault) || null);
			} else {
				const a = north || null;
				const b = south || null;
				if (radiusAt(iTop) > 0 || radiusAt(iBottom) > 0) {
					writeHSide(iTop, "bottom", (north ?? edgeDefault) || null);
					writeHSide(iBottom, "top", (south ?? edgeDefault) || null);
					continue;
				}
				const scoreTop = (vSidePainted(r, c, "left") ? 1 : 0) + (vSidePainted(r, c, "right") ? 1 : 0);
				const tieFavor = (vSidePainted(r + 1, c, "left") ? 1 : 0) + (vSidePainted(r + 1, c, "right") ? 1 : 0) > scoreTop ? "rightBottom" : "leftTop";
				let side = pickSide(a, b, tieFavor);
				if (!side && edgeDefault) side = tieFavor === "rightBottom" ? "b" : "a";
				if (!side) continue;
				const winner = side === "a" ? a || edgeDefault : b || edgeDefault;
				if (!winner) continue;
				if (side === "a") {
					writeHSide(iTop, "bottom", winner);
					writeHSide(iBottom, "top", b && b.style === "none" ? b : null);
				} else {
					writeHSide(iBottom, "top", winner);
					writeHSide(iTop, "bottom", a && a.style === "none" ? a : null);
				}
			}
		}
		{
			const fallback = nested ? null : edgeDefault ?? null;
			for (let c = 0; c < cols; c++) {
				const { south } = readH(0, c);
				writeHSide(idx(0, c), "top", south ?? fallback);
			}
			for (let c = 0; c < cols; c++) {
				const { north } = readH(rows, c);
				writeHSide(idx(Math.max(0, rows - 1), c), "bottom", north ?? fallback);
			}
			for (let r = 0; r < rows; r++) {
				const { east } = readV(r, 0);
				writeVSide(idx(r, 0), "left", east ?? fallback);
			}
			for (let r = 0; r < rows; r++) {
				const { west } = readV(r, cols);
				writeVSide(idx(r, Math.max(0, cols - 1)), "right", west ?? fallback);
			}
		}
		return {
			columnWidths,
			rowHeights,
			templateColumns,
			templateRows,
			spans,
			cellBorders
		};
	}
	function render(table) {
		const model = buildRenderModel(table);
		if (model.templateColumns) {
			table.style.gridTemplateColumns = model.templateColumns;
			table.style.setProperty("--table-column-count", String(model.columnWidths.length));
		}
		if (model.templateRows) {
			table.style.gridTemplateRows = model.templateRows;
			table.style.setProperty("--table-row-count", String(model.rowHeights.length));
		}
		const firstGap = (tokens) => {
			for (const t of tokens) {
				const s = (t || "").trim();
				if (s && s !== "0" && s !== "0px") return s;
			}
			return null;
		};
		const colGap = firstGap(getGapX(table));
		const rowGap = firstGap(getGapY(table));
		if (colGap) table.style.columnGap = colGap;
		else table.style.removeProperty("column-gap");
		if (rowGap) table.style.rowGap = rowGap;
		else table.style.removeProperty("row-gap");
		const cells = getCells(table);
		model.spans.forEach((s) => {
			const cell = cells[s.index];
			if (!cell) return;
			cell.style.setProperty("--span-x", String(s.x));
			cell.style.setProperty("--span-y", String(s.y));
		});
		function applyBorderSide(cell, side, spec) {
			if (spec) {
				const style = spec.style;
				const rawW = Number.isFinite(spec.weight) ? spec.weight : 0;
				const effectiveW = style === "double" && rawW > 0 && rawW < 4 ? 4 : rawW;
				cell.style[`border${side}Width`] = `${effectiveW}px`;
				cell.style[`border${side}Style`] = style;
				cell.style[`border${side}Color`] = spec.color;
			} else {
				cell.style[`border${side}Width`] = "0";
				cell.style[`border${side}Style`] = "none";
			}
		}
		cells.forEach((cell, i) => {
			const b = model.cellBorders[i] ?? {};
			applyBorderSide(cell, "Top", b.top);
			applyBorderSide(cell, "Right", b.right);
			applyBorderSide(cell, "Bottom", b.bottom);
			applyBorderSide(cell, "Left", b.left);
		});
		const ALIGN_JUSTIFY = {
			start: "flex-start",
			center: "center",
			end: "flex-end"
		};
		const ALIGN_TEXT = {
			start: "left",
			center: "center",
			end: "right"
		};
		cells.forEach((cell) => {
			const a = cell.getAttribute("data-align") || "";
			if (ALIGN_JUSTIFY[a]) {
				cell.style.justifyContent = ALIGN_JUSTIFY[a];
				cell.style.textAlign = ALIGN_TEXT[a];
			} else {
				cell.style.removeProperty("justify-content");
				cell.style.removeProperty("text-align");
			}
		});
		cells.forEach((cell) => {
			const pad = cell.getAttribute("data-pad");
			if (pad && pad.trim()) cell.style.padding = pad.trim();
			else cell.style.removeProperty("padding");
		});
		cells.forEach((cell) => {
			const bg = cell.getAttribute("data-bg");
			if (bg && bg.trim()) cell.style.setProperty("--this-bg", bg.trim());
			else cell.style.removeProperty("--this-bg");
		});
		const tableBg = table.getAttribute("data-bg");
		if (tableBg && tableBg.trim()) table.style.setProperty("--bg", tableBg.trim());
		else table.style.removeProperty("--bg");
		const corners = getTableCorners(table) ?? { radius: 0 };
		if (Number.isFinite(corners.radius)) {
			const radiusPx = `${corners.radius}px`;
			table.style.borderRadius = radiusPx;
			const rows = model.rowHeights.length;
			const cols = model.columnWidths.length;
			const cellsArr = getCells(table);
			cellsArr.forEach((cell) => {
				cell.style.borderTopLeftRadius = "0px";
				cell.style.borderTopRightRadius = "0px";
				cell.style.borderBottomLeftRadius = "0px";
				cell.style.borderBottomRightRadius = "0px";
			});
			const idx = (r, c) => r * cols + c;
			function setCorner(r, c, prop) {
				if (r < 0 || c < 0 || r >= rows || c >= cols) return;
				const cell = cellsArr[idx(r, c)];
				if (!cell) return;
				cell.style[prop] = radiusPx;
			}
			setCorner(0, 0, "borderTopLeftRadius");
			setCorner(0, Math.max(0, cols - 1), "borderTopRightRadius");
			setCorner(Math.max(0, rows - 1), 0, "borderBottomLeftRadius");
			setCorner(Math.max(0, rows - 1), Math.max(0, cols - 1), "borderBottomRightRadius");
		}
		getCells(table).forEach((cell) => {
			const cc = getCellCorners(cell);
			if (cc && Number.isFinite(cc.radius)) {
				const r = `${cc.radius}px`;
				cell.style.borderTopLeftRadius = r;
				cell.style.borderTopRightRadius = r;
				cell.style.borderBottomLeftRadius = r;
				cell.style.borderBottomRightRadius = r;
			}
		});
	}
	//#endregion
	//#region src/drag-to-resize.ts
	const PX_PER_IN = 96;
	const MM_PER_IN = 25.4;
	const PX_TO_MM = MM_PER_IN / PX_PER_IN;
	const MM_TO_PX = PX_PER_IN / MM_PER_IN;
	function parseSizeToPx(size) {
		const s = (size || "").trim();
		const mm = s.match(/^([0-9.]+)mm$/i);
		if (mm) return parseFloat(mm[1]) * MM_TO_PX;
		const px = s.match(/^([0-9.]+)px$/i);
		if (px) return parseFloat(px[1]);
		return null;
	}
	function formatMm(px) {
		return `${(px * PX_TO_MM).toFixed(1)}mm`;
	}
	var DragToResize = class {
		constructor() {
			this.attachedTables = /* @__PURE__ */ new Set();
			this.cursorStyledElement = null;
			this.dragState = {
				isDragging: false,
				dragType: null,
				targetElement: null,
				targetIndex: -1,
				startX: 0,
				startY: 0,
				originalValue: "",
				hasStartedOperation: false,
				baseDimension: void 0
			};
			this.updateCursorOnMouseMove = (event) => {
				if (this.dragState.isDragging) return;
				const target = event.target;
				const resizeInfo = this.getResizeInfo(target, event);
				if (resizeInfo) this.setHoverCursor(target, resizeInfo.type === "row" ? "ns-resize" : "ew-resize");
				else this.setHoverCursor(null, null);
			};
			this.handleMouseDown = (event) => {
				const target = event.target;
				const resizeInfo = this.getResizeInfo(target, event);
				if (resizeInfo) {
					event.preventDefault();
					event.stopPropagation();
					this.startResize(resizeInfo, event);
				}
			};
			this.handleMouseLeave = (event) => {
				this.setHoverCursor(null, null);
				event.target.style.removeProperty("cursor");
			};
			this.handleGlobalMouseMove = (event) => {
				if (!this.dragState.isDragging || !this.dragState.targetElement) return;
				event.preventDefault();
				if (!this.dragState.hasStartedOperation) {
					const deltaX = Math.abs(event.clientX - this.dragState.startX);
					const deltaY = Math.abs(event.clientY - this.dragState.startY);
					if (deltaX > 3 || deltaY > 3) this.dragState.hasStartedOperation = true;
				}
				const deltaX = event.clientX - this.dragState.startX;
				const deltaY = event.clientY - this.dragState.startY;
				if (this.dragState.dragType === "column") {
					let effectiveDeltaX = deltaX;
					const table = this.dragState.targetElement;
					if (table.parentElement) {
						const parentStyle = window.getComputedStyle(table.parentElement);
						if (parentStyle.display === "flex" && parentStyle.justifyContent === "center") effectiveDeltaX *= 2;
					}
					this.updateColumnWidthPreview(this.dragState.targetElement, effectiveDeltaX);
				} else if (this.dragState.dragType === "row") this.updateRowHeightPreview(this.dragState.targetElement, deltaY);
			};
			this.handleGlobalMouseUp = () => {
				if (this.dragState.isDragging && this.dragState.hasStartedOperation) this.commitResizeOperation();
				this.cancelDrag();
			};
			this.handleDoubleClick = (event) => {
				const target = event.target;
				const resizeInfo = this.getResizeInfo(target, event);
				if (resizeInfo && resizeInfo.type === "row") {
					event.preventDefault();
					event.stopPropagation();
					const tableElement = resizeInfo.element;
					const rowIndex = resizeInfo.index;
					const rowHeights = (tableElement.getAttribute("data-row-heights") || "").split(",");
					const currentHeight = rowIndex < rowHeights.length ? rowHeights[rowIndex] : "hug";
					const description = {
						label: "Auto-size Row",
						detail: `row ${rowIndex + 1} to hug its contents`
					};
					const performOperation = () => {
						const rowHeights = (tableElement.getAttribute("data-row-heights") || "").split(",");
						if (rowIndex >= 0 && rowIndex < rowHeights.length) {
							rowHeights[rowIndex] = "hug";
							tableElement.setAttribute("data-row-heights", rowHeights.join(","));
						}
						render(tableElement);
					};
					const undoOperation = (tableElement) => {
						const rowHeights = (tableElement.getAttribute("data-row-heights") || "").split(",");
						if (rowIndex >= 0 && rowIndex < rowHeights.length) {
							rowHeights[rowIndex] = currentHeight;
							tableElement.setAttribute("data-row-heights", rowHeights.join(","));
						}
						render(tableElement);
					};
					tableHistoryManager.addHistoryEntry(tableElement, description, performOperation, undoOperation);
				} else if (resizeInfo && resizeInfo.type === "column") {
					event.preventDefault();
					event.stopPropagation();
					const table = resizeInfo.element;
					if (!table) {
						console.warn("HandleDoubleClick: Could not find parent table.");
						return;
					}
					const columnIndex = resizeInfo.index;
					const widthArray = (table.getAttribute("data-column-widths") || "").split(",");
					const currentWidth = columnIndex < widthArray.length ? widthArray[columnIndex] : "hug";
					const description = {
						label: "Auto-size Column",
						detail: `column ${columnIndex + 1} to hug its contents`
					};
					const performOperation = () => {
						setColumnWidth(table, columnIndex, "hug");
						render(table);
					};
					const undoOperation = (tableElement) => {
						const widthArray = (tableElement.getAttribute("data-column-widths") || "").split(",");
						if (columnIndex >= 0 && columnIndex < widthArray.length) {
							widthArray[columnIndex] = currentWidth;
							tableElement.setAttribute("data-column-widths", widthArray.join(","));
						}
						render(tableElement);
					};
					tableHistoryManager.addHistoryEntry(table, description, performOperation, undoOperation);
				}
			};
		}
		/**
		* Attach interactive UI handlers to a table element and register with table-history
		*/
		attach(div) {
			if (this.attachedTables.has(div)) return;
			this.attachedTables.add(div);
			div.addEventListener("mousemove", this.updateCursorOnMouseMove);
			div.addEventListener("mousedown", this.handleMouseDown);
			div.addEventListener("dblclick", this.handleDoubleClick);
			div.addEventListener("mouseleave", this.handleMouseLeave);
			document.addEventListener("mousemove", this.handleGlobalMouseMove);
			document.addEventListener("mouseup", this.handleGlobalMouseUp);
		}
		/**
		* Detach interactive UI handlers from a table element and unregister from table-history
		*/
		detach(div) {
			if (!this.attachedTables.has(div)) return;
			this.attachedTables.delete(div);
			tableHistoryManager.detachTable(div);
			div.removeEventListener("mousemove", this.updateCursorOnMouseMove);
			div.removeEventListener("mousedown", this.handleMouseDown);
			div.removeEventListener("dblclick", this.handleDoubleClick);
			div.removeEventListener("mouseleave", this.handleMouseLeave);
			if (this.dragState.isDragging && (this.dragState.targetElement === div || div.contains(this.dragState.targetElement) || this.attachedTables.size === 0)) this.cancelDrag();
			if (this.attachedTables.size === 0) {
				document.removeEventListener("mousemove", this.handleGlobalMouseMove);
				document.removeEventListener("mouseup", this.handleGlobalMouseUp);
			}
		}
		/**
		* Which resize a press at this point would begin, or null for none.
		*
		* The two methods here are for a host that gets the press before the table
		* does, and whose own layer may be painted over the table so that the press
		* never reaches it at all: Bloom listens on an ancestor in the capture phase,
		* and its Comical canvas covers the table. Such a host asks this on each
		* mouse move to show the resize cursor, and calls beginResizeAtPoint on a
		* press. They work from the point rather than the event's target, since the
		* target is whatever the host has painted on top.
		*/
		resizeEdgeAtPoint(event) {
			const resizeInfo = this.getResizeInfoAtPoint(event);
			return resizeInfo ? resizeInfo.type : null;
		}
		/**
		* Begin a row or column resize at this point, as a press on the table itself
		* would; the document-level handlers here carry it through. Answers whether a
		* resize began, so the host can leave the press alone when it did not.
		*/
		beginResizeAtPoint(event) {
			const resizeInfo = this.getResizeInfoAtPoint(event);
			if (!resizeInfo) return false;
			this.startResize(resizeInfo, event);
			return true;
		}
		getResizeInfoAtPoint(event) {
			if (this.attachedTables.size === 0) return null;
			const target = event.target;
			const cell = target?.closest?.(".bloom-cell") ?? (target?.ownerDocument ?? document).elementsFromPoint(event.clientX, event.clientY).find((element) => element.classList.contains("bloom-cell"));
			if (!cell) return null;
			return this.getResizeInfo(cell, event);
		}
		/**
		* Put a resize cursor on one element, clearing whatever element we last put
		* one on. Pass (null, null) to clear without setting a new one, so elements
		* we merely passed over do not keep an inline cursor style (which would
		* otherwise end up in saved content).
		*/
		setHoverCursor(element, cursor) {
			if (this.cursorStyledElement && this.cursorStyledElement !== element) {
				this.cursorStyledElement.style.removeProperty("cursor");
				this.cursorStyledElement = null;
			}
			if (!element) return;
			if (cursor) {
				element.style.cursor = cursor;
				this.cursorStyledElement = element;
			} else {
				element.style.removeProperty("cursor");
				this.cursorStyledElement = null;
			}
		}
		startResize(resizeInfo, event) {
			if (resizeInfo.type === "column") document.body.style.cursor = "ew-resize";
			else if (resizeInfo.type === "row") {
				document.body.style.cursor = "ns-resize";
				try {
					resizeInfo.element.setAttribute("data-ui-active-row-index", String(resizeInfo.index));
				} catch {}
			}
			this.dragState = {
				isDragging: true,
				dragType: resizeInfo.type,
				targetElement: resizeInfo.element,
				targetIndex: resizeInfo.index,
				startX: event.clientX,
				startY: event.clientY,
				originalValue: resizeInfo.currentValue,
				hasStartedOperation: false,
				baseDimension: parseSizeToPx(resizeInfo.currentValue) === null ? resizeInfo.type === "column" ? this.getCurrentColumnWidth(resizeInfo.element, resizeInfo.index) : this.getCurrentRowHeight(resizeInfo.element, resizeInfo.index) : void 0
			};
		}
		/**
		* End the current drag without committing: clear the active-row marker, drop
		* the drag state and release the latched body cursor.
		*/
		cancelDrag() {
			try {
				if (this.dragState.dragType === "row" && this.dragState.targetElement) this.dragState.targetElement.removeAttribute("data-ui-active-row-index");
			} catch {}
			this.resetDragState();
			this.setHoverCursor(null, null);
			document.body.style.cursor = "default";
		}
		commitResizeOperation() {
			if (!this.dragState.targetElement || !this.dragState.dragType) return;
			const table = this.dragState.dragType === "column" ? this.dragState.targetElement : this.findParentTable(this.dragState.targetElement, false);
			if (!table) {
				console.warn("CommitResizeOperation: Could not find parent table.");
				return;
			}
			const operationType = this.dragState.dragType;
			const targetElement = this.dragState.targetElement;
			const capturedOriginalValue = this.dragState.originalValue;
			const capturedTargetIndex = this.dragState.targetIndex;
			let description;
			let performOperation;
			let undoOperation;
			if (operationType === "column") {
				const newWidth = this.calculateFinalColumnWidth(targetElement);
				description = {
					label: "Resize Column",
					detail: `column ${capturedTargetIndex + 1} to ${newWidth}`
				};
				performOperation = () => {
					const widthArray = (targetElement.getAttribute("data-column-widths") || "").split(",");
					if (capturedTargetIndex >= 0 && capturedTargetIndex < widthArray.length) {
						widthArray[capturedTargetIndex] = newWidth;
						targetElement.setAttribute("data-column-widths", widthArray.join(","));
					}
				};
				undoOperation = (tableElement) => {
					const columnWidthsArray = (tableElement.getAttribute("data-column-widths") || "").split(",");
					if (capturedTargetIndex >= 0 && capturedTargetIndex < columnWidthsArray.length) columnWidthsArray[capturedTargetIndex] = capturedOriginalValue;
					tableElement.setAttribute("data-column-widths", columnWidthsArray.join(","));
					render(tableElement);
				};
			} else if (operationType === "row") {
				const newHeight = (targetElement.getAttribute("data-row-heights") || "").split(",")[capturedTargetIndex] || "hug";
				description = {
					label: "Resize Row",
					detail: `row ${capturedTargetIndex + 1} to ${newHeight}`
				};
				performOperation = () => {};
				undoOperation = (tableElement) => {
					const rowHeights = (tableElement.getAttribute("data-row-heights") || "").split(",");
					if (capturedTargetIndex >= 0 && capturedTargetIndex < rowHeights.length) {
						rowHeights[capturedTargetIndex] = capturedOriginalValue;
						tableElement.setAttribute("data-row-heights", rowHeights.join(","));
					}
					render(tableElement);
				};
			} else throw new Error(`Unsupported drag type: ${this.dragState.dragType}. Expected 'row' or 'column'.`);
			tableHistoryManager.addHistoryEntry(table, description, performOperation, undoOperation);
		}
		calculateFinalColumnWidth(table) {
			const widthArray = (table.getAttribute("data-column-widths") || "").split(",");
			if (this.dragState.targetIndex < widthArray.length) return widthArray[this.dragState.targetIndex];
			return "hug";
		}
		updateColumnWidthPreview(table, deltaX) {
			const widthArray = (table.getAttribute("data-column-widths") || "").split(",");
			const baseWidth = parseSizeToPx(this.dragState.originalValue) ?? this.dragState.baseDimension ?? this.getCurrentColumnWidth(table, this.dragState.targetIndex);
			const newWidth = Math.max(50, baseWidth + deltaX);
			if (this.dragState.targetIndex < widthArray.length) {
				widthArray[this.dragState.targetIndex] = `${newWidth}px`;
				table.setAttribute("data-column-widths", widthArray.join(","));
				render(table);
			}
		}
		updateRowHeightPreview(table, deltaY) {
			const baseHeight = parseSizeToPx(this.dragState.originalValue) ?? this.dragState.baseDimension ?? this.getCurrentRowHeight(table, this.dragState.targetIndex);
			const newHeightPx = Math.max(20, baseHeight + deltaY);
			const currentRowHeights = table.getAttribute("data-row-heights") || "";
			let rowHeights = currentRowHeights ? currentRowHeights.split(",") : [];
			try {
				const needed = getTableInfo(table).rowCount;
				if (rowHeights.length < needed) rowHeights = rowHeights.concat(Array(needed - rowHeights.length).fill("hug"));
			} catch {}
			if (this.dragState.targetIndex >= 0 && this.dragState.targetIndex < rowHeights.length) {
				rowHeights[this.dragState.targetIndex] = formatMm(newHeightPx);
				table.setAttribute("data-row-heights", rowHeights.join(","));
				render(table);
			}
		}
		resetDragState() {
			this.dragState = {
				isDragging: false,
				dragType: null,
				targetElement: null,
				targetIndex: -1,
				startX: 0,
				startY: 0,
				originalValue: "",
				hasStartedOperation: false,
				baseDimension: void 0
			};
		}
		getResizeInfo(target, event) {
			const cell = target.closest(".bloom-cell");
			if (!cell) return null;
			const table = cell.closest(".bloom-table");
			if (!table) throw new Error("getResizeInfo: Could not find parent table.");
			const rect = cell.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;
			const spanX = Math.max(1, parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1);
			const spanY = Math.max(1, parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1);
			const edgeThreshold = 5;
			if (y >= rect.height - edgeThreshold && y <= rect.height) {
				const { row: startRow } = getRowAndColumn(table, cell);
				const rowIndex = startRow + spanY - 1;
				if (rowIndex >= 0) {
					const rowHeights = (table.getAttribute("data-row-heights") || "").split(",");
					return {
						type: "row",
						element: table,
						currentValue: rowIndex < rowHeights.length ? rowHeights[rowIndex] : "hug",
						index: rowIndex
					};
				}
			}
			if (x >= rect.width - edgeThreshold && x <= rect.width) {
				const { column: startColumn } = getRowAndColumn(table, cell);
				const columnIndex = startColumn + spanX - 1;
				const widthArray = (table.getAttribute("data-column-widths") || "").split(",");
				if (columnIndex < widthArray.length) return {
					type: "column",
					element: table,
					currentValue: widthArray[columnIndex] || "hug",
					index: columnIndex
				};
			}
			return null;
		}
		findParentTable(row, _verbose) {
			return row.closest(".bloom-table") || null;
		}
		getCurrentColumnWidth(table, columnIndex) {
			table.offsetHeight;
			const tableInfo = getTableInfo(table);
			if (tableInfo.rowCount > 0 && columnIndex < tableInfo.columnCount) try {
				const cells = getTableCells(table);
				const targetCellIndex = columnIndex;
				if (targetCellIndex < cells.length) return cells[targetCellIndex].getBoundingClientRect().width;
			} catch (error) {
				console.warn("Could not get cell width, falling back to computed style");
			}
			const gridTemplateColumns = window.getComputedStyle(table).gridTemplateColumns;
			if (gridTemplateColumns && gridTemplateColumns !== "none") {
				const columnWidths = gridTemplateColumns.split(" ");
				if (columnIndex < columnWidths.length) {
					const match = columnWidths[columnIndex].match(/([0-9.]+)px/);
					if (match) return parseFloat(match[1]);
				}
			}
			return 100;
		}
		getCurrentRowHeight(table, rowIndex) {
			table.offsetHeight;
			const tableInfo = getTableInfo(table);
			if (tableInfo.rowCount > rowIndex && tableInfo.columnCount > 0) try {
				const cells = getTableCells(table);
				const targetCellIndex = rowIndex * tableInfo.columnCount;
				if (targetCellIndex < cells.length) return cells[targetCellIndex].getBoundingClientRect().height;
			} catch (error) {
				console.warn("Could not get cell height, falling back to computed style");
			}
			const gridTemplateRows = window.getComputedStyle(table).gridTemplateRows;
			if (gridTemplateRows && gridTemplateRows !== "none") {
				const rowHeights = gridTemplateRows.split(" ");
				if (rowIndex < rowHeights.length) {
					const match = rowHeights[rowIndex].match(/([0-9.]+)px/);
					if (match) return parseFloat(match[1]);
				}
			}
			return 30;
		}
	};
	const dragToResize = new DragToResize();
	//#endregion
	//#region src/migrate.ts
	function migrateTable(tableDiv) {
		if (!tableDiv) throw new Error("Table element is required");
		tableDiv.querySelectorAll("div.bloom-cell").forEach((cell) => {
			const firstChild = cell.firstElementChild;
			if (firstChild && firstChild.classList.contains("bloom-table")) cell.setAttribute("tabindex", "-1");
		});
	}
	//#endregion
	//#region src/text-editing.ts
	const attachedTables = /* @__PURE__ */ new WeakMap();
	function isEditableTarget(target) {
		const element = target;
		if (!element || element.nodeType !== 1) return false;
		if (element.isContentEditable === true) return true;
		let node = element;
		while (node) {
			const attribute = node.getAttribute?.("contenteditable");
			if (attribute !== null && attribute !== void 0) return attribute !== "false";
			node = node.parentElement;
		}
		return false;
	}
	function attachTextEditing(tableDiv) {
		if (!tableDiv) throw new Error("Table element is required");
		if (attachedTables.has(tableDiv)) return;
		const handler = (event) => {
			if (event.key !== "Enter") return;
			if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
			if (!isEditableTarget(event.target)) return;
			const nearestTable = event.target.closest(".bloom-table");
			if (nearestTable && nearestTable !== tableDiv && attachedTables.has(nearestTable)) return;
			const selection = window.getSelection();
			if (!selection) return;
			if (!selection.rangeCount) return;
			event.preventDefault();
			const range = selection.getRangeAt(0);
			const p = document.createElement("p");
			p.innerHTML = "<br>";
			range.deleteContents();
			range.insertNode(p);
			range.setStart(p, 0);
			range.setEnd(p, 0);
			selection.removeAllRanges();
			selection.addRange(range);
		};
		attachedTables.set(tableDiv, handler);
		tableDiv.addEventListener("keydown", handler);
	}
	function detachTextEditing(tableDiv) {
		if (!tableDiv) throw new Error("Table element is required");
		const handler = attachedTables.get(tableDiv);
		if (!handler) return;
		attachedTables.delete(tableDiv);
		tableDiv.removeEventListener("keydown", handler);
	}
	//#endregion
	//#region src/current-table.ts
	const kCurrentTableClass = "bloom-current-table";
	function ownEditable(cell) {
		const editors = cell.querySelectorAll("[contenteditable]:not([contenteditable=\"false\"])");
		for (const editor of Array.from(editors)) if (editor.closest(".bloom-cell") === cell) return editor;
		return null;
	}
	function ownerTable(cell) {
		const parent = cell.parentElement;
		if (!parent) return null;
		return parent.classList.contains("bloom-table") ? parent : parent.closest(".bloom-table") ?? null;
	}
	function selectedCell(root = document) {
		return root.querySelector(".bloom-cell.cell--selected");
	}
	function ownSelectedCell(table) {
		for (const child of Array.from(table.children)) if (child instanceof HTMLElement && child.classList.contains("bloom-cell") && child.classList.contains("cell--selected")) return child;
		return null;
	}
	function currentTable() {
		const cell = selectedCell();
		return cell ? ownerTable(cell) : null;
	}
	function isNestedTable(table) {
		return !!table.parentElement?.closest(".bloom-table");
	}
	function hostCellOf(table) {
		return table.parentElement?.closest(".bloom-cell") ?? null;
	}
	function nestedTableIn(cell) {
		for (const child of Array.from(cell.children)) if (child instanceof HTMLElement && child.classList.contains("bloom-table")) return child;
		return null;
	}
	function firstCellOf(table) {
		for (const child of Array.from(table.children)) if (child instanceof HTMLElement && child.classList.contains("bloom-cell") && !child.classList.contains("bloom-skip")) return child;
		return null;
	}
	function cellChain(target) {
		const chain = [];
		let node = target;
		while (node) {
			const cell = node.closest(".bloom-cell");
			if (!cell) break;
			chain.unshift(cell);
			node = cell.parentElement;
		}
		return chain;
	}
	function levelOfCurrentTable(chain, current) {
		if (!current) return -1;
		return chain.findIndex((cell) => ownerTable(cell) === current);
	}
	function clickTargetCell(target, current = currentTable()) {
		const chain = cellChain(target);
		if (!chain.length) return null;
		const level = levelOfCurrentTable(chain, current);
		return level >= 0 ? chain[level] : chain[0];
	}
	function doubleClickTargetCell(target, current = currentTable()) {
		const chain = cellChain(target);
		if (!chain.length) return null;
		return chain[levelOfCurrentTable(chain, current) + 1] ?? null;
	}
	function selectCell(cell) {
		const editor = ownEditable(cell);
		if (!editor) {
			if (!cell.hasAttribute("tabindex")) cell.setAttribute("tabindex", "-1");
			cell.focus();
			return;
		}
		editor.focus();
		const selection = (cell.ownerDocument.defaultView ?? window).getSelection?.();
		if (!selection) return;
		const range = cell.ownerDocument.createRange();
		range.selectNodeContents(editor);
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
	}
	function markCurrentTable(table) {
		document.querySelectorAll(`.${kCurrentTableClass}`).forEach((el) => el.classList.remove(kCurrentTableClass));
		if (table && isNestedTable(table)) table.classList.add(kCurrentTableClass);
	}
	//#endregion
	//#region src/selection-highlight.ts
	let installed$1 = false;
	const OWN_MOUSEDOWN_BEHAVIOR_SELECTOR = [
		"img",
		"video",
		"audio",
		"iframe",
		"canvas",
		"embed",
		"object",
		"a[href]",
		"button",
		"input",
		"select",
		"textarea",
		"label",
		"[draggable=\"true\"]"
	].join(",");
	function clickIsInOwnEditor(target, cell) {
		const editor = target.closest("[contenteditable]:not([contenteditable=\"false\"])");
		return !!editor && editor.closest(".bloom-cell") === cell;
	}
	function clickIsOnFocusableContent(target, cell) {
		const focusable = target.closest("[tabindex]");
		return !!focusable && focusable !== cell && focusable.tabIndex >= 0 && focusable.closest(".bloom-cell") === cell;
	}
	function onMouseDown(event) {
		if (event.button !== 0) return;
		const target = event.target;
		if (!target) return;
		if (target.closest(".bloom-ui")) return;
		const cell = clickTargetCell(target);
		if (!cell) return;
		if (clickIsInOwnEditor(target, cell)) return;
		if (clickIsOnFocusableContent(target, cell)) return;
		if (!target.closest(OWN_MOUSEDOWN_BEHAVIOR_SELECTOR)) event.preventDefault();
		selectCell(cell);
	}
	function onDoubleClick(event) {
		const target = event.target;
		if (!target) return;
		const cell = doubleClickTargetCell(target);
		if (!cell || cell === selectedCell()) return;
		event.preventDefault();
		selectCell(cell);
	}
	function onKeyDown(event) {
		if (event.key !== "Enter" && event.key !== "Escape") return;
		if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
		if (document.querySelector("[data-btable-menu]")) return;
		const selected = selectedCell();
		if (!selected) return;
		if (event.key === "Enter") {
			if (document.activeElement !== selected) return;
			const nested = nestedTableIn(selected);
			const first = nested ? firstCellOf(nested) : null;
			if (!first) return;
			event.preventDefault();
			selectCell(first);
			return;
		}
		const table = ownerTable(selected);
		const host = table ? hostCellOf(table) : null;
		if (!host) return;
		event.preventDefault();
		selectCell(host);
	}
	function onFocusIn(event) {
		const target = event.target;
		if (!target) return;
		const cell = target.closest(".bloom-cell");
		if (!cell) return;
		document.querySelectorAll(".bloom-cell.cell--selected").forEach((el) => el.classList.remove("cell--selected"));
		cell.classList.add("cell--selected");
		const table = ownerTable(cell);
		if (!table) return;
		document.querySelectorAll(".bloom-table.table--selected").forEach((g) => g.classList.remove("table--selected"));
		table.classList.add("table--selected");
		markCurrentTable(table);
	}
	function ensureSelectionHighlighting() {
		if (installed$1) return;
		installed$1 = true;
		document.addEventListener("mousedown", onMouseDown, true);
		document.addEventListener("dblclick", onDoubleClick);
		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("focusin", onFocusIn, true);
	}
	//#endregion
	//#region src/grid.ts
	function assert$1(condition, message) {
		if (!condition) throw new Error(`Assertion failed: ${message}`);
	}
	/**
	* All cell elements of a table (including bloom-skip ones), in DOM order.
	* Same semantics as structure.getTableCells: direct children with the
	* bloom-cell class, and the table itself must carry the bloom-table class.
	*/
	function cellsOf(table) {
		assert$1(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const cells = [];
		Array.from(table.children).forEach((element) => {
			if (element.classList.contains("bloom-cell")) cells.push(element);
			else console.debug(`Element ${element.tagName} is not a cell, skipping.`);
		});
		return cells;
	}
	/**
	* Build a GridView in a single pass over the table.
	*
	* Dimensions come from table-model's getColumnWidths / getRowHeights — the one
	* tokenizer for the size attributes (positional; an empty token means "default
	* size for that position" and is never dropped) — so positions computed here
	* agree with structure.getTableInfo and every other reader.
	*/
	function buildGrid(table) {
		const cols = getColumnWidths(table).length;
		const rows = getRowHeights(table).length;
		const cells = cellsOf(table);
		const posOf = /* @__PURE__ */ new Map();
		if (cols > 0) {
			const inGrid = Math.min(cells.length, rows * cols);
			for (let i = 0; i < inGrid; i++) posOf.set(cells[i], {
				row: Math.floor(i / cols),
				column: i % cols
			});
		}
		const cover = new Array(rows * cols).fill(null);
		for (const [cell, pos] of posOf) {
			if (cell.classList.contains("bloom-skip")) continue;
			const span = getSpan(cell);
			const entry = {
				anchor: cell,
				row: pos.row,
				column: pos.column,
				spanX: span.x,
				spanY: span.y
			};
			const rEnd = Math.min(pos.row + span.y, rows);
			const cEnd = Math.min(pos.column + span.x, cols);
			for (let r = pos.row; r < rEnd; r++) for (let c = pos.column; c < cEnd; c++) {
				const idx = r * cols + c;
				if (!cover[idx]) cover[idx] = entry;
			}
		}
		return {
			rows,
			cols,
			cells,
			posOf,
			cellAt(r, c) {
				if (r < 0 || c < 0 || r >= rows || c >= cols) return void 0;
				return cells[r * cols + c];
			},
			coverAt(r, c) {
				if (r < 0 || c < 0 || r >= rows || c >= cols) return null;
				return cover[r * cols + c];
			}
		};
	}
	//#endregion
	//#region src/operation-detail.ts
	const kWholeTableTarget = "whole table";
	const cellCount = (n) => `${n} cell${n === 1 ? "" : "s"}`;
	/** Describes the cells a formatting command wrote to: the cell's position for
	*  a single cell, the row or column number and how many cells it holds, or the
	*  whole table with its cell count. */
	function describeTarget(table, scope, cells) {
		if (scope === "table") return `${kWholeTableTarget} (${cellCount(cells.length)})`;
		if (cells.length === 0) return "no cells";
		const grid = buildGrid(table);
		const positions = cells.map((c) => grid.posOf.get(c)).filter((p) => !!p);
		if (positions.length === 0) return cellCount(cells.length);
		if (scope === "cell") {
			const p = positions[0];
			return `cell at row ${p.row + 1}, column ${p.column + 1}`;
		}
		return `${scope} ${(scope === "row" ? Math.max(...positions.map((p) => p.row)) : Math.max(...positions.map((p) => p.column))) + 1} (${cellCount(cells.length)})`;
	}
	/** The 1-based position of a cell in its table, or null when the cell is not
	*  one of the table's own cells. */
	function describeCellPosition(table, cell) {
		const pos = buildGrid(table).posOf.get(cell);
		if (!pos) return null;
		return `cell at row ${pos.row + 1}, column ${pos.column + 1}`;
	}
	//#endregion
	//#region src/BloomTable.ts
	function attachClonedNestedTables(cells) {
		for (const cell of cells) cell.querySelectorAll(".bloom-table").forEach((t) => attachTable(t));
	}
	var BloomTable = class {
		constructor(table) {
			this.table = table;
			if (!this.table.classList.contains("bloom-table")) this.table.classList.add("bloom-table");
		}
		focusEditableInCell(cell) {
			if (!cell) return;
			const editable = ownEditable(cell);
			try {
				if (!editable && !cell.hasAttribute("tabindex")) cell.setAttribute("tabindex", "-1");
				(editable ?? cell).focus();
			} catch {}
		}
		addRow() {
			const sel = ownSelectedCell(this.table);
			let targetCol = 0;
			let sourceRow;
			if (sel) {
				const widths = getColumnWidths(this.table);
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				const col = widths.length > 0 ? cellIndex % widths.length : 0;
				targetCol = Math.max(0, Math.min(col, Math.max(0, widths.length - 1)));
				sourceRow = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
			}
			addRow(this.table, false, sourceRow);
			render(this.table);
			const rowIndex = Math.max(0, getRowHeights(this.table).length - 1);
			this.focusEditableInCell(getCell(this.table, rowIndex, targetCol));
		}
		removeLastRow() {
			const sel = ownSelectedCell(this.table);
			let targetCol = 0;
			const widthsBefore = getColumnWidths(this.table);
			const heightsBefore = getRowHeights(this.table);
			if (sel && widthsBefore.length > 0) {
				const col = Array.from(this.table.children).indexOf(sel) % widthsBefore.length;
				targetCol = Math.max(0, Math.min(col, Math.max(0, widthsBefore.length - 1)));
			}
			const removedIndex = Math.max(0, heightsBefore.length - 1);
			removeLastRow(this.table);
			render(this.table);
			const heightsAfter = getRowHeights(this.table);
			if (heightsAfter.length > 0) {
				const targetRow = Math.min(removedIndex, heightsAfter.length - 1);
				this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
			}
		}
		addColumn() {
			const sel = ownSelectedCell(this.table);
			let targetRow = 0;
			let sourceCol;
			if (sel) {
				const heights = getRowHeights(this.table);
				const widths = getColumnWidths(this.table);
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				const row = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
				targetRow = Math.max(0, Math.min(row, Math.max(0, heights.length - 1)));
				sourceCol = widths.length > 0 ? cellIndex % widths.length : 0;
			}
			addColumn(this.table, false, sourceCol);
			render(this.table);
			const colIndex = Math.max(0, getColumnWidths(this.table).length - 1);
			this.focusEditableInCell(getCell(this.table, targetRow, colIndex));
		}
		removeLastColumn() {
			const sel = ownSelectedCell(this.table);
			let targetRow = 0;
			const heightsBefore = getRowHeights(this.table);
			const widthsBefore = getColumnWidths(this.table);
			if (sel && widthsBefore.length > 0) {
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				const row = Math.floor(cellIndex / Math.max(1, widthsBefore.length));
				targetRow = Math.max(0, Math.min(row, Math.max(0, heightsBefore.length - 1)));
			}
			const removedIndex = Math.max(0, widthsBefore.length - 1);
			removeLastColumn(this.table);
			render(this.table);
			const widthsAfter = getColumnWidths(this.table);
			if (widthsAfter.length > 0) {
				const targetCol = Math.min(removedIndex, widthsAfter.length - 1);
				this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
			}
		}
		addRowAt(index, sourceRowOverride) {
			const sel = ownSelectedCell(this.table);
			let targetCol = 0;
			let sourceRow = sourceRowOverride;
			if (sel) {
				const widths = getColumnWidths(this.table);
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				const col = widths.length > 0 ? cellIndex % widths.length : 0;
				targetCol = Math.max(0, Math.min(col, Math.max(0, widths.length - 1)));
				if (sourceRow == null) sourceRow = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
			}
			addRowAt(this.table, index, false, sourceRow);
			render(this.table);
			this.focusEditableInCell(getCell(this.table, index, targetCol));
		}
		addColumnAt(index, sourceColOverride) {
			const sel = ownSelectedCell(this.table);
			let targetRow = 0;
			let sourceCol = sourceColOverride;
			if (sel) {
				const heights = getRowHeights(this.table);
				const widths = getColumnWidths(this.table);
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				const row = widths.length > 0 ? Math.floor(cellIndex / widths.length) : 0;
				targetRow = Math.max(0, Math.min(row, Math.max(0, heights.length - 1)));
				if (sourceCol == null) sourceCol = widths.length > 0 ? cellIndex % widths.length : 0;
			}
			addColumnAt(this.table, index, false, sourceCol);
			render(this.table);
			this.focusEditableInCell(getCell(this.table, targetRow, index));
		}
		removeRowAt(index) {
			const sel = ownSelectedCell(this.table);
			let targetCol = 0;
			const widthsBefore = getColumnWidths(this.table);
			if (sel && widthsBefore.length > 0) {
				const col = Array.from(this.table.children).indexOf(sel) % widthsBefore.length;
				targetCol = Math.max(0, Math.min(col, Math.max(0, widthsBefore.length - 1)));
			}
			removeRowAt(this.table, index);
			render(this.table);
			const heightsAfter = getRowHeights(this.table);
			if (heightsAfter.length > 0) {
				const targetRow = Math.min(index, heightsAfter.length - 1);
				this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
			}
		}
		removeColumnAt(index) {
			const sel = ownSelectedCell(this.table);
			let targetRow = 0;
			const widthsBefore = getColumnWidths(this.table);
			const heightsBefore = getRowHeights(this.table);
			if (sel && widthsBefore.length > 0) {
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				const row = Math.floor(cellIndex / Math.max(1, widthsBefore.length));
				targetRow = Math.max(0, Math.min(row, Math.max(0, heightsBefore.length - 1)));
			}
			removeColumnAt(this.table, index);
			render(this.table);
			const widthsAfter = getColumnWidths(this.table);
			if (widthsAfter.length > 0) {
				const targetCol = Math.min(index, widthsAfter.length - 1);
				this.focusEditableInCell(getCell(this.table, targetRow, targetCol));
			}
		}
		duplicateRowAt(index) {
			const sel = ownSelectedCell(this.table);
			let targetCol = 0;
			const widths = getColumnWidths(this.table);
			if (sel && widths.length > 0) {
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				targetCol = Math.max(0, Math.min(cellIndex % widths.length, widths.length - 1));
			}
			const rowsBefore = getRowHeights(this.table).length;
			duplicateRowAt(this.table, index);
			const heights = getRowHeights(this.table);
			if (heights.length === rowsBefore) return;
			const cols = getColumnWidths(this.table).length;
			attachClonedNestedTables(Array.from({ length: cols }, (_, c) => getCell(this.table, index + 1, c)));
			render(this.table);
			if (heights.length > 0) this.focusEditableInCell(getCell(this.table, Math.min(index + 1, heights.length - 1), targetCol));
		}
		duplicateColumnAt(index) {
			const sel = ownSelectedCell(this.table);
			let targetRow = 0;
			const widths = getColumnWidths(this.table);
			const heights = getRowHeights(this.table);
			if (sel && widths.length > 0) {
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				targetRow = Math.max(0, Math.min(Math.floor(cellIndex / widths.length), Math.max(0, heights.length - 1)));
			}
			const colsBefore = getColumnWidths(this.table).length;
			duplicateColumnAt(this.table, index);
			const widthsAfter = getColumnWidths(this.table);
			if (widthsAfter.length === colsBefore) return;
			const rows = getRowHeights(this.table).length;
			attachClonedNestedTables(Array.from({ length: rows }, (_, r) => getCell(this.table, r, index + 1)));
			render(this.table);
			if (widthsAfter.length > 0) this.focusEditableInCell(getCell(this.table, targetRow, Math.min(index + 1, widthsAfter.length - 1)));
		}
		moveRowAt(from, to) {
			const sel = ownSelectedCell(this.table);
			let targetCol = 0;
			const widths = getColumnWidths(this.table);
			if (sel && widths.length > 0) {
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				targetCol = Math.max(0, Math.min(cellIndex % widths.length, widths.length - 1));
			}
			moveRowAt(this.table, from, to);
			render(this.table);
			const heights = getRowHeights(this.table);
			if (heights.length > 0) this.focusEditableInCell(getCell(this.table, Math.min(to, heights.length - 1), targetCol));
		}
		moveColumnAt(from, to) {
			const sel = ownSelectedCell(this.table);
			let targetRow = 0;
			const widths = getColumnWidths(this.table);
			const heights = getRowHeights(this.table);
			if (sel && widths.length > 0) {
				const cellIndex = Array.from(this.table.children).indexOf(sel);
				targetRow = Math.max(0, Math.min(Math.floor(cellIndex / widths.length), Math.max(0, heights.length - 1)));
			}
			moveColumnAt(this.table, from, to);
			render(this.table);
			const widthsAfter = getColumnWidths(this.table);
			if (widthsAfter.length > 0) this.focusEditableInCell(getCell(this.table, targetRow, Math.min(to, widthsAfter.length - 1)));
		}
		setColumnWidth(index, value) {
			const perform = () => {
				const widths = getColumnWidths(this.table);
				if (index < 0 || index >= widths.length) return;
				widths[index] = value;
				setColumnWidths(this.table, widths);
			};
			tableHistoryManager.addHistoryEntry(this.table, {
				label: "Set Column Width",
				detail: `column ${index + 1} to ${value}`
			}, perform);
			render(this.table);
		}
		setRowHeight(index, value) {
			const perform = () => {
				const heights = getRowHeights(this.table);
				if (index < 0 || index >= heights.length) return;
				heights[index] = value;
				setRowHeights(this.table, heights);
			};
			tableHistoryManager.addHistoryEntry(this.table, {
				label: "Set Row Height",
				detail: `row ${index + 1} to ${value}`
			}, perform);
			render(this.table);
		}
		getRowHeight(index) {
			const heights = getRowHeights(this.table);
			return index >= 0 && index < heights.length ? heights[index] : null;
		}
		getColumnWidth(index) {
			const widths = getColumnWidths(this.table);
			return index >= 0 && index < widths.length ? widths[index] : null;
		}
		getSpan(cell) {
			return getSpan(cell);
		}
		setTableCorners(radiusPx) {
			const perform = () => setTableCorners(this.table, { radius: radiusPx });
			tableHistoryManager.addHistoryEntry(this.table, {
				label: "Set Table Corners",
				detail: `radius ${radiusPx}`
			}, perform);
			render(this.table);
		}
		undo() {
			return tableHistoryManager.undo(this.table);
		}
		redo() {
			return tableHistoryManager.redo(this.table);
		}
		canUndo() {
			return tableHistoryManager.canUndo(this.table);
		}
		canRedo() {
			return tableHistoryManager.canRedo(this.table);
		}
		setSpan(cell, x, y) {
			const perform = () => setCellSpan(cell, x, y);
			tableHistoryManager.addHistoryEntry(this.table, {
				label: "Set Cell Span",
				detail: `${describeCellPosition(this.table, cell) ?? "cell"} to ${x}x${y}`
			}, perform);
			render(this.table);
		}
	};
	//#endregion
	//#region src/ProximityDiv.ts
	const ACTIVATION_DISTANCE = 50;
	const MIN_OPACITY = .08;
	let globalInstances = [];
	let mouseListenerInstalled = false;
	let lastMousePageX = 0;
	let lastMousePageY = 0;
	function clamp01(x) {
		return Math.max(0, Math.min(1, x));
	}
	function ensureMouseListener() {
		if (mouseListenerInstalled) return;
		mouseListenerInstalled = true;
		document.addEventListener("mousemove", (e) => {
			lastMousePageX = e.pageX;
			lastMousePageY = e.pageY;
			for (const inst of globalInstances) inst.updateOpacity();
		}, { passive: true });
	}
	var ProximityDiv = class {
		constructor(parent, child, options) {
			this.child = child;
			this.minOpacity = options?.minOpacity ?? MIN_OPACITY;
			ensureMouseListener();
			const wrapper = document.createElement("div");
			this.element = wrapper;
			wrapper.setAttribute("data-table-overlay", "proximity-wrapper");
			Object.assign(wrapper.style, {
				position: "absolute",
				pointerEvents: "none"
			});
			Object.assign(this.child.style, { pointerEvents: "auto" });
			wrapper.appendChild(this.child);
			parent.appendChild(wrapper);
			globalInstances.push(this);
			const onHover = (e) => {
				lastMousePageX = e.pageX;
				lastMousePageY = e.pageY;
				this.updateOpacity();
			};
			this.child.addEventListener("mouseenter", onHover, { passive: true });
			this.child.addEventListener("mousemove", onHover, { passive: true });
		}
		setPosition(left, top) {
			this.element.style.left = `${left}px`;
			this.element.style.top = `${top}px`;
			this.updateOpacity();
		}
		updateOpacity() {
			let rect = this.child.getBoundingClientRect();
			if (rect.width === 0 && rect.height === 0) rect = this.element.getBoundingClientRect();
			const left = rect.left + window.scrollX;
			const top = rect.top + window.scrollY;
			const right = left + rect.width;
			const bottom = top + rect.height;
			const px = lastMousePageX;
			const py = lastMousePageY;
			const dx = px < left ? left - px : px > right ? px - right : 0;
			const dy = py < top ? top - py : py > bottom ? py - bottom : 0;
			const distance = Math.hypot(dx, dy);
			const dead = Math.max(0, ACTIVATION_DISTANCE);
			const min = this.minOpacity;
			let opacity;
			if (distance >= dead) opacity = min;
			else opacity = clamp01(min + (1 - distance / dead) * (1 - min));
			this.child.style.opacity = String(opacity);
		}
		destroy() {
			const i = globalInstances.indexOf(this);
			if (i >= 0) globalInstances.splice(i, 1);
			this.element.remove();
		}
	};
	//#endregion
	//#region src/constants.ts
	const kBloomBlue = "#2b6e77";
	//#endregion
	//#region src/structural-chrome.ts
	let gate;
	/**
	* Install the host's answer to "does this table get the structural chrome?",
	* called with each table as its chrome is about to be shown or repositioned.
	* Pass undefined to remove a gate, after which every table gets the chrome
	* again.
	*/
	function setStructuralChromeGate(fn) {
		gate = fn;
	}
	/**
	* True when `table` gets the structural chrome. Every table does until a host
	* installs a gate, so a host that never calls setStructuralChromeGate sees the
	* behaviour the library has always had.
	*/
	function structuralChromeAllowed(table) {
		return gate ? gate(table) : true;
	}
	//#endregion
	//#region src/cell-menu-host.ts
	/**
	* The ids the menu composition asks about.
	*
	* - `contentType` is the Content Type row, and `contentType:<id>` is one type
	*   within it, so `contentType:image` is the Image button.
	* - `alignment`, `padding`, `fill`, `borderStyle`, `borderWeight` and `corners`
	*   are the rows of the Format section. `fill` is the row that holds both colour
	*   pickers, Fill and Border color, because they share one row.
	* - `paintFormat` is Paint format, in the Cell, Row and Column menus.
	*   `copyProperties` and `pasteProperties` are its Table menu counterparts.
	* - `merge` and `split` are the Cell menu's span commands.
	*
	* A `contentType:<id>` is only asked about once its row has been allowed.
	*/
	const cellMenuItemIds = [
		"contentType",
		"alignment",
		"padding",
		"fill",
		"borderStyle",
		"borderWeight",
		"corners",
		"paintFormat",
		"copyProperties",
		"pasteProperties",
		"merge",
		"split"
	];
	let filter;
	/**
	* Install the host's answer to "does this cell's menu offer this item?". It is
	* asked as a menu is built, with the item's id, the cell the menu acts on, and
	* that cell's table. Pass undefined to remove a filter, after which every menu
	* offers everything again.
	*
	* Write the answer as a list of what to keep rather than a list of what to
	* remove. A host that names what to remove silently gains any item a later
	* version of the library adds.
	*/
	function setCellMenuItemFilter(fn) {
		filter = fn;
	}
	/**
	* True when the menu for `cell` offers `itemId`. Everything is offered until a
	* host installs a filter that says otherwise.
	*/
	function cellMenuOffersItem(itemId, cell, table) {
		return filter ? filter(itemId, cell, table) : true;
	}
	let openHandler;
	/**
	* Install the host's chance to open a cell's menu itself. A right-click on a cell
	* asks this first, with the cell, its table, and the point the user clicked. A
	* host that answers true has opened its own menu and the library opens none; a
	* host that answers false leaves the right-click to the library, as does having
	* no handler at all.
	*
	* A host answers true where it needs the cell's items shown beside items of its
	* own that the library knows nothing about. Bloom does it for a picture in a
	* calendar month grid, whose menu has to carry the image commands as well as the
	* content type. It builds that menu from getCellMenuItems (cell-menu-model.ts),
	* so both menus offer the same cell items.
	*/
	function setCellMenuOpenHandler(fn) {
		openHandler = fn;
	}
	/**
	* True when the host opened the menu for `cell` itself, in which case the library
	* must open none.
	*/
	function cellMenuOpenedByHost(cell, table, position) {
		return openHandler ? openHandler(cell, table, position) : false;
	}
	//#endregion
	//#region src/cell-menu-items-source.ts
	let source;
	/** table-size-buttons.ts installs its item builder here as it loads. */
	function setCellMenuItemsSource(builder) {
		source = builder;
	}
	/** The cell's menu items, already filtered by the host's setCellMenuItemFilter. */
	function cellMenuItemsOfCell(cell) {
		if (!source) throw new Error("bloom-table: no Cell menu item source is installed. Import the library's entry point (or table-size-buttons) before rendering CellMenuItems.");
		return source(cell);
	}
	//#endregion
	//#region src/menu-icons.ts
	const kAddIconSvg = `<svg viewBox="0 0 24 24" width="18" height="18" style="width:18px;height:18px;display:block;fill:currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
	const kIconAttr = `viewBox="0 0 24 24" width="16" height="16" style="width:16px;height:16px;display:block;fill:currentColor"`;
	const kAddRowAboveIconSvg = `<svg ${kIconAttr}><rect x="10.5" y="2" width="3" height="11" rx="0.5"/><rect x="6" y="6" width="12" height="3" rx="0.5"/><rect x="3" y="19" width="18" height="2.5" rx="1"/></svg>`;
	const kAddRowBelowIconSvg = `<svg ${kIconAttr}><rect x="3" y="2.5" width="18" height="2.5" rx="1"/><rect x="10.5" y="11" width="3" height="11" rx="0.5"/><rect x="6" y="15" width="12" height="3" rx="0.5"/></svg>`;
	const kAddColumnLeftIconSvg = `<svg ${kIconAttr}><rect x="6" y="6" width="3" height="12" rx="0.5"/><rect x="1.5" y="10.5" width="12" height="3" rx="0.5"/><rect x="19" y="3" width="2.5" height="18" rx="1"/></svg>`;
	const kAddColumnRightIconSvg = `<svg ${kIconAttr}><rect x="2.5" y="3" width="2.5" height="18" rx="1"/><rect x="15" y="6" width="3" height="12" rx="0.5"/><rect x="10.5" y="10.5" width="12" height="3" rx="0.5"/></svg>`;
	const kMoveUpIconSvg = `<svg ${kIconAttr}><path d="M12 4l-7 7h4v7h6v-7h4z"/></svg>`;
	const kMoveDownIconSvg = `<svg ${kIconAttr}><path d="M12 20l7-7h-4V6H9v7H5z"/></svg>`;
	const kMoveLeftIconSvg = `<svg ${kIconAttr}><path d="M4 12l7-7v4h7v6h-7v4z"/></svg>`;
	const kMoveRightIconSvg = `<svg ${kIconAttr}><path d="M20 12l-7-7v4H6v6h7v4z"/></svg>`;
	const kCopyIconSvg = `<svg ${kIconAttr}><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>`;
	const kPasteIconSvg = `<svg ${kIconAttr}><path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z"/></svg>`;
	const kCutIconSvg = `<svg ${kIconAttr}><path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/></svg>`;
	const kTrashIconSvg = `<svg ${kIconAttr}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
	const kInfoIconSvg = `<svg ${kIconAttr}><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>`;
	const kPaintRollerPath = "M18 4V3c0-.55-.45-1-1-1H5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V6h1v4H9v11c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-9h8V4z";
	const kPaintIconSvg = `<svg ${kIconAttr}><path d="${kPaintRollerPath}"/></svg>`;
	function stylePill(btn) {
		Object.assign(btn.style, {
			position: "static",
			height: "20px",
			minWidth: "30px",
			padding: "0 8px",
			borderRadius: "10px",
			border: "1px solid rgba(0,0,0,0.3)",
			backgroundColor: "#2D8294",
			color: "#fff",
			fontSize: "16px",
			fontWeight: "700",
			lineHeight: "1",
			letterSpacing: "1px",
			boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
			cursor: "pointer",
			display: "none",
			alignItems: "center",
			justifyContent: "center",
			gap: "5px",
			boxSizing: "border-box"
		});
		btn.setAttribute("aria-haspopup", "menu");
		btn.addEventListener("mousedown", (e) => e.preventDefault());
	}
	function makeGlyphPill(label, iconSrc, iconStyle) {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.setAttribute("aria-label", label);
		btn.title = label;
		const img = document.createElement("img");
		img.src = iconSrc;
		img.alt = "";
		img.setAttribute("style", iconStyle);
		btn.replaceChildren(img);
		stylePill(btn);
		btn.setAttribute("data-table-overlay", "menu-pill");
		return btn;
	}
	function makeMenuHeader(text) {
		const h = document.createElement("div");
		h.textContent = text;
		Object.assign(h.style, {
			padding: `8px 14px 3px 36px`,
			fontSize: "11px",
			fontWeight: "700",
			textTransform: "uppercase",
			letterSpacing: "0.5px",
			color: "#888"
		});
		return h;
	}
	function makeDivider() {
		const d = document.createElement("div");
		Object.assign(d.style, {
			height: "1px",
			background: "rgba(0,0,0,0.1)",
			margin: "4px 0"
		});
		return d;
	}
	const kItemIconColor = "#333";
	function cssUrl(url) {
		const unsafeInACssString = {
			"\"": "%22",
			"<": "%3C",
			">": "%3E",
			"\r": "%0D",
			"\n": "%0A"
		};
		let escaped = url;
		for (const [character, replacement] of Object.entries(unsafeInACssString)) escaped = escaped.split(character).join(replacement);
		return `url("${escaped}")`;
	}
	function setIconSlot(el, icon, color) {
		el.innerHTML = "";
		if (!icon) return;
		if (icon.trim().startsWith("<svg")) {
			el.style.color = color;
			el.innerHTML = icon;
			return;
		}
		const m = document.createElement("span");
		Object.assign(m.style, {
			display: "block",
			width: "16px",
			height: "16px",
			backgroundColor: color
		});
		m.style.setProperty("mask-image", cssUrl(icon));
		m.style.setProperty("-webkit-mask-image", cssUrl(icon));
		for (const prop of ["mask-size", "-webkit-mask-size"]) m.style.setProperty(prop, "contain");
		for (const prop of ["mask-repeat", "-webkit-mask-repeat"]) m.style.setProperty(prop, "no-repeat");
		for (const prop of ["mask-position", "-webkit-mask-position"]) m.style.setProperty(prop, "center");
		el.appendChild(m);
	}
	function makeInfoNote(text) {
		const row = document.createElement("div");
		Object.assign(row.style, {
			display: "flex",
			alignItems: "center",
			width: "100%",
			padding: "6px 14px",
			boxSizing: "border-box"
		});
		const slot = document.createElement("span");
		Object.assign(slot.style, {
			flex: `0 0 22px`,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center"
		});
		setIconSlot(slot, kInfoIconSvg, kBloomBlue);
		const label = document.createElement("span");
		label.textContent = text;
		Object.assign(label.style, {
			flex: "1 1 auto",
			fontSize: "12px",
			color: "#666"
		});
		row.appendChild(slot);
		row.appendChild(label);
		return row;
	}
	function makeControlRow(label, controls) {
		const wrap = document.createElement("div");
		wrap.style.padding = "4px 14px";
		wrap.style.boxSizing = "border-box";
		const labelLine = document.createElement("div");
		Object.assign(labelLine.style, {
			display: "flex",
			alignItems: "center"
		});
		const slot = document.createElement("span");
		slot.style.flex = `0 0 22px`;
		const text = document.createElement("span");
		text.textContent = label;
		Object.assign(text.style, {
			fontSize: "13px",
			color: "#222"
		});
		labelLine.appendChild(slot);
		labelLine.appendChild(text);
		const controlsLine = document.createElement("div");
		Object.assign(controlsLine.style, {
			display: "flex",
			gap: "4px",
			paddingLeft: `22px`,
			marginTop: "2px"
		});
		controls.forEach((c) => controlsLine.appendChild(c));
		wrap.appendChild(labelLine);
		wrap.appendChild(controlsLine);
		return wrap;
	}
	function setToggleActive(btn, active) {
		btn.style.background = active ? "#d7ecf1" : "transparent";
		btn.style.borderColor = active ? "#2D8294" : "transparent";
		btn.setAttribute("aria-pressed", active ? "true" : "false");
	}
	function makeIconToggle(icon, title, active, onClick) {
		const b = document.createElement("button");
		b.type = "button";
		b.title = title;
		b.setAttribute("aria-label", title);
		Object.assign(b.style, {
			width: "28px",
			height: "24px",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			border: "1px solid transparent",
			borderRadius: "5px",
			background: "transparent",
			cursor: "pointer",
			padding: "0",
			boxSizing: "border-box"
		});
		setIconSlot(b, icon, kBloomBlue);
		setToggleActive(b, active);
		b.addEventListener("mousedown", (e) => e.preventDefault());
		b.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick();
		});
		return b;
	}
	function makeTextToggle(text, title, active, onClick) {
		const b = document.createElement("button");
		b.type = "button";
		b.title = title;
		b.setAttribute("aria-label", title);
		b.textContent = text;
		Object.assign(b.style, {
			minWidth: "28px",
			height: "24px",
			padding: "0 6px",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			border: "1px solid transparent",
			borderRadius: "5px",
			background: "transparent",
			cursor: "pointer",
			fontSize: "12px",
			color: kBloomBlue,
			boxSizing: "border-box"
		});
		setToggleActive(b, active);
		b.addEventListener("mousedown", (e) => e.preventDefault());
		b.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick();
		});
		return b;
	}
	function makeSampleToggle(title, sample, onClick) {
		const b = document.createElement("button");
		b.type = "button";
		b.title = title;
		b.setAttribute("aria-label", title);
		Object.assign(b.style, {
			width: "32px",
			height: "24px",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			border: "1px solid transparent",
			borderRadius: "5px",
			background: "transparent",
			cursor: "pointer",
			padding: "0",
			boxSizing: "border-box"
		});
		b.appendChild(sample);
		setToggleActive(b, false);
		b.addEventListener("mousedown", (e) => e.preventDefault());
		b.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick();
		});
		return b;
	}
	const kNoneStroke = "rgba(0,0,0,0.2)";
	const noneDiagonal = `linear-gradient(to bottom right, #fff calc(50% - 0.5px), ${kNoneStroke} calc(50% - 0.5px), ${kNoneStroke} calc(50% + 0.5px), #fff calc(50% + 0.5px))`;
	function makeNoneSample(width, height) {
		const box = document.createElement("span");
		Object.assign(box.style, {
			width: `${width}px`,
			height: `${height}px`,
			display: "block",
			boxSizing: "border-box",
			border: `1px solid ${kNoneStroke}`,
			borderRadius: "2px",
			background: noneDiagonal
		});
		return box;
	}
	function makeBorderStyleToggle(style, onClick) {
		let sample;
		if (style === "none") sample = makeNoneSample(22, 14);
		else {
			sample = document.createElement("span");
			Object.assign(sample.style, {
				width: "22px",
				height: "0",
				borderTop: `2px ${style} ${kItemIconColor}`,
				display: "block"
			});
		}
		const b = makeSampleToggle(style === "none" ? "None" : style[0].toUpperCase() + style.slice(1), sample, onClick);
		b.dataset.style = style;
		return b;
	}
	function makeBorderWeightToggle(weight, onClick) {
		let sample;
		if (weight) {
			sample = document.createElement("span");
			Object.assign(sample.style, {
				width: "22px",
				height: `${weight}px`,
				background: kItemIconColor,
				display: "block"
			});
		} else sample = makeNoneSample(22, 14);
		const b = makeSampleToggle(weight ? `${weight}` : "0 (None)", sample, onClick);
		b.dataset.weight = String(weight);
		return b;
	}
	function makeCornerToggle(radius, active, onClick) {
		const b = document.createElement("button");
		b.type = "button";
		b.title = `${radius}`;
		b.setAttribute("aria-label", `Corner radius ${radius}`);
		Object.assign(b.style, {
			width: "28px",
			height: "24px",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			border: "1px solid transparent",
			borderRadius: "5px",
			background: "transparent",
			cursor: "pointer",
			padding: "0",
			boxSizing: "border-box"
		});
		const sample = document.createElement("span");
		const r = Math.max(0, Math.min(radius, 18));
		Object.assign(sample.style, {
			width: "18px",
			height: "18px",
			borderLeft: `2px solid ${kItemIconColor}`,
			borderTop: `2px solid ${kItemIconColor}`,
			borderTopLeftRadius: `${r}px`,
			boxSizing: "border-box",
			display: "block"
		});
		b.appendChild(sample);
		setToggleActive(b, active);
		b.addEventListener("mousedown", (e) => e.preventDefault());
		b.addEventListener("click", (e) => {
			e.stopPropagation();
			onClick();
		});
		return b;
	}
	function firstPx$1(s) {
		const n = parseFloat((s ?? "").trim());
		return isNaN(n) ? 0 : n;
	}
	function makeSliderRow(label, min, max, value, unit, onInput) {
		const input = document.createElement("input");
		input.type = "range";
		input.min = String(min);
		input.max = String(max);
		input.value = String(value);
		input.setAttribute("aria-label", label);
		input.style.flex = "1 1 auto";
		input.style.accentColor = kBloomBlue;
		const readout = document.createElement("span");
		readout.textContent = `${value}${unit}`;
		Object.assign(readout.style, {
			fontSize: "12px",
			color: "#555",
			minWidth: "34px",
			textAlign: "right"
		});
		input.addEventListener("input", () => {
			const v = Number(input.value);
			readout.textContent = `${v}${unit}`;
			onInput(v);
		});
		return makeControlRow(label, [input, readout]);
	}
	function makeColorInput(label, value, onInput) {
		const isSet = /^#[0-9a-fA-F]{6}$/.test(value);
		const input = document.createElement("input");
		input.type = "color";
		input.value = isSet ? value : "#ffffff";
		input.setAttribute("aria-label", label);
		Object.assign(input.style, {
			width: "40px",
			height: "24px",
			padding: "0",
			border: "1px solid rgba(0,0,0,0.2)",
			borderRadius: "4px",
			cursor: "pointer",
			background: "transparent"
		});
		const wrap = document.createElement("div");
		Object.assign(wrap.style, {
			position: "relative",
			display: "inline-flex",
			width: "40px",
			height: "24px"
		});
		wrap.appendChild(input);
		const noColor = document.createElement("div");
		Object.assign(noColor.style, {
			position: "absolute",
			inset: "1px",
			borderRadius: "3px",
			pointerEvents: "none",
			background: noneDiagonal,
			display: isSet ? "none" : "block"
		});
		wrap.appendChild(noColor);
		input.addEventListener("input", () => {
			noColor.style.display = "none";
			onInput(input.value);
		});
		return wrap;
	}
	function makeColorPairRow(entries) {
		const wrap = document.createElement("div");
		wrap.style.padding = "4px 14px";
		wrap.style.boxSizing = "border-box";
		const line = document.createElement("div");
		Object.assign(line.style, {
			display: "flex",
			gap: "16px",
			paddingLeft: `22px`
		});
		for (const e of entries) {
			const col = document.createElement("div");
			Object.assign(col.style, {
				display: "flex",
				flexDirection: "column",
				gap: "2px"
			});
			const caption = document.createElement("span");
			caption.textContent = e.label;
			Object.assign(caption.style, {
				fontSize: "13px",
				color: "#222"
			});
			col.appendChild(caption);
			col.appendChild(makeColorInput(e.label, e.value, e.onInput));
			line.appendChild(col);
		}
		wrap.appendChild(line);
		return wrap;
	}
	//#endregion
	//#region src/components/CellMenuItems.tsx
	const kPressedBackgroundColor = "#d7ecf1";
	const kPressedBorderColor = "#2d8294";
	const kIconGutterPx = 28;
	/** What the heading over these items says, and the id a host localizes it by. */
	const kCellSectionHeadingLabel = "Table Cell";
	const kCellSectionHeadingId = "tableCell";
	/** One of the library's icons, whether it is SVG markup or a url. */
	const IconSlot = (props) => {
		const slot = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			if (slot.current) setIconSlot(slot.current, props.icon, props.color);
		}, [props.icon, props.color]);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			ref: slot,
			style: {
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: "16px",
				height: "16px"
			}
		});
	};
	const CommandRow = (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_mui_material_MenuItem.default, {
		"aria-label": props.label,
		disabled: !props.item.enabled,
		onClick: () => {
			props.closeMenu?.();
			props.item.invoke();
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_mui_material_ListItemIcon.default, {
			sx: {
				minWidth: kIconGutterPx,
				width: kIconGutterPx
			},
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSlot, {
				icon: props.item.icon,
				color: kItemIconColor
			})
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_mui_material_ListItemText.default, {
			primary: props.label,
			primaryTypographyProps: { variant: "inherit" }
		})]
	});
	const ChoiceRow = (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
		style: {
			display: "block",
			padding: "4px 14px",
			listStyle: "none"
		},
		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: {
				fontSize: "13px",
				color: "#222"
			},
			children: props.localize(props.item.label, props.item.id)
		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			style: {
				display: "flex",
				gap: "4px",
				marginTop: "2px"
			},
			children: props.item.options.map((option) => {
				const label = props.localize(option.label, `${props.item.id}:${option.id}`);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_mui_material_ToggleButton.default, {
					value: option.id,
					selected: option.chosen,
					title: label,
					"aria-label": label,
					"data-ct-id": option.id,
					onMouseDown: (event) => event.preventDefault(),
					onClick: (event) => {
						event.stopPropagation();
						option.choose();
						props.onChosen();
					},
					sx: {
						width: 28,
						height: 24,
						padding: 0,
						border: "1px solid transparent",
						borderRadius: "5px",
						"&.Mui-selected": {
							backgroundColor: kPressedBackgroundColor,
							borderColor: kPressedBorderColor,
							"&:hover": { backgroundColor: kPressedBackgroundColor }
						}
					},
					children: option.icon ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSlot, {
						icon: option.icon,
						color: kBloomBlue
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: "12px",
							color: kBloomBlue
						},
						children: label
					})
				}, option.id);
			})
		})]
	});
	const SectionHeading = (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
		style: {
			display: "block",
			listStyle: "none",
			padding: "8px 14px 3px",
			fontSize: "11px",
			fontWeight: 700,
			textTransform: "uppercase",
			letterSpacing: "0.5px",
			color: "#888"
		},
		children: props.label
	});
	const FormatControls = (props) => {
		const container = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			const element = container.current;
			if (!element) return;
			props.render(element);
			return () => {
				element.innerHTML = "";
			};
		}, []);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
			style: {
				display: "block",
				listStyle: "none"
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					padding: "8px 14px 3px",
					fontSize: "13px",
					color: "#666"
				},
				children: props.label
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { ref: container })]
		});
	};
	const CellMenuItems = (props) => {
		const [, noteCellChanged] = (0, react.useState)(0);
		const localize = props.localize ?? ((englishLabel) => englishLabel);
		const rows = [];
		let groupOfPreviousItem;
		const items = props.cell ? cellMenuItemsOfCell(props.cell) : [];
		if (items.length > 0) rows.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SectionHeading, { label: localize(kCellSectionHeadingLabel, kCellSectionHeadingId) }, "heading"));
		for (const item of items) {
			if (groupOfPreviousItem && item.group !== groupOfPreviousItem) rows.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_mui_material_Divider.default, {}, `divider-before-${item.id}`));
			groupOfPreviousItem = item.group;
			if (item.kind === "choice") rows.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChoiceRow, {
				item,
				localize,
				onChosen: () => noteCellChanged((count) => count + 1)
			}, item.id));
			else if (item.kind === "formatControls") {
				if (props.renderFormatControls) rows.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FormatControls, {
					label: localize(item.label, item.id),
					render: props.renderFormatControls
				}, item.id));
			} else rows.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommandRow, {
				item,
				label: localize(item.label, item.id),
				closeMenu: props.closeMenu
			}, item.id));
		}
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: rows });
	};
	/**
	* Draw the component into a plain DOM container, for a menu that is not itself
	* React — the library's own popup. Rendering is flushed, so the caller can measure
	* the container as soon as this returns and position its menu. Call the returned
	* function when the menu closes.
	*/
	function mountCellMenuItems(container, props) {
		const root = (0, react_dom_client.createRoot)(container);
		(0, react_dom.flushSync)(() => {
			root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CellMenuItems, { ...props }));
		});
		return () => {
			setTimeout(() => root.unmount(), 0);
		};
	}
	//#endregion
	//#region src/prepare-for-save.ts
	let paintFormatExiter = () => {};
	function setPaintFormatExiter(fn) {
		paintFormatExiter = fn;
	}
	const kHintColorProps = [
		"--hint-top-color",
		"--hint-right-color",
		"--hint-bottom-color",
		"--hint-left-color"
	];
	function removeTableEditingArtifacts(root = document) {
		paintFormatExiter();
		stripEditTimeMarkup(root);
	}
	/**
	* The markup part of removeTableEditingArtifacts: it rewrites `root`'s DOM and
	* changes no session state, so it is also safe to run on a detached clone.
	*/
	function stripEditTimeMarkup(root) {
		root.querySelectorAll("[data-table-overlay]").forEach((el) => el.remove());
		root.querySelectorAll("body").forEach((b) => b.classList.remove("bloom-paint-format"));
		if (root instanceof Element) root.classList.remove("bloom-paint-format");
		root.querySelectorAll(".bloom-cell").forEach((cell) => {
			kHintColorProps.forEach((p) => cell.style.removeProperty(p));
			cell.classList.remove("cell--selected", "bloom-pulse-fill", "bloom-pulse-border");
		});
		root.querySelectorAll("[data-btable-anchor-name]").forEach((el) => {
			el.style.removeProperty("anchor-name");
			delete el.dataset.btableAnchorName;
		});
		root.querySelectorAll(".bloom-table").forEach((table) => {
			table.classList.remove("table--selected", "bloom-pointer-near", "bloom-current-table");
		});
	}
	/**
	* The HTML of `table` as a save would write it: a copy with every edit-time
	* artifact stripped. Copy Table and Cut Table put this on the clipboard, so a
	* paste does not carry the source table's selection classes, its
	* bloom-current-table mark, or its pointer-proximity class into the document.
	*
	* The live table is never touched (the stripping runs on a clone), and neither
	* is any session state: unlike removeTableEditingArtifacts this does not leave
	* Paint Format mode.
	*/
	function tableMarkupForClipboard(table) {
		const holder = table.ownerDocument.createElement("div");
		holder.appendChild(table.cloneNode(true));
		stripEditTimeMarkup(holder);
		return holder.innerHTML;
	}
	//#endregion
	//#region src/color-utils.ts
	const NAMED_COLORS_SOURCE = "aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32";
	let namedColors;
	function namedColorHex(name) {
		if (!namedColors) {
			namedColors = /* @__PURE__ */ new Map();
			const parts = NAMED_COLORS_SOURCE.split(" ");
			for (let i = 0; i + 1 < parts.length; i += 2) namedColors.set(parts[i], parts[i + 1]);
		}
		return namedColors.get(name);
	}
	function clampChannel(n) {
		if (!Number.isFinite(n)) return 0;
		return Math.max(0, Math.min(255, Math.round(n)));
	}
	/** Parse one number from an rgb()/rgba() argument: a plain 0-255 value or a
	*  percentage of 255. */
	function channelFromToken(token) {
		const t = token.trim();
		if (t.endsWith("%")) return clampChannel(parseFloat(t) / 100 * 255);
		return clampChannel(parseFloat(t));
	}
	/** Parse the alpha argument of rgba(): a 0-1 number or a percentage. */
	function alphaFromToken(token) {
		if (token === void 0) return 1;
		const t = token.trim();
		if (!t || t === "none") return 1;
		const n = t.endsWith("%") ? parseFloat(t) / 100 : parseFloat(t);
		if (!Number.isFinite(n)) return 1;
		return Math.max(0, Math.min(1, n));
	}
	/** Parse a CSS color string into channels plus alpha. Understands #rgb, #rgba,
	*  #rrggbb, #rrggbbaa, rgb()/rgba() in both the comma and the space-separated
	*  syntax, the CSS named colors, and `transparent`. Returns undefined for
	*  anything else (e.g. oklch(), color(), var()). */
	function parseColor(input) {
		if (!input) return void 0;
		const s = input.trim();
		if (!s) return void 0;
		const hex = s.match(/^#([0-9a-f]{3,8})$/i)?.[1];
		if (hex) {
			const expand = (c) => parseInt(c + c, 16);
			if (hex.length === 3 || hex.length === 4) return {
				r: expand(hex[0]),
				g: expand(hex[1]),
				b: expand(hex[2]),
				a: hex.length === 4 ? expand(hex[3]) / 255 : 1
			};
			if (hex.length === 6 || hex.length === 8) {
				const pair = (i) => parseInt(hex.slice(i, i + 2), 16);
				return {
					r: pair(0),
					g: pair(2),
					b: pair(4),
					a: hex.length === 8 ? pair(6) / 255 : 1
				};
			}
			return;
		}
		const m = s.match(/^rgba?\(([^)]*)\)$/i);
		if (m) {
			const tokens = m[1].trim().split(/[\s,/]+/).filter(Boolean);
			if (tokens.length < 3) return void 0;
			return {
				r: channelFromToken(tokens[0]),
				g: channelFromToken(tokens[1]),
				b: channelFromToken(tokens[2]),
				a: alphaFromToken(tokens[3])
			};
		}
		const lower = s.toLowerCase();
		if (lower === "transparent") return {
			r: 0,
			g: 0,
			b: 0,
			a: 0
		};
		const named = namedColorHex(lower);
		if (named) return parseColor("#" + named);
	}
	/** Convert a CSS color string to #rrggbb (alpha, if any, is dropped: the
	*  panel's color inputs can only carry an opaque hex). Falls back to black. */
	function toHexColor(input) {
		const c = parseColor(input);
		if (!c) return "#000000";
		const hx = (n) => n.toString(16).padStart(2, "0");
		return `#${hx(c.r)}${hx(c.g)}${hx(c.b)}`;
	}
	/** True if this computed side would actually paint: a style other than "none"/
	*  "hidden", a non-zero width, and a color that isn't fully transparent. */
	function sidePaints(style, width, color) {
		if (!style || style === "none" || style === "hidden") return false;
		if (width) {
			const w = parseFloat(width);
			if (Number.isFinite(w) && w <= 0) return false;
		}
		const parsed = parseColor(color);
		if (parsed && parsed.a === 0) return false;
		return true;
	}
	/** Representative border color of an element: the first side that actually
	*  paints (a real style, a non-zero width, and a color that isn't fully
	*  transparent), else the top side. Returned as #rrggbb. */
	function representativeBorderColorHex(el) {
		const cs = getComputedStyle(el);
		for (const [styleProp, widthProp, colorProp] of [
			[
				"borderTopStyle",
				"borderTopWidth",
				"borderTopColor"
			],
			[
				"borderRightStyle",
				"borderRightWidth",
				"borderRightColor"
			],
			[
				"borderBottomStyle",
				"borderBottomWidth",
				"borderBottomColor"
			],
			[
				"borderLeftStyle",
				"borderLeftWidth",
				"borderLeftColor"
			]
		]) {
			const style = cs[styleProp];
			const width = cs[widthProp];
			const color = cs[colorProp];
			if (sidePaints(style, width, color)) return toHexColor(color);
		}
		return toHexColor(cs.borderTopColor);
	}
	//#endregion
	//#region src/border-state.ts
	const snapWeight = (w) => {
		if (w <= 0) return 0;
		if (w < 1.5) return 1;
		if (w < 3) return 2;
		return 4;
	};
	const isPaintedSpec = (spec) => !!spec && spec.style !== "none" && Number(spec.weight) > 0;
	/** RESOLVED outer/inner border values for the table panel. Stored edge
	*  entries are tri-state — explicitly painted, explicitly none (weight 0),
	*  or never set (null: renders with the table default and follows later
	*  default edits) — but this map collapses the last state: a never-set edge
	*  reports the default value it currently renders with, indistinguishable
	*  from an edge somebody explicitly set to that value. The edge-utils writers
	*  compensate: writing a value a never-set entry already renders via the
	*  default leaves the entry unset, so reading this map and writing it back
	*  unchanged does not freeze inheriting edges at today's default. */
	function getTableOuterBorderValueMap(table) {
		const model = buildRenderModel(table);
		const rows = model.rowHeights.length;
		const cols = model.columnWidths.length;
		const idx = (r, c) => r * Math.max(1, cols) + c;
		const safe = (v, d) => v == null ? d : v;
		const topLeft = model.cellBorders[idx(0, 0)] || {};
		const topRight = model.cellBorders[idx(0, Math.max(0, cols - 1))] || {};
		const bottomLeft = model.cellBorders[idx(Math.max(0, rows - 1), 0)] || {};
		const toOuter = (spec) => {
			const w = snapWeight(Number.isFinite(spec?.weight) ? spec.weight : 0);
			let style;
			if (w === 0) style = "none";
			else if (spec?.style) style = spec.style;
			else style = EDGE_DEFAULT.style;
			return {
				weight: w,
				style
			};
		};
		const boundary = (a, b) => {
			if (isPaintedSpec(a)) return a;
			if (isPaintedSpec(b)) return b;
			return a ?? b ?? null;
		};
		const sampleInner = (kind) => {
			const specs = [];
			if (kind === "H") for (let r = 0; r + 1 < rows; r++) for (let c = 0; c < cols; c++) specs.push(boundary(model.cellBorders[idx(r, c)]?.bottom, model.cellBorders[idx(r + 1, c)]?.top));
			else for (let r = 0; r < rows; r++) for (let c = 0; c + 1 < cols; c++) specs.push(boundary(model.cellBorders[idx(r, c)]?.right, model.cellBorders[idx(r, c + 1)]?.left));
			const painted = specs.find(isPaintedSpec);
			if (painted) return painted;
			if (specs.some((s) => s != null)) return {
				weight: 0,
				style: "none"
			};
			const dflt = resolveEdgeDefault(table);
			return dflt ? {
				weight: dflt.weight,
				style: dflt.style
			} : {
				weight: 0,
				style: "none"
			};
		};
		return {
			top: {
				...toOuter(safe(topLeft.top, null)),
				radius: 0
			},
			right: {
				...toOuter(safe(topRight.right, null)),
				radius: 0
			},
			bottom: {
				...toOuter(safe(bottomLeft.bottom, null)),
				radius: 0
			},
			left: {
				...toOuter(safe(topLeft.left, null)),
				radius: 0
			},
			innerH: {
				...toOuter(sampleInner("H")),
				radius: 0
			},
			innerV: {
				...toOuter(sampleInner("V")),
				radius: 0
			}
		};
	}
	function resolveCellPerimeterSpecs(cell) {
		const table = cell.closest(".bloom-table");
		if (!table) return null;
		const model = buildRenderModel(table);
		const index = getTableCells(table).indexOf(cell);
		const rows = model.rowHeights.length;
		const cols = model.columnWidths.length;
		const r = Math.floor(index / Math.max(1, cols));
		const c = index % Math.max(1, cols);
		const inBounds = (rr, cc) => rr >= 0 && cc >= 0 && rr < rows && cc < cols;
		const idx = (rr, cc) => rr * Math.max(1, cols) + cc;
		const sides = model.cellBorders[index] || {};
		return {
			top: sides.top ?? (inBounds(r - 1, c) ? model.cellBorders[idx(r - 1, c)]?.bottom ?? null : null),
			right: sides.right ?? (inBounds(r, c + 1) ? model.cellBorders[idx(r, c + 1)]?.left ?? null : null),
			bottom: sides.bottom ?? (inBounds(r + 1, c) ? model.cellBorders[idx(r + 1, c)]?.top ?? null : null),
			left: sides.left ?? (inBounds(r, c - 1) ? model.cellBorders[idx(r, c - 1)]?.right ?? null : null)
		};
	}
	/** RESOLVED values for a cell's four perimeter edges (inner keys are stubbed
	*  to none — a single cell has no interior). Like the table map above, this
	*  collapses the stored tri-state: a never-set edge reports the table default
	*  it currently renders with, and an edge this cell explicitly declined
	*  (weight 0 / 'none') reports plain none. Callers writing the map back rely
	*  on applyCellPerimeter's guard to keep never-set entries unset when the
	*  value round-trips unchanged. */
	function getCellPerimeterValueMap(cell) {
		const specs = resolveCellPerimeterSpecs(cell);
		if (!specs) return {
			top: {
				weight: 0,
				style: "none",
				radius: 0
			},
			right: {
				weight: 0,
				style: "none",
				radius: 0
			},
			bottom: {
				weight: 0,
				style: "none",
				radius: 0
			},
			left: {
				weight: 0,
				style: "none",
				radius: 0
			},
			innerH: {
				weight: 0,
				style: "none",
				radius: 0
			},
			innerV: {
				weight: 0,
				style: "none",
				radius: 0
			}
		};
		const toOuter = (spec) => {
			const w = snapWeight(Number.isFinite(spec?.weight) ? spec.weight : 0);
			let style;
			if (w === 0) style = "none";
			else if (spec?.style) style = spec.style;
			else style = EDGE_DEFAULT.style;
			return {
				weight: w,
				style
			};
		};
		return {
			top: {
				...toOuter(specs.top),
				radius: 0
			},
			right: {
				...toOuter(specs.right),
				radius: 0
			},
			bottom: {
				...toOuter(specs.bottom),
				radius: 0
			},
			left: {
				...toOuter(specs.left),
				radius: 0
			},
			innerH: {
				weight: 0,
				style: "none",
				radius: 0
			},
			innerV: {
				weight: 0,
				style: "none",
				radius: 0
			}
		};
	}
	/** A cell's own painted sides from the render model, with NO borrowing of
	*  neighbor-owned strokes: a side the cell doesn't paint (unset, lost to the
	*  neighbor, or explicitly declined) resolves to a 'none' edge. This is what
	*  copy-properties wants — pasting these claims reproduces the source's look,
	*  because paste's sided none-writes keep the target's neighbors' lines while
	*  visible sides claim the shared edge. (The borrowing value map above would
	*  capture a neighbor's stroke as if it were this cell's border and, pasted
	*  at a table edge, invent a perimeter line the source never painted.) */
	function getCellOwnPerimeter(cell) {
		const table = cell.closest(".bloom-table");
		let sides = {};
		if (table) {
			const model = buildRenderModel(table);
			const index = getTableCells(table).indexOf(cell);
			sides = model.cellBorders[index] || {};
		}
		const toEdge = (spec) => {
			const w = snapWeight(Number.isFinite(spec?.weight) ? spec.weight : 0);
			return {
				weight: w,
				style: w === 0 ? "none" : spec?.style ?? "solid",
				color: spec && typeof spec.color === "string" && spec.color ? spec.color : null
			};
		};
		return {
			top: toEdge(sides.top),
			right: toEdge(sides.right),
			bottom: toEdge(sides.bottom),
			left: toEdge(sides.left)
		};
	}
	/** Per-edge colors of a cell's perimeter, resolved the same way as
	*  getCellPerimeterValueMap. An edge with no explicit color (or an invisible
	*  edge) yields null, so callers can fall back per edge instead of flattening
	*  a multi-colored perimeter to one color. */
	function getCellPerimeterColors(cell) {
		const specs = resolveCellPerimeterSpecs(cell);
		const isVisible = (spec) => !!spec && spec.style !== "none" && Number(spec.weight) > 0;
		const colorOf = (spec) => isVisible(spec) && typeof spec.color === "string" && spec.color ? spec.color : null;
		return {
			top: colorOf(specs?.top),
			right: colorOf(specs?.right),
			bottom: colorOf(specs?.bottom),
			left: colorOf(specs?.left)
		};
	}
	//#endregion
	//#region src/components/BorderControl/logic/normalize.ts
	/**
	* Apply a weight/style change to one edge, keeping the two consistent.
	*
	* The rules (shared by every edit path, so the toolbar and the Borders panel
	* cannot disagree):
	*  - setting style "none" zeroes the weight;
	*  - setting a real style on an invisible (weight 0) edge makes it 1px;
	*  - setting weight 0 turns the style off;
	*  - setting a real weight on a style-less edge makes it solid.
	* A change that names both weight and style is taken as given, except that the
	* style rules still win (that is what the toolbar has always done).
	*/
	function normalizeEdgeChange(current, change) {
		let weight = change.weight ?? current.weight;
		let style = change.style ?? current.style;
		if (change.style !== void 0) {
			if (change.style === "none") weight = 0;
			else if (weight === 0) weight = 1;
		} else if (change.weight !== void 0) {
			if (change.weight === 0) style = "none";
			else if (style === "none") style = "solid";
		}
		return {
			weight,
			style
		};
	}
	//#endregion
	//#region src/edge-utils.ts
	const toSpec = (u, fallbackColor = "#444") => {
		if (!u) return null;
		const color = u.color ?? fallbackColor;
		if (u.weight <= 0 || u.style === "none") return {
			weight: 0,
			style: "none",
			color
		};
		return {
			weight: u.weight,
			style: u.style,
			color
		};
	};
	const colorsEqual = (a, b) => {
		if ((a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase()) return true;
		const pa = parseColor(a);
		const pb = parseColor(b);
		return !!pa && !!pb && pa.r === pb.r && pa.g === pb.g && pa.b === pb.b && pa.a === pb.a;
	};
	const isUnsetEntry = (e) => {
		if (e == null) return true;
		if (isBorderSpec(e)) return false;
		const s = e;
		return s.west == null && s.east == null && s.north == null && s.south == null;
	};
	const specMatchesDefault = (spec, dflt) => {
		const invisible = (s) => !s || s.weight <= 0 || s.style === "none";
		if (invisible(spec) || invisible(dflt)) return invisible(spec) && invisible(dflt);
		return spec.weight === dflt.weight && spec.style === dflt.style && colorsEqual(spec.color, dflt.color);
	};
	function getTableSize(table) {
		return {
			rows: getRowHeights(table).length,
			cols: getColumnWidths(table).length
		};
	}
	function ensureEdgesArrays(table) {
		const { rows, cols } = getTableSize(table);
		let v = getEdgesV(table) ?? [];
		while (v.length < rows) v.push([]);
		for (let r = 0; r < rows; r++) {
			while ((v[r] ?? (v[r] = [])).length < cols + 1) v[r].push({});
			v[r] = v[r].slice(0, cols + 1);
		}
		v = v.slice(0, rows);
		setEdgesV(table, v);
		let h = getEdgesH(table) ?? [];
		while (h.length < rows + 1) h.push([]);
		for (let r = 0; r < rows + 1; r++) {
			while ((h[r] ?? (h[r] = [])).length < cols) h[r].push({});
			h[r] = h[r].slice(0, cols);
		}
		h = h.slice(0, rows + 1);
		setEdgesH(table, h);
	}
	function applyOuterBorders(table, borders, colorFallback = "#000") {
		ensureEdgesArrays(table);
		const { rows, cols } = getTableSize(table);
		const dflt = resolveEdgeDefault(table);
		const canInherit = !isNestedTable$1(table);
		const h = getEdgesH(table) ?? [];
		const v = getEdgesV(table) ?? [];
		if (borders.top !== void 0) {
			const spec = toSpec(borders.top, colorFallback);
			const keep = canInherit && specMatchesDefault(spec, dflt);
			for (let c = 0; c < cols; c++) if (!(keep && isUnsetEntry(h[0][c]))) h[0][c] = spec;
		}
		if (borders.bottom !== void 0) {
			const spec = toSpec(borders.bottom, colorFallback);
			const keep = canInherit && specMatchesDefault(spec, dflt);
			for (let c = 0; c < cols; c++) if (!(keep && isUnsetEntry(h[rows][c]))) h[rows][c] = spec;
		}
		if (borders.left !== void 0) {
			const spec = toSpec(borders.left, colorFallback);
			const keep = canInherit && specMatchesDefault(spec, dflt);
			for (let r = 0; r < rows; r++) if (!(keep && isUnsetEntry(v[r][0]))) v[r][0] = spec;
		}
		if (borders.right !== void 0) {
			const spec = toSpec(borders.right, colorFallback);
			const keep = canInherit && specMatchesDefault(spec, dflt);
			for (let r = 0; r < rows; r++) if (!(keep && isUnsetEntry(v[r][cols]))) v[r][cols] = spec;
		}
		setEdgesH(table, h);
		setEdgesV(table, v);
	}
	function applyUniformInner(table, kind, border, colorFallback = "#444") {
		ensureEdgesArrays(table);
		const { rows, cols } = getTableSize(table);
		const spec = toSpec(border, colorFallback);
		const specIsDefault = specMatchesDefault(spec, resolveEdgeDefault(table));
		const keep = (entry) => specIsDefault && isUnsetEntry(entry);
		if (kind === "innerV") {
			const v = getEdgesV(table) ?? [];
			for (let r = 0; r < rows; r++) for (let c = 1; c <= Math.max(0, cols - 1); c++) if (!keep(v[r][c])) v[r][c] = spec;
			setEdgesV(table, v);
		} else {
			const h = getEdgesH(table) ?? [];
			for (let r = 1; r <= Math.max(0, rows - 1); r++) for (let c = 0; c < cols; c++) if (!keep(h[r][c])) h[r][c] = spec;
			setEdgesH(table, h);
		}
	}
	function setDefaultBorder(table, border, colorFallback = "#444") {
		setEdgeDefault(table, toSpec(border, colorFallback));
	}
	function applyCellPerimeter(table, cell, map, outerColorFallback = "#000", innerColorFallback = "#444") {
		ensureEdgesArrays(table);
		const { rows, cols } = getTableSize(table);
		const idx = getTableCells(table).indexOf(cell);
		if (idx < 0) return;
		const r = Math.floor(idx / Math.max(1, cols));
		const c = idx % Math.max(1, cols);
		const span = getSpan(cell);
		const sx = Math.max(1, span.x);
		const sy = Math.max(1, span.y);
		const v = getEdgesV(table) ?? [];
		const h = getEdgesH(table) ?? [];
		const gapX = getGapX(table);
		const gapY = getGapY(table);
		const isRemoval = (spec) => !!spec && spec.weight === 0;
		const dflt = () => resolveEdgeDefault(table);
		const currentDefault = resolveEdgeDefault(table);
		const keepUnset = (entry, spec) => isUnsetEntry(entry) && specMatchesDefault(spec, currentDefault);
		const perimeterCanInherit = !isNestedTable$1(table);
		const keepUnsetOuter = (entry, spec) => perimeterCanInherit && keepUnset(entry, spec);
		if (map.left !== void 0) {
			const innerSpec = toSpec(map.left, innerColorFallback);
			const outerSpec = toSpec(map.left, outerColorFallback);
			for (let rr = r; rr < Math.min(r + sy, v.length); rr++) if (c === 0) {
				if (!keepUnsetOuter(v[rr][0], outerSpec)) v[rr][0] = outerSpec;
			} else if (hasPositiveGap(gapX, c - 1)) v[rr][c] = {
				west: splitV(v[rr][c]).west,
				east: innerSpec
			};
			else if (isRemoval(innerSpec)) v[rr][c] = {
				west: splitV(v[rr][c]).west ?? dflt(),
				east: innerSpec
			};
			else if (!keepUnset(v[rr][c], innerSpec)) v[rr][c] = innerSpec;
		}
		if (map.right !== void 0) {
			const innerSpec = toSpec(map.right, innerColorFallback);
			const outerSpec = toSpec(map.right, outerColorFallback);
			const rc = c + sx - 1;
			for (let rr = r; rr < Math.min(r + sy, v.length); rr++) if (rc === cols - 1) {
				if (!keepUnsetOuter(v[rr][cols], outerSpec)) v[rr][cols] = outerSpec;
			} else if (hasPositiveGap(gapX, rc)) v[rr][rc + 1] = {
				west: innerSpec,
				east: splitV(v[rr][rc + 1]).east
			};
			else if (isRemoval(innerSpec)) v[rr][rc + 1] = {
				west: innerSpec,
				east: splitV(v[rr][rc + 1]).east ?? dflt()
			};
			else if (!keepUnset(v[rr][rc + 1], innerSpec)) v[rr][rc + 1] = innerSpec;
		}
		if (map.top !== void 0) {
			const innerSpec = toSpec(map.top, innerColorFallback);
			const outerSpec = toSpec(map.top, outerColorFallback);
			const boundaryRow = r === 0 ? 0 : r;
			for (let cc = c; cc < Math.min(c + sx, h[boundaryRow]?.length ?? 0); cc++) if (r === 0) {
				if (!keepUnsetOuter(h[0][cc], outerSpec)) h[0][cc] = outerSpec;
			} else if (hasPositiveGap(gapY, r - 1)) h[boundaryRow][cc] = {
				north: splitH(h[boundaryRow][cc]).north,
				south: innerSpec
			};
			else if (isRemoval(innerSpec)) h[boundaryRow][cc] = {
				north: splitH(h[boundaryRow][cc]).north ?? dflt(),
				south: innerSpec
			};
			else if (!keepUnset(h[boundaryRow][cc], innerSpec)) h[boundaryRow][cc] = innerSpec;
		}
		if (map.bottom !== void 0) {
			const innerSpec = toSpec(map.bottom, innerColorFallback);
			const outerSpec = toSpec(map.bottom, outerColorFallback);
			const rrBottom = r + sy - 1;
			const boundaryRow = rrBottom === rows - 1 ? rows : rrBottom + 1;
			for (let cc = c; cc < Math.min(c + sx, h[boundaryRow]?.length ?? 0); cc++) if (rrBottom === rows - 1) {
				if (!keepUnsetOuter(h[boundaryRow][cc], outerSpec)) h[boundaryRow][cc] = outerSpec;
			} else if (hasPositiveGap(gapY, rrBottom)) h[boundaryRow][cc] = {
				north: innerSpec,
				south: splitH(h[boundaryRow][cc]).south
			};
			else if (isRemoval(innerSpec)) h[boundaryRow][cc] = {
				north: innerSpec,
				south: splitH(h[boundaryRow][cc]).south ?? dflt()
			};
			else if (!keepUnset(h[boundaryRow][cc], innerSpec)) h[boundaryRow][cc] = innerSpec;
		}
		setEdgesV(table, v);
		setEdgesH(table, h);
	}
	//#endregion
	//#region src/formatting-commands.ts
	const tableCells$1 = (table) => Array.from(table.children).filter((c) => c instanceof HTMLElement && c.classList.contains("bloom-cell") && !c.classList.contains("bloom-skip"));
	function withHistory(table, label, detail, op) {
		tableHistoryManager.addHistoryEntry(table, {
			label,
			detail
		}, op);
	}
	/** The cells a formatting command targets: the given cell, its row, its
	*  column, or every cell in the table. A spanning cell belongs to every row
	*  and column it covers. Row/column/cell scopes need a reference cell; without
	*  one they resolve to no cells. */
	function getCellsInScope(table, scope, cell) {
		const cells = tableCells$1(table);
		if (scope === "table") return cells;
		if (!cell) return [];
		if (scope === "cell") return cells.includes(cell) ? [cell] : [];
		const grid = buildGrid(table);
		const target = grid.posOf.get(cell);
		if (!target) return [];
		return cells.filter((c) => {
			const pos = grid.posOf.get(c);
			if (!pos) return false;
			const span = getSpan(c);
			return scope === "row" ? target.row >= pos.row && target.row < pos.row + Math.max(1, span.y) : target.column >= pos.column && target.column < pos.column + Math.max(1, span.x);
		});
	}
	function applyContentType(table, scope, cells, contentTypeId) {
		const wasDifferent = cells.filter((c) => getExistingContentTypeId(c) !== contentTypeId);
		withHistory(table, "Change Content Type", `${contentTypeId}, ${describeTarget(table, scope, cells)}`, () => {
			for (const c of cells) setupContentsOfCell(c, contentTypeId, false, false);
			render(table);
		});
		for (const c of wasDifferent) if (c.dataset.contentType === contentTypeId) dispatchCellContentChanged(c, contentTypeId);
	}
	function applyAlignment(table, scope, cells, align) {
		withHistory(table, "Set Alignment", `${align}, ${describeTarget(table, scope, cells)}`, () => {
			for (const c of cells) setCellAlign(c, align);
			render(table);
		});
	}
	function applyPadding(table, scope, cells, px) {
		withHistory(table, "Set Padding", `${px}px, ${describeTarget(table, scope, cells)}`, () => {
			for (const c of cells) setCellPadding(c, `${px}px`);
			render(table);
		});
	}
	function applyCorners(table, scope, cells, radius) {
		withHistory(table, "Set Corners", `radius ${radius}, ${describeTarget(table, scope, cells)}`, () => {
			for (const c of cells) setCellCorners(c, radius ? { radius } : null);
			render(table);
		});
	}
	/** Fill colors the cells themselves; null clears back to the stylesheet
	*  default. Table scope also clears any container color: the container div is
	*  sized larger than the cells, so its color would bleed outside the table. */
	function applyFill(table, scope, cells, color) {
		withHistory(table, "Set Fill", `${color || "cleared"}, ${describeTarget(table, scope, cells)}`, () => {
			if (scope === "table") setTableBackground(table, null);
			for (const c of cells) setCellBackground(c, color || null);
			render(table);
		});
	}
	function describeBorderProps(props) {
		const parts = [];
		if (props.color) parts.push(`color ${props.color}`);
		if (props.style) parts.push(`style ${props.style}`);
		if (props.weight !== void 0) parts.push(`weight ${props.weight}`);
		return parts.join(", ");
	}
	function resolveEdge(current, props, color) {
		const { weight, style } = normalizeEdgeChange(current, {
			weight: props.weight,
			style: props.style
		});
		return {
			weight,
			style,
			color
		};
	}
	/** Change border color / style / weight while preserving whatever isn't being
	*  set. Cell/row/column scopes re-write each target cell's perimeter; table
	*  scope re-writes the outer, inner, and default borders so newly added rows
	*  and columns pick up the change too.
	*
	*  Tri-state note: the value maps read here are RESOLVED. In storage an edge
	*  entry is either explicitly painted, explicitly none (weight 0), or never
	*  set — a never-set entry renders with the table default and follows later
	*  default edits, which the maps cannot show (they report the default value
	*  itself). Writing the resolved values back is still safe: the edge-utils
	*  writers skip stamping a never-set entry whose new value renders exactly
	*  like the current default, so a round-trip that changes nothing (or changes
	*  a value to what the default already paints) leaves inheriting edges
	*  inheriting instead of freezing them at today's default. */
	function applyBorderProps(table, scope, cells, props) {
		const changed = describeBorderProps(props);
		if (scope === "table") {
			withHistory(table, "Change Border", changed ? `${changed}, ${kWholeTableTarget}` : kWholeTableTarget, () => {
				const base = getTableOuterBorderValueMap(table);
				const firstCell = cells[0] ?? tableCells$1(table)[0];
				const color = props.color ?? (firstCell ? representativeBorderColorHex(firstCell) : "#000000");
				const side = (s) => resolveEdge(s, props, color);
				setDefaultBorder(table, side(base.innerH), color);
				applyOuterBorders(table, {
					top: side(base.top),
					right: side(base.right),
					bottom: side(base.bottom),
					left: side(base.left)
				}, color);
				applyUniformInner(table, "innerH", side(base.innerH), color);
				applyUniformInner(table, "innerV", side(base.innerV), color);
				render(table);
			});
			return;
		}
		const target = describeTarget(table, scope, cells);
		withHistory(table, "Change Border", changed ? `${changed}, ${target}` : target, () => {
			const snapshots = cells.map((c) => ({
				map: getCellPerimeterValueMap(c),
				colors: getCellPerimeterColors(c),
				fallback: props.color ?? representativeBorderColorHex(c)
			}));
			cells.forEach((c, i) => {
				const { map, colors, fallback } = snapshots[i];
				const edgeColor = (current) => props.color ?? current ?? fallback;
				applyCellPerimeter(table, c, {
					top: resolveEdge(map.top, props, edgeColor(colors.top)),
					right: resolveEdge(map.right, props, edgeColor(colors.right)),
					bottom: resolveEdge(map.bottom, props, edgeColor(colors.bottom)),
					left: resolveEdge(map.left, props, edgeColor(colors.left))
				});
			});
			render(table);
		});
	}
	function applyBorderColor(table, scope, cells, color) {
		applyBorderProps(table, scope, cells, { color });
	}
	/** The size of the line `cell` sits in, for a row or column scope. Null for
	*  the cell and table scopes, and when the size list is too short to name the
	*  line (a table may declare fewer sizes than it has lines). */
	function snapshotLineSize(table, scope, cell) {
		if (!cell || scope !== "row" && scope !== "column") return null;
		const pos = buildGrid(table).posOf.get(cell);
		if (!pos) return null;
		const sizes = scope === "row" ? getRowHeights(table) : getColumnWidths(table);
		const index = scope === "row" ? pos.row : pos.column;
		if (index < 0 || index >= sizes.length) return null;
		return {
			axis: scope,
			size: sizes[index]
		};
	}
	/** Write a line size onto the line that `cell` sits in. The caller runs this
	*  inside its own history entry, and renders afterwards. */
	function applyLineSize(table, cell, line) {
		const pos = buildGrid(table).posOf.get(cell);
		if (!pos) return;
		const sizes = line.axis === "row" ? getRowHeights(table) : getColumnWidths(table);
		const index = line.axis === "row" ? pos.row : pos.column;
		if (index < 0 || index >= sizes.length) return;
		sizes[index] = line.size;
		if (line.axis === "row") setRowHeights(table, sizes);
		else setColumnWidths(table, sizes);
	}
	let copiedProperties = null;
	function hasCopiedProperties() {
		return copiedProperties !== null;
	}
	/** Snapshot one cell's paintable properties: the shared CellSettings record
	*  plus its OWN painted perimeter (no borrowing of neighbor-owned strokes —
	*  copying a borderless cell that sits next to bordered neighbors must paste
	*  as borderless, not smuggle the neighbors' lines along). */
	function snapshotCellProperties(cell) {
		const own = getCellOwnPerimeter(cell);
		const fallback = representativeBorderColorHex(cell);
		const edge = (e) => ({
			weight: e.weight,
			style: e.style,
			color: e.color ?? fallback
		});
		return {
			settings: snapshotCellSettings(cell),
			border: {
				top: edge(own.top),
				right: edge(own.right),
				bottom: edge(own.bottom),
				left: edge(own.left)
			}
		};
	}
	/** Snapshot the properties of the scope's first cell. Returns the snapshot
	*  (also kept as the active clipboard), or null when the scope is empty. */
	function copyProperties(cells) {
		const seed = cells[0];
		if (!seed) return null;
		copiedProperties = snapshotCellProperties(seed);
		return copiedProperties;
	}
	function stampProperties(table, scope, cells, propsFor, label, lineSize) {
		if (!cells.length) return;
		const wasDifferent = [];
		cells.forEach((c, i) => {
			const t = propsFor(i).settings.contentType;
			if (t && getExistingContentTypeId(c) !== t) wasDifferent.push([c, t]);
		});
		withHistory(table, label, describeTarget(table, scope, cells), () => {
			cells.forEach((c, i) => {
				const p = propsFor(i);
				applyCellSettings(c, p.settings);
				applyCellPerimeter(table, c, {
					top: { ...p.border.top },
					right: { ...p.border.right },
					bottom: { ...p.border.bottom },
					left: { ...p.border.left }
				});
			});
			if (lineSize) applyLineSize(table, cells[0], lineSize);
			render(table);
		});
		for (const [c, t] of wasDifferent) if (c.dataset.contentType === t) dispatchCellContentChanged(c, t);
	}
	/** Stamp the copied properties onto every cell in the target scope. No-op
	*  when nothing has been copied. */
	function pasteProperties(table, scope, cells) {
		const p = copiedProperties;
		if (!p) return;
		stampProperties(table, scope, cells, () => p, "Paste Properties");
	}
	/** Paint-format stamping: apply a per-cell pattern (the snapshots of the
	*  source scope's cells, in order) onto the target cells, mapping by index
	*  and cycling when the target is longer — an A-B-A-B source column keeps
	*  alternating across a longer target. Truncates when the target is shorter. */
	function paintProperties(table, scope, cells, pattern, lineSize) {
		if (!pattern.length) return;
		stampProperties(table, scope, cells, (i) => pattern[i % pattern.length], "Paint Format", lineSize);
	}
	function applyBorderStyle(table, scope, cells, style) {
		applyBorderProps(table, scope, cells, { style });
	}
	function applyBorderWeight(table, scope, cells, weight) {
		applyBorderProps(table, scope, cells, { weight });
	}
	//#endregion
	//#region src/pulse-highlight.ts
	const OVERLAY_CLASS = "bloom-sel-overlay";
	function docOf(ref) {
		return ref?.ownerDocument ?? document;
	}
	/** Remove every highlight overlay from the document that owns `ref`. */
	function clearPulse(ref) {
		docOf(ref).querySelectorAll(`.${OVERLAY_CLASS}`).forEach((el) => el.remove());
	}
	function activeCells(table) {
		return getTableCells(table).filter((c) => !c.classList.contains("bloom-skip"));
	}
	function spanX(cell) {
		return Math.max(1, parseInt(cell.getAttribute("data-span-x") || "1", 10) || 1);
	}
	function spanY(cell) {
		return Math.max(1, parseInt(cell.getAttribute("data-span-y") || "1", 10) || 1);
	}
	function addRegionOverlay(cells) {
		if (!cells.length) return;
		const doc = cells[0].ownerDocument;
		const win = doc.defaultView ?? window;
		let left = Infinity;
		let top = Infinity;
		let right = -Infinity;
		let bottom = -Infinity;
		for (const c of cells) {
			const r = c.getBoundingClientRect();
			if (!r.width && !r.height) continue;
			left = Math.min(left, r.left);
			top = Math.min(top, r.top);
			right = Math.max(right, r.right);
			bottom = Math.max(bottom, r.bottom);
		}
		if (!Number.isFinite(left)) return;
		const overlay = doc.createElement("div");
		overlay.className = OVERLAY_CLASS;
		overlay.setAttribute("data-table-overlay", "");
		const s = overlay.style;
		s.position = "absolute";
		s.left = `${left + win.scrollX}px`;
		s.top = `${top + win.scrollY}px`;
		s.width = `${right - left}px`;
		s.height = `${bottom - top}px`;
		s.pointerEvents = "none";
		doc.body.appendChild(overlay);
	}
	/** Highlight the whole table. */
	function pulseTableBorders(table) {
		if (!table) return;
		clearPulse(table);
		addRegionOverlay(activeCells(table));
	}
	/** Highlight the row that `currentCell` sits in (span-aware). */
	function pulseRow(table, currentCell) {
		if (!table || !currentCell) return;
		clearPulse(table);
		let target;
		try {
			target = getRowAndColumn(table, currentCell).row;
		} catch {
			return;
		}
		addRegionOverlay(activeCells(table).filter((c) => {
			const { row } = getRowAndColumn(table, c);
			return target >= row && target < row + spanY(c);
		}));
	}
	/** Highlight the column that `currentCell` sits in (span-aware). */
	function pulseColumn(table, currentCell) {
		if (!table || !currentCell) return;
		clearPulse(table);
		let target;
		try {
			target = getRowAndColumn(table, currentCell).column;
		} catch {
			return;
		}
		addRegionOverlay(activeCells(table).filter((c) => {
			const { column } = getRowAndColumn(table, c);
			return target >= column && target < column + spanX(c);
		}));
	}
	/** Highlight a single cell. */
	function pulseCell(cell) {
		if (!cell) return;
		clearPulse(cell);
		addRegionOverlay([cell]);
	}
	/** Highlight a single cell (alias kept for the borders/corners controls). */
	function pulseCellBorders(cell) {
		pulseCell(cell);
	}
	//#endregion
	//#region src/paint-format.ts
	let paintMode = null;
	function isPaintFormatModeActive() {
		return !!paintMode;
	}
	let overlayHider = () => {};
	function setPaintFormatOverlayHider(fn) {
		overlayHider = fn;
	}
	const kPaintCursorUrl = `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'><path d='${kPaintRollerPath}' fill='%23222' stroke='%23fff' stroke-width='0.75'/></svg>") 4 4, copy`;
	const kPaintStyleTag = "paint-format-style";
	function ensurePaintFormatStyle() {
		if (document.head.querySelector(`style[data-table-overlay="${kPaintStyleTag}"]`)) return;
		const style = document.createElement("style");
		style.setAttribute("data-table-overlay", kPaintStyleTag);
		style.textContent = `
    body.bloom-paint-format, body.bloom-paint-format * { cursor: ${kPaintCursorUrl} !important; }
    body.bloom-paint-format .bloom-paint-format-badge, body.bloom-paint-format .bloom-paint-format-badge * { cursor: pointer !important; }
    .bloom-paint-format-badge { transition: background-color 120ms, border-color 120ms, box-shadow 120ms; }
    .bloom-paint-format-badge:hover { background: #f2f2f2 !important; border-color: #888 !important; box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important; }
    .bloom-paint-format-badge:active { background: #e4e4e4 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.3) !important; }
  `;
		document.head.appendChild(style);
	}
	function makePaintFormatBadge() {
		const badge = document.createElement("div");
		badge.className = "bloom-paint-format-badge";
		badge.setAttribute("data-table-overlay", "paint-format-badge");
		badge.title = "End format painting (Esc)";
		badge.setAttribute("role", "button");
		badge.setAttribute("aria-label", "End format painting");
		Object.assign(badge.style, {
			position: "absolute",
			height: "28px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			gap: "6px",
			padding: "0 10px",
			background: "#fff",
			border: "1px solid #bbb",
			borderRadius: "6px",
			boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
			zIndex: "2147483647",
			boxSizing: "border-box",
			font: "13px/1 system-ui, sans-serif",
			color: "#222",
			whiteSpace: "nowrap"
		});
		badge.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" style="display:block;flex:none"><path d="${kPaintRollerPath}" fill="#444"/><line x1="3" y1="3" x2="21" y2="21" stroke="#d32f2f" stroke-width="2.5" stroke-linecap="round"/></svg><span>End format painting</span>`;
		badge.addEventListener("mousedown", (e) => e.preventDefault());
		badge.addEventListener("click", (e) => {
			e.stopPropagation();
			exitPaintFormatMode();
		});
		return badge;
	}
	function positionPaintBadge() {
		if (!paintMode) return;
		if (!document.body.contains(paintMode.table)) {
			exitPaintFormatMode();
			return;
		}
		const rect = paintMode.table.getBoundingClientRect();
		const height = paintMode.badge.getBoundingClientRect().height || 28;
		const margin = 4;
		const left = Math.max(0, window.scrollX + rect.left);
		const top = Math.max(0, window.scrollY + rect.top - height - margin);
		paintMode.badge.style.left = `${left}px`;
		paintMode.badge.style.top = `${top}px`;
	}
	function onPaintPointerDown(e) {
		if (!paintMode) return;
		const target = e.target;
		if (!target || !(target instanceof Element)) return;
		if (paintMode.badge.contains(target)) return;
		const cell = target.closest?.(".bloom-cell");
		const table = cell?.closest(".bloom-table");
		if (!cell || !table) {
			if (e.type === "pointerdown") exitPaintFormatMode();
			return;
		}
		if (cell.classList.contains("bloom-skip")) return;
		e.preventDefault();
		e.stopPropagation();
		if (e.type !== "pointerdown") return;
		const button = e.button;
		if (typeof button === "number" && button !== 0) return;
		const targets = paintMode.scope === "cell" ? [cell] : getCellsInScope(table, paintMode.scope, cell);
		paintProperties(table, paintMode.scope, targets, paintMode.pattern, paintMode.lineSize);
		positionPaintBadge();
		showPaintTargetHighlight(cell, table);
	}
	let highlightedCell = null;
	function showPaintTargetHighlight(cell, table) {
		if (!paintMode) return;
		highlightedCell = cell;
		if (paintMode.scope === "row") pulseRow(table, cell);
		else if (paintMode.scope === "column") pulseColumn(table, cell);
		else pulseCell(cell);
	}
	function clearPaintTargetHighlight() {
		if (!highlightedCell) return;
		clearPulse(highlightedCell);
		highlightedCell = null;
	}
	function onPaintPointerMove(e) {
		if (!paintMode) return;
		const target = e.target;
		if (!target || !(target instanceof Element)) return;
		if (paintMode.badge.contains(target)) {
			clearPaintTargetHighlight();
			return;
		}
		const cell = target.closest?.(".bloom-cell");
		const table = cell?.closest(".bloom-table");
		if (!cell || !table || cell.classList.contains("bloom-skip")) {
			clearPaintTargetHighlight();
			return;
		}
		if (cell === highlightedCell) return;
		clearPaintTargetHighlight();
		showPaintTargetHighlight(cell, table);
	}
	function onPaintKeyDown(e) {
		if (e.key !== "Escape") return;
		e.stopPropagation();
		exitPaintFormatMode();
	}
	function enterPaintFormatMode(table, scope, sourceCells) {
		if (!sourceCells.length) return;
		exitPaintFormatMode();
		ensurePaintFormatStyle();
		const badge = makePaintFormatBadge();
		document.body.appendChild(badge);
		paintMode = {
			scope,
			pattern: sourceCells.map((c) => snapshotCellProperties(c)),
			lineSize: snapshotLineSize(table, scope, sourceCells[0]),
			table,
			badge
		};
		document.body.classList.add("bloom-paint-format");
		document.addEventListener("pointerdown", onPaintPointerDown, true);
		document.addEventListener("mousedown", onPaintPointerDown, true);
		document.addEventListener("click", onPaintPointerDown, true);
		document.addEventListener("keydown", onPaintKeyDown, true);
		document.addEventListener("pointermove", onPaintPointerMove, true);
		window.addEventListener("scroll", positionPaintBadge, true);
		window.addEventListener("resize", positionPaintBadge);
		overlayHider();
		positionPaintBadge();
	}
	function exitPaintFormatMode() {
		if (!paintMode) return;
		clearPaintTargetHighlight();
		paintMode.badge.remove();
		paintMode = null;
		document.body.classList.remove("bloom-paint-format");
		document.removeEventListener("pointerdown", onPaintPointerDown, true);
		document.removeEventListener("mousedown", onPaintPointerDown, true);
		document.removeEventListener("click", onPaintPointerDown, true);
		document.removeEventListener("keydown", onPaintKeyDown, true);
		document.removeEventListener("pointermove", onPaintPointerMove, true);
		window.removeEventListener("scroll", positionPaintBadge, true);
		window.removeEventListener("resize", positionPaintBadge);
	}
	setPaintFormatExiter(exitPaintFormatMode);
	//#endregion
	//#region src/components/icons/column-delete.svg
	var column_delete_default = "data:image/svg+xml,<svg width=\"25\" height=\"18\" viewBox=\"0 0 25 18\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<g clip-path=\"url(%23clip0_5668_553)\">%0A<path d=\"M1.75903 18C1.51284 18 1.30215 17.8043 1.12698 17.413C0.951804 17.0217 0.864068 16.5507 0.86377 16V2C0.86377 1.45 0.951505 0.979333 1.12698 0.588C1.30245 0.196667 1.51313 0.000666667 1.75903 0H4.44482V18H1.75903Z\" fill=\"white\"/>%0A<path d=\"M20.8495 18C21.0748 18 21.2677 17.8043 21.428 17.413C21.5884 17.0217 21.6687 16.5507 21.6689 16V2C21.6689 1.45 21.5886 0.979333 21.428 0.588C21.2674 0.196667 21.0746 0.000666667 20.8495 0H18.3911V18H20.8495Z\" fill=\"white\"/>%0A<path d=\"M16.3286 3.38813H13.8734L13.1719 2.68665H9.6645L8.96301 3.38813H6.50781V4.7911H16.3286M7.2093 13.9104C7.2093 14.2825 7.35711 14.6394 7.62022 14.9025C7.88333 15.1656 8.24018 15.3134 8.61227 15.3134H14.2242C14.5962 15.3134 14.9531 15.1656 15.2162 14.9025C15.4793 14.6394 15.6271 14.2825 15.6271 13.9104V5.49259H7.2093V13.9104Z\" fill=\"white\"/>%0A</g>%0A<defs>%0A<clipPath id=\"clip0_5668_553\">%0A<rect width=\"24\" height=\"18\" fill=\"white\" transform=\"translate(0.54541)\"/>%0A</clipPath>%0A</defs>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/cell-merge.svg
	var cell_merge_default = "data:image/svg+xml,<svg width=\"22\" height=\"23\" viewBox=\"0 0 22 23\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M9 6.53674V2.03674C9 1.7606 8.77615 1.53674 8.5 1.53674H1.5C1.22386 1.53674 1 1.7606 1 2.03674V21.0367C1 21.3129 1.22386 21.5367 1.5 21.5367H8.5C8.77615 21.5367 9 21.3129 9 21.0367V16.5367\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\"/>%0A<path d=\"M13 16.5367V21.0367C13 21.3129 13.2239 21.5367 13.5 21.5367H20.5C20.7761 21.5367 21 21.3129 21 21.0367V2.03674C21 1.7606 20.7761 1.53674 20.5 1.53674H13.5C13.2239 1.53674 13 1.7606 13 2.03674V6.53674\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\"/>%0A<path d=\"M1.5 11.5367H16.2544\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\"/>%0A<path d=\"M15.6875 13.946L16.483 13.1505L18.074 11.5595L16.483 9.96847L15.6875 9.17297\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/cell-split.svg
	var cell_split_default = "data:image/svg+xml,<svg width=\"22\" height=\"23\" viewBox=\"0 0 22 23\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M9 6.53674V2.03674C9 1.7606 8.77615 1.53674 8.5 1.53674H1.5C1.22386 1.53674 1 1.7606 1 2.03674V21.0367C1 21.3129 1.22386 21.5367 1.5 21.5367H8.5C8.77615 21.5367 9 21.3129 9 21.0367V16.5367\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\"/>%0A<path d=\"M13 16.5367V21.0367C13 21.3129 13.2239 21.5367 13.5 21.5367H20.5C20.7761 21.5367 21 21.3129 21 21.0367V2.03674C21 1.7606 20.7761 1.53674 20.5 1.53674H13.5C13.2239 1.53674 13 1.7606 13 2.03674V6.53674\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\"/>%0A<path d=\"M7.6543 11.5594L12.9999 11.5594\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\"/>%0A<path d=\"M6.07422 13.946L5.27872 13.1505L3.68772 11.5595L5.27872 9.96847L6.07422 9.17297\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>%0A<path d=\"M14.6875 13.946L15.483 13.1505L17.074 11.5595L15.483 9.96847L14.6875 9.17297\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/align-left.svg
	var align_left_default = "data:image/svg+xml,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0D%0A<path d=\"M4 12L9 7V10H20V14H9V17L4 12Z\" fill=\"white\"/>%0D%0A</svg>%0D%0A";
	//#endregion
	//#region src/components/icons/align-center.svg
	var align_center_default = "data:image/svg+xml,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0D%0A<path d=\"M4 12L9 7V10H15V7L20 12L15 17V14H9V17L4 12Z\" fill=\"white\"/>%0D%0A</svg>%0D%0A";
	//#endregion
	//#region src/components/icons/align-right.svg
	var align_right_default = "data:image/svg+xml,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0D%0A<path d=\"M20 12L15 7V10H4V14H15V17L20 12Z\" fill=\"white\"/>%0D%0A</svg>%0D%0A";
	//#endregion
	//#region src/components/icons/menu-row.svg
	var menu_row_default = "data:image/svg+xml,<svg width=\"28\" height=\"14\" viewBox=\"0 0 28 14\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0D%0A<rect x=\"1.5\" y=\"1.5\" width=\"25\" height=\"11\" rx=\"1.5\" stroke=\"white\" stroke-width=\"2\"/>%0D%0A</svg>%0D%0A";
	//#endregion
	//#region src/components/icons/menu-column.svg
	var menu_column_default = "data:image/svg+xml,<svg width=\"14\" height=\"28\" viewBox=\"0 0 14 28\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0D%0A<rect x=\"1.5\" y=\"1.5\" width=\"11\" height=\"25\" rx=\"1.5\" stroke=\"white\" stroke-width=\"2\"/>%0D%0A</svg>%0D%0A";
	//#endregion
	//#region src/components/icons/column-grow.svg
	var column_grow_default = "data:image/svg+xml,<svg width=\"22\" height=\"16\" viewBox=\"0 0 22 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M1.23473 7.29289C0.844202 7.68342 0.844202 8.31658 1.23473 8.70711L7.59869 15.0711C7.98921 15.4616 8.62238 15.4616 9.0129 15.0711C9.40343 14.6805 9.40343 14.0474 9.0129 13.6569L3.35605 8L9.0129 2.34315C9.40343 1.95262 9.40343 1.31946 9.0129 0.928932C8.62238 0.538408 7.98921 0.538408 7.59869 0.928932L1.23473 7.29289ZM19.5 8V7L1.94183 7V8V9L19.5 9V8Z\" fill=\"white\"/>%0A<path d=\"M20.7654 7.29289C21.1559 7.68342 21.1559 8.31658 20.7654 8.70711L14.4014 15.0711C14.0109 15.4616 13.3777 15.4616 12.9872 15.0711C12.5967 14.6805 12.5967 14.0474 12.9872 13.6569L18.6441 8L12.9872 2.34315C12.5967 1.95262 12.5967 1.31946 12.9872 0.928932C13.3777 0.538408 14.0109 0.538408 14.4014 0.928932L20.7654 7.29289ZM18.9419 8V7H20.0583V8V9H18.9419V8Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/column-hug.svg
	var column_hug_default = "data:image/svg+xml,<svg width=\"26\" height=\"16\" viewBox=\"0 0 26 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M14.4557 7.29289C14.0652 7.68342 14.0652 8.31658 14.4557 8.70711L20.8197 15.0711C21.2102 15.4616 21.8434 15.4616 22.2339 15.0711C22.6244 14.6805 22.6244 14.0474 22.2339 13.6569L16.5771 8L22.2339 2.34315C22.6244 1.95262 22.6244 1.31946 22.2339 0.928932C21.8434 0.538408 21.2102 0.538408 20.8197 0.928932L14.4557 7.29289ZM15.5801 8V7H15.1628V8V9H15.5801V8Z\" fill=\"white\"/>%0A<path d=\"M11.5442 7.29289C11.9347 7.68342 11.9347 8.31658 11.5442 8.70711L5.18024 15.0711C4.78972 15.4616 4.15655 15.4616 3.76603 15.0711C3.3755 14.6805 3.3755 14.0474 3.76603 13.6569L9.42288 8L3.76603 2.34315C3.3755 1.95262 3.3755 1.31946 3.76603 0.928932C4.15655 0.538408 4.78972 0.538408 5.18024 0.928932L11.5442 7.29289ZM9.7207 8V7H10.8371V8V9H9.7207V8Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/row-grow.svg
	var row_grow_default = "data:image/svg+xml,<svg width=\"16\" height=\"22\" viewBox=\"0 0 16 22\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M8.70711 1.23473C8.31658 0.844202 7.68342 0.844202 7.29289 1.23473L0.928932 7.59869C0.538408 7.98921 0.538408 8.62238 0.928932 9.0129C1.31946 9.40343 1.95262 9.40343 2.34315 9.0129L8 3.35605L13.6569 9.0129C14.0474 9.40343 14.6805 9.40343 15.0711 9.0129C15.4616 8.62238 15.4616 7.98921 15.0711 7.59869L8.70711 1.23473ZM8 19.5H9L9 1.94183H8H7L7 19.5H8Z\" fill=\"white\"/>%0A<path d=\"M8.70711 20.7653C8.31658 21.1558 7.68342 21.1558 7.29289 20.7653L0.928932 14.4013C0.538408 14.0108 0.538408 13.3776 0.928932 12.9871C1.31946 12.5966 1.95262 12.5966 2.34315 12.9871L8 18.644L13.6569 12.9871C14.0474 12.5966 14.6805 12.5966 15.0711 12.9871C15.4616 13.3776 15.4616 14.0108 15.0711 14.4013L8.70711 20.7653ZM8 18.9418H9V20.0582H8H7V18.9418H8Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/row-hug.svg
	var row_hug_default = "data:image/svg+xml,<svg width=\"16\" height=\"26\" viewBox=\"0 0 16 26\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M8.70711 14.4556C8.31658 14.0651 7.68342 14.0651 7.29289 14.4556L0.928932 20.8196C0.538408 21.2101 0.538408 21.8433 0.928932 22.2338C1.31946 22.6243 1.95262 22.6243 2.34315 22.2338L8 16.5769L13.6569 22.2338C14.0474 22.6243 14.6805 22.6243 15.0711 22.2338C15.4616 21.8433 15.4616 21.2101 15.0711 20.8196L8.70711 14.4556ZM8 15.58H9V15.1627H8H7V15.58H8Z\" fill=\"white\"/>%0A<path d=\"M8.70711 11.5444C8.31658 11.935 7.68342 11.935 7.29289 11.5444L0.928932 5.18049C0.538408 4.78996 0.538408 4.1568 0.928932 3.76627C1.31946 3.37575 1.95262 3.37575 2.34315 3.76627L8 9.42313L13.6569 3.76627C14.0474 3.37575 14.6805 3.37575 15.0711 3.76627C15.4616 4.1568 15.4616 4.78996 15.0711 5.18049L8.70711 11.5444ZM8 9.72095H9V10.8373H8H7V9.72095H8Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/table-size-buttons.ts
	let installed = false;
	let anchorCounter = 0;
	const mintedAnchorNames = /* @__PURE__ */ new Set();
	function onFocusInForOverlays(event) {
		const target = event.target;
		if (!target) return;
		const cell = target.closest(".bloom-cell");
		if (!cell) {
			scheduleOverlayReposition();
			return;
		}
		const table = ownerTable(cell);
		if (!table) return;
		showEdgeOverlays(table);
	}
	/**
	* Open the Cell menu for `cell` at the given viewport point. This is the one
	* Cell menu: a right-click uses it, and so does a host that puts the menu on a
	* button of its own. It returns false, and opens nothing, while Paint Format
	* mode runs, because a menu on top of that mode would let the user re-enter it
	* with a different pattern.
	*/
	function openCellMenu(cell, position) {
		const table = ownerTable(cell);
		if (!table) return false;
		if (isPaintFormatModeActive()) return false;
		showEdgeOverlays(table);
		openMenu(["cell"], position, "context", cell);
		return true;
	}
	function onContextMenuForOverlays(event) {
		const target = event.target;
		if (!target) return;
		const cell = clickTargetCell(target);
		if (!cell) return;
		const table = ownerTable(cell);
		if (!table) return;
		event.preventDefault();
		const position = {
			x: event.clientX,
			y: event.clientY
		};
		if (cellMenuOpenedByHost(cell, table, position)) return;
		openCellMenu(cell, position);
	}
	const kScrollListenerOptions = {
		capture: true,
		passive: true
	};
	function ensureTableSizeButtons() {
		if (installed) return;
		installed = true;
		ensureEdgeOverlays();
		document.addEventListener("focusin", onFocusInForOverlays, true);
		document.addEventListener("contextmenu", onContextMenuForOverlays, true);
		window.addEventListener("resize", scheduleOverlayReposition, { passive: true });
		window.addEventListener("scroll", scheduleOverlayReposition, kScrollListenerOptions);
		document.addEventListener("tableHistoryUpdated", scheduleOverlayReposition);
		installProximityGate();
	}
	let colAddBtn = null;
	let rowAddBtn = null;
	let colMenuPill = null;
	let rowMenuPill = null;
	let colCluster = null;
	let rowCluster = null;
	let proxColCluster = null;
	let proxRowCluster = null;
	let proxColAdd = null;
	let proxRowAdd = null;
	let tablePillTL = null;
	let proxTablePillTL = null;
	let menuPopup = null;
	let menuOpenId = null;
	let menuTargetCell = null;
	let unmountCellSection = null;
	let overlayTable = null;
	let repositionRaf = 0;
	let deletePreviewDiv = null;
	let deletePreviewVisible = false;
	let currentPreviewKind = null;
	const kAddButtonLength = 50;
	const kAddPreviewThickness = 10;
	let overlayStylesInstalled = false;
	function ensureOverlayStyles() {
		if (overlayStylesInstalled) return;
		const style = document.createElement("style");
		style.textContent = `
/* Enable referencing anchors anywhere in the document */
html { anchor-scope: all; }
@keyframes btable-pulse {
  0% { opacity: 0.25; }
  50% { opacity: 0.9; }
  100% { opacity: 0.25; }
}`;
		document.head.appendChild(style);
		overlayStylesInstalled = true;
	}
	const kAddOverlayLabel = {
		right: "Add column at the right edge",
		left: "Add column at the left edge",
		top: "Add row at the top edge",
		bottom: "Add row at the bottom edge"
	};
	function makeOverlay(onClick, iconSvg, side) {
		const btn = document.createElement("button");
		btn.type = "button";
		const label = kAddOverlayLabel[side];
		btn.setAttribute("aria-label", label);
		btn.title = label;
		btn.setAttribute("data-table-overlay", "add-button");
		Object.assign(btn.style, {
			position: "absolute",
			width: "24px",
			height: "24px",
			borderRadius: "12px",
			border: "1px solid rgba(0,0,0,0.3)",
			backgroundColor: "#2D8294",
			color: "#fff",
			boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
			zIndex: "2147483647",
			cursor: "pointer",
			display: "none",
			alignItems: "center",
			justifyContent: "center",
			boxSizing: "border-box"
		});
		if (side === "right" || side === "left") {
			btn.style.width = "24px";
			btn.style.height = `${kAddButtonLength}px`;
			btn.style.borderRadius = "12px";
		} else {
			btn.style.width = `${kAddButtonLength}px`;
			btn.style.height = "24px";
			btn.style.borderRadius = "12px";
		}
		btn.innerHTML = iconSvg;
		btn.addEventListener("mousedown", (e) => e.preventDefault());
		btn.addEventListener("click", () => onClick());
		return btn;
	}
	function makeClusterContainer(kind) {
		const div = document.createElement("div");
		div.setAttribute("data-overlay-cluster", kind);
		div.setAttribute("data-table-overlay", "cluster");
		Object.assign(div.style, {
			position: "static",
			zIndex: "2147483647",
			display: "none",
			gap: "6px",
			alignItems: "center",
			justifyContent: "center",
			boxSizing: "border-box"
		});
		div.style.flexDirection = kind === "column" ? "row" : "column";
		document.body.appendChild(div);
		return div;
	}
	function ensureEdgeOverlays() {
		ensureOverlayStyles();
		if (!colAddBtn) colAddBtn = makeOverlay(tryInsertColumnRight, kAddIconSvg, "right");
		if (!rowAddBtn) rowAddBtn = makeOverlay(tryInsertRowBelow, kAddIconSvg, "bottom");
		for (const b of [colAddBtn, rowAddBtn]) {
			if (!b) continue;
			b.style.width = "";
			b.style.minWidth = "30px";
			b.style.height = "20px";
			b.style.borderRadius = "10px";
			b.style.padding = "0 8px";
		}
		ensureMenuPills();
		ensureTablePills();
		if (!colCluster) {
			colCluster = makeClusterContainer("column");
			proxColCluster = new ProximityDiv(document.body, colCluster, { minOpacity: .16 });
		}
		if (!rowCluster) {
			rowCluster = makeClusterContainer("row");
			proxRowCluster = new ProximityDiv(document.body, rowCluster, { minOpacity: .16 });
		}
		const addToCluster = (cluster, ...els) => {
			for (const el of els) {
				if (!el) continue;
				el.style.position = "static";
				el.style.display = "flex";
				if (!cluster.contains(el)) cluster.appendChild(el);
			}
		};
		addToCluster(colCluster, colMenuPill);
		addToCluster(rowCluster, rowMenuPill);
		if (colAddBtn) {
			colAddBtn.style.position = "static";
			if (!proxColAdd) proxColAdd = new ProximityDiv(document.body, colAddBtn);
		}
		if (rowAddBtn) {
			rowAddBtn.style.position = "static";
			if (!proxRowAdd) proxRowAdd = new ProximityDiv(document.body, rowAddBtn);
		}
		const ensureAddHover = (btn, kind, position) => {
			if (!btn) return;
			if (btn._hasAddPreviewHandlers) return;
			btn._hasAddPreviewHandlers = true;
			btn.addEventListener("mouseenter", () => showAddPreview(kind, position));
			btn.addEventListener("mouseleave", hideAddPreview);
		};
		ensureAddHover(colAddBtn, "column", "right");
		ensureAddHover(rowAddBtn, "row", "below");
	}
	function ensureMenuPills() {
		if (!colMenuPill) {
			colMenuPill = makeGlyphPill("Column menu", menu_column_default, "display:block;height:16px;width:auto");
			colMenuPill.setAttribute("data-btable-menu-pill", "column");
			attachPillTargetPreview(colMenuPill, "column");
			colMenuPill.addEventListener("click", (e) => {
				e.stopPropagation();
				hidePillTargetPreview();
				togglePillMenu("column", colMenuPill, "pill:column");
			});
		}
		if (!rowMenuPill) {
			rowMenuPill = makeGlyphPill("Row menu", menu_row_default, "display:block;width:16px;height:auto");
			rowMenuPill.setAttribute("data-btable-menu-pill", "row");
			attachPillTargetPreview(rowMenuPill, "row");
			rowMenuPill.addEventListener("click", (e) => {
				e.stopPropagation();
				hidePillTargetPreview();
				togglePillMenu("row", rowMenuPill, "pill:row");
			});
		}
	}
	function ensureTablePills() {
		const make = (id) => {
			const pill = makeGlyphPill("Table menu", cell_content_table_default, "display:block;width:16px;height:16px");
			pill.setAttribute("data-btable-menu-pill", "table");
			attachPillTargetPreview(pill, "table");
			pill.addEventListener("click", (e) => {
				e.stopPropagation();
				hidePillTargetPreview();
				togglePillMenu("table", pill, id);
			});
			return pill;
		};
		if (!tablePillTL) {
			tablePillTL = make("pill:table:tl");
			proxTablePillTL = new ProximityDiv(document.body, tablePillTL, { minOpacity: .6 });
		}
	}
	function makeMenuItem(label, fn, previewKind, disabled = false, icon) {
		const item = document.createElement("button");
		item.type = "button";
		item.setAttribute("aria-label", label);
		item.setAttribute("role", "menuitem");
		item.disabled = disabled;
		if (disabled) item.setAttribute("aria-disabled", "true");
		Object.assign(item.style, {
			display: "flex",
			alignItems: "center",
			width: "100%",
			textAlign: "left",
			padding: "6px 14px",
			background: "transparent",
			border: "none",
			color: disabled ? "#bbb" : "#222",
			fontSize: "13px",
			cursor: disabled ? "default" : "pointer",
			boxSizing: "border-box"
		});
		const slot = document.createElement("span");
		Object.assign(slot.style, {
			flex: `0 0 22px`,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			opacity: disabled ? "0.4" : "1"
		});
		setIconSlot(slot, icon, kItemIconColor);
		const text = document.createElement("span");
		text.textContent = label;
		text.style.flex = "1 1 auto";
		item.appendChild(slot);
		item.appendChild(text);
		item.addEventListener("mousedown", (e) => e.preventDefault());
		if (!disabled) {
			item.addEventListener("mouseenter", () => {
				item.style.background = "#eef6f8";
				if (previewKind) showDeletePreview(previewKind);
			});
			item.addEventListener("mouseleave", () => {
				item.style.background = "transparent";
				if (previewKind) hideDeletePreview();
			});
			item.addEventListener("click", (e) => {
				e.stopPropagation();
				if (previewKind) hideDeletePreview();
				const target = menuTargetCell;
				closeMenuPopup();
				menuTargetCell = target;
				try {
					fn();
				} finally {
					menuTargetCell = null;
				}
			});
		}
		return item;
	}
	function buildSizeControl(ctx, dim) {
		const table = ctx.table;
		const growIcon = dim === "column" ? column_grow_default : row_grow_default;
		const hugIcon = dim === "column" ? column_hug_default : row_hug_default;
		const index = dim === "column" ? ctx.col : ctx.row;
		const read = () => {
			if (!table) return "hug";
			try {
				const c = new BloomTable(table);
				const raw = (dim === "column" ? c.getColumnWidth(index) : c.getRowHeight(index)) || "hug";
				return typeof raw === "string" ? raw.trim() : raw;
			} catch {
				return "hug";
			}
		};
		const write = (value) => {
			if (!table) return;
			try {
				const c = new BloomTable(table);
				if (dim === "column") c.setColumnWidth(index, value);
				else c.setRowHeight(index, value);
				render(table);
			} catch {}
		};
		const grow = makeIconToggle(growIcon, "Grow", false, () => {
			write("fill");
			refresh();
		});
		const hug = makeIconToggle(hugIcon, "Hug", false, () => {
			write("hug");
			refresh();
		});
		const fixed = makeTextToggle("mm", "Fixed size", false, () => {
			const cur = read();
			write(cur && /(px|mm)$/i.test(cur) ? cur : "10mm");
			refresh();
		});
		const roundedLabel = (s) => {
			const m = s.match(/^(-?\d+(?:\.\d+)?)(px|mm)$/i);
			if (!m) return s;
			const n = parseFloat(m[1]);
			return `${m[2].toLowerCase() === "px" ? Math.round(n) : Math.round(n * 10) / 10}${m[2]}`;
		};
		const refresh = () => {
			const current = read();
			const mode = current === "fill" ? "grow" : /(px|mm)$/i.test(current) ? "fixed" : "hug";
			fixed.textContent = mode === "fixed" ? roundedLabel(current) : "mm";
			setToggleActive(grow, mode === "grow");
			setToggleActive(hug, mode === "hug");
			setToggleActive(fixed, mode === "fixed");
		};
		refresh();
		return makeControlRow("Size", [
			grow,
			hug,
			fixed
		]);
	}
	function buildMenuCtx(cell) {
		const table = (cell ? ownerTable(cell) : null) ?? overlayTable;
		let row = 0, col = 0, rowCount = 1, colCount = 1;
		if (table) try {
			const info = getTableInfo(table);
			rowCount = info.rowCount;
			colCount = info.columnCount;
		} catch {}
		if (cell && table) try {
			const pos = getRowAndColumn(table, cell);
			row = pos.row;
			col = pos.column;
		} catch {}
		return {
			table,
			cell,
			row,
			col,
			rowCount,
			colCount
		};
	}
	function scopeCells(ctx, scope) {
		const table = ctx.table;
		const cells = () => table ? getCellsInScope(table, scope, ctx.cell) : [];
		const common = (get) => {
			const list = cells();
			if (!list.length) return void 0;
			const first = get(list[0]);
			return list.every((c) => get(c) === first) ? first : void 0;
		};
		return {
			table,
			cells,
			seed: cells()[0],
			common
		};
	}
	function menuOffers(ctx, itemId) {
		return cellMenuOffersItem(itemId, ctx.cell, ctx.table);
	}
	function contentTypeChoice(ctx, scope) {
		const { table, cells, seed, common } = scopeCells(ctx, scope);
		if (!table || !seed) return void 0;
		if (!menuOffers(ctx, "contentType")) return void 0;
		const chosenId = common((c) => getCurrentContentTypeId(c));
		const options = contentTypeOptions().filter((opt) => menuOffers(ctx, `contentType:${opt.id}`)).map((opt) => ({
			id: opt.id,
			label: opt.englishName,
			icon: opt.icon,
			chosen: !!chosenId && chosenId === opt.id,
			choose: () => applyContentType(table, scope, cells(), opt.id)
		}));
		if (!options.length) return void 0;
		return {
			kind: "choice",
			id: "contentType",
			group: "contentType",
			label: "Content Type",
			presentation: "iconToggleRow",
			options
		};
	}
	function renderChoiceRow(ctx, scope, item) {
		const buttons = [];
		const refresh = () => {
			const chosen = contentTypeChoice(ctx, scope)?.options.find((o) => o.chosen)?.id;
			buttons.forEach((b) => setToggleActive(b, !!chosen && b.dataset.ctId === chosen));
		};
		for (const opt of item.options) {
			const choose = () => {
				opt.choose();
				refresh();
			};
			const b = opt.icon ? makeIconToggle(opt.icon, opt.label, opt.chosen, choose) : makeTextToggle(opt.label, opt.label, opt.chosen, choose);
			b.dataset.ctId = opt.id;
			buttons.push(b);
		}
		return makeControlRow(item.label, buttons);
	}
	function buildContentTypeControls(ctx, scope) {
		const choice = contentTypeChoice(ctx, scope);
		return choice ? [renderChoiceRow(ctx, scope, choice)] : [];
	}
	function buildContentTypeSection(ctx, scope) {
		const controls = buildContentTypeControls(ctx, scope);
		return controls.length ? [makeDivider(), ...controls] : [];
	}
	function buildFormattingControls(ctx, scope) {
		const els = [];
		const { table, cells, seed, common } = scopeCells(ctx, scope);
		if (!table || !seed) return els;
		const aligns = [
			{
				id: "start",
				icon: align_left_default,
				title: "Left"
			},
			{
				id: "center",
				icon: align_center_default,
				title: "Center"
			},
			{
				id: "end",
				icon: align_right_default,
				title: "Right"
			}
		];
		const alignButtons = [];
		const refreshAlign = () => {
			const cur = common((c) => getCellAlign(c) || "center");
			alignButtons.forEach((b) => setToggleActive(b, !!cur && b.dataset.align === cur));
		};
		for (const a of aligns) {
			const b = makeIconToggle(a.icon, a.title, false, () => {
				applyAlignment(table, scope, cells(), a.id);
				refreshAlign();
			});
			b.dataset.align = a.id;
			alignButtons.push(b);
		}
		if (menuOffers(ctx, "alignment")) {
			els.push(makeControlRow("Alignment", alignButtons));
			refreshAlign();
		}
		if (menuOffers(ctx, "padding")) els.push(makeSliderRow("Padding between border and text", 0, 40, common((c) => firstPx$1(getCellPadding(c))) ?? firstPx$1(getCellPadding(seed)), "px", (v) => applyPadding(table, scope, cells(), v)));
		const fillValue = common((c) => getCellBackground(c)) ?? (scope === "table" ? getTableBackground(table) : null) ?? "";
		if (menuOffers(ctx, "fill")) els.push(makeColorPairRow([{
			label: "Fill",
			value: fillValue,
			onInput: (color) => applyFill(table, scope, cells(), color || null)
		}, {
			label: "Border color",
			value: representativeBorderColorHex(seed),
			onInput: (color) => applyBorderColor(table, scope, cells(), color)
		}]));
		const cellEdgeCommon = (pick) => common((c) => {
			const m = getCellPerimeterValueMap(c);
			const vals = [
				m.top,
				m.right,
				m.bottom,
				m.left
			].map(pick);
			return vals.every((v) => v === vals[0]) ? vals[0] : "mixed";
		});
		const styleButtons = [];
		const weightButtons = [];
		const refreshBorderToggles = () => {
			const curStyle = cellEdgeCommon((e) => e.style);
			styleButtons.forEach((b) => setToggleActive(b, curStyle !== void 0 && curStyle !== "mixed" && b.dataset.style === curStyle));
			const curWeight = cellEdgeCommon((e) => e.weight);
			weightButtons.forEach((b) => setToggleActive(b, curWeight !== void 0 && curWeight !== "mixed" && Number(b.dataset.weight) === curWeight));
		};
		for (const style of [
			"none",
			"solid",
			"dashed",
			"dotted",
			"double"
		]) {
			const b = makeBorderStyleToggle(style, () => {
				applyBorderStyle(table, scope, cells(), style);
				refreshBorderToggles();
			});
			styleButtons.push(b);
		}
		if (menuOffers(ctx, "borderStyle")) els.push(makeControlRow("Border Style", styleButtons));
		for (const weight of [
			0,
			1,
			2,
			4
		]) {
			const b = makeBorderWeightToggle(weight, () => {
				applyBorderWeight(table, scope, cells(), weight);
				refreshBorderToggles();
			});
			weightButtons.push(b);
		}
		if (menuOffers(ctx, "borderWeight")) els.push(makeControlRow("Border Weight", weightButtons));
		refreshBorderToggles();
		const cornerButtons = [];
		const refreshCorners = () => {
			const cur = common((c) => getCellCorners(c)?.radius ?? 0);
			cornerButtons.forEach((b) => setToggleActive(b, cur !== void 0 && Number(b.dataset.radius) === cur));
		};
		for (const radius of [
			0,
			4,
			8,
			16
		]) {
			const b = makeCornerToggle(radius, false, () => {
				applyCorners(table, scope, cells(), radius);
				refreshCorners();
			});
			b.dataset.radius = String(radius);
			cornerButtons.push(b);
		}
		if (menuOffers(ctx, "corners")) {
			els.push(makeControlRow("Corners", cornerButtons));
			refreshCorners();
		}
		return els;
	}
	function buildFormattingSection(ctx, scope) {
		const controls = buildFormattingControls(ctx, scope);
		if (!controls.length) return [];
		return [
			makeDivider(),
			makeMenuHeader("Format"),
			...controls
		];
	}
	function buildCopyPasteSection(ctx, scope) {
		const { table, cells, seed } = scopeCells(ctx, scope);
		if (!table || !seed) return [];
		if (scope === "table") {
			const items = [];
			if (menuOffers(ctx, "copyProperties")) items.push(makeMenuItem("Copy properties", () => copyProperties(cells()), void 0, false, kCopyIconSvg));
			if (menuOffers(ctx, "pasteProperties")) items.push(makeMenuItem("Paste properties", () => pasteProperties(table, scope, cells()), void 0, !hasCopiedProperties(), kPasteIconSvg));
			return items.length ? [makeDivider(), ...items] : [];
		}
		if (!menuOffers(ctx, "paintFormat")) return [];
		return [makeDivider(), makeMenuItem("Paint format", () => enterPaintFormatMode(table, scope, cells()), void 0, false, kPaintIconSvg)];
	}
	const kFormatRowIds = [
		"alignment",
		"padding",
		"fill",
		"borderStyle",
		"borderWeight",
		"corners"
	];
	/**
	* The Cell menu for `cell`, as data.
	*
	* These are the items the library's own Cell menu shows, in its order, already
	* filtered by setCellMenuItemFilter. A host renders them in a menu of its own
	* when the cell needs items the library knows nothing about beside them; see
	* setCellMenuOpenHandler in cell-menu-host.ts. The library's popup is built from
	* this same list, so the two menus offer the same things.
	*
	* Every item's `invoke` and `choose` acts on the cell this was asked about, so a
	* host may hold the list across a click of its own menu.
	*/
	function getCellMenuItems(cell) {
		return cellMenuItems(buildMenuCtx(cell));
	}
	setCellMenuItemsSource(getCellMenuItems);
	function cellMenuItems(ctx) {
		const items = [];
		const { table, cells, seed } = scopeCells(ctx, "cell");
		const cell = ctx.cell;
		if (!table || !seed || !cell) return items;
		const choice = contentTypeChoice(ctx, "cell");
		if (choice) items.push(choice);
		if (kFormatRowIds.some((id) => menuOffers(ctx, id))) items.push({
			kind: "formatControls",
			id: "format",
			group: "format",
			label: "Format"
		});
		if (menuOffers(ctx, "paintFormat")) items.push({
			kind: "command",
			id: "paintFormat",
			group: "transfer",
			label: "Paint format",
			icon: kPaintIconSvg,
			enabled: true,
			invoke: () => enterPaintFormatMode(table, "cell", cells())
		});
		const spanX = getSpan(cell).x || 1;
		if (menuOffers(ctx, "merge")) items.push({
			kind: "command",
			id: "merge",
			group: "span",
			label: "Merge with cell to the right",
			icon: cell_merge_default,
			enabled: ctx.col + spanX < ctx.colCount,
			invoke: () => menuMergeCell(cell)
		});
		if (menuOffers(ctx, "split")) items.push({
			kind: "command",
			id: "split",
			group: "span",
			label: "Split",
			icon: cell_split_default,
			enabled: spanX > 1,
			invoke: () => menuSplitCell(cell)
		});
		return items;
	}
	function buildCellSection(ctx) {
		const host = document.createElement("div");
		unmountCellSection = mountCellMenuItems(host, {
			cell: ctx.cell,
			closeMenu: closeMenuPopup,
			renderFormatControls: (container) => {
				for (const el of buildFormattingControls(ctx, "cell")) container.appendChild(el);
			}
		});
		return [host];
	}
	function buildRowSection(ctx) {
		return [
			makeMenuHeader("Row"),
			makeMenuItem("Add Row Above", () => menuAddRow(0), void 0, false, kAddRowAboveIconSvg),
			makeMenuItem("Add Row Below", () => menuAddRow(1), void 0, false, kAddRowBelowIconSvg),
			makeMenuItem("Move Row Up", () => menuMoveRow(-1), void 0, ctx.row <= 0, kMoveUpIconSvg),
			makeMenuItem("Move Row Down", () => menuMoveRow(1), void 0, ctx.row >= ctx.rowCount - 1, kMoveDownIconSvg),
			makeDivider(),
			buildSizeControl(ctx, "row"),
			...buildContentTypeSection(ctx, "row"),
			...buildFormattingSection(ctx, "row"),
			...buildCopyPasteSection(ctx, "row"),
			makeDivider(),
			makeMenuItem("Duplicate Row", menuDuplicateRow, void 0, false, kCopyIconSvg),
			makeMenuItem("Delete Row", tryRemoveRow, "row", ctx.rowCount <= 1, kTrashIconSvg),
			makeInfoNote("Right click on a cell for Cell menu")
		];
	}
	function buildColumnSection(ctx) {
		return [
			makeMenuHeader("Column"),
			makeMenuItem("Add Column Left", () => menuAddColumn(0), void 0, false, kAddColumnLeftIconSvg),
			makeMenuItem("Add Column Right", () => menuAddColumn(1), void 0, false, kAddColumnRightIconSvg),
			makeMenuItem("Move Left", () => menuMoveColumn(-1), void 0, ctx.col <= 0, kMoveLeftIconSvg),
			makeMenuItem("Move Right", () => menuMoveColumn(1), void 0, ctx.col >= ctx.colCount - 1, kMoveRightIconSvg),
			makeDivider(),
			buildSizeControl(ctx, "column"),
			...buildContentTypeSection(ctx, "column"),
			...buildFormattingSection(ctx, "column"),
			...buildCopyPasteSection(ctx, "column"),
			makeDivider(),
			makeMenuItem("Duplicate Column", menuDuplicateColumn, void 0, false, kCopyIconSvg),
			makeMenuItem("Delete Column", tryRemoveColumn, "column", ctx.colCount <= 1, column_delete_default),
			makeInfoNote("Right click on a cell for Cell menu")
		];
	}
	function buildTableSection(ctx) {
		const els = [makeMenuHeader("Table")];
		const table = ctx.table;
		if (table) {
			els.push(...buildContentTypeSection(ctx, "table"));
			els.push(...buildFormattingSection(ctx, "table"));
			els.push(makeSliderRow("Horizontal space between cells", 0, 40, firstPx$1(getGapX(table)[0]), "px", (v) => {
				setGapX(table, `${v}px`);
				render(table);
			}));
			els.push(makeSliderRow("Vertical space between cells", 0, 40, firstPx$1(getGapY(table)[0]), "px", (v) => {
				setGapY(table, `${v}px`);
				render(table);
			}));
			els.push(...buildCopyPasteSection(ctx, "table"));
		}
		els.push(makeDivider());
		els.push(makeMenuItem("Copy Table", menuCopyTable, void 0, false, kCopyIconSvg));
		els.push(makeMenuItem("Cut Table", menuCutTable, void 0, false, kCutIconSvg));
		els.push(makeDivider());
		els.push(makeMenuItem("Delete Table", menuDeleteTable, void 0, false, kTrashIconSvg));
		return els;
	}
	const sectionBuilders = {
		cell: buildCellSection,
		row: buildRowSection,
		column: buildColumnSection,
		table: buildTableSection
	};
	function onDocMouseDownForMenu(e) {
		const t = e.target;
		if (!t) return;
		if (menuPopup && menuPopup.contains(t) || colMenuPill && colMenuPill.contains(t) || rowMenuPill && rowMenuPill.contains(t) || tablePillTL && tablePillTL.contains(t)) return;
		closeMenuPopup();
	}
	function onKeyDownForMenu(e) {
		if (e.key === "Escape") closeMenuPopup();
	}
	function closeMenuPopup() {
		if (unmountCellSection) {
			unmountCellSection();
			unmountCellSection = null;
		}
		if (menuPopup) {
			menuPopup.remove();
			menuPopup = null;
		}
		menuOpenId = null;
		menuTargetCell = null;
		document.removeEventListener("mousedown", onDocMouseDownForMenu, true);
		document.removeEventListener("keydown", onKeyDownForMenu, true);
	}
	function togglePillMenu(kind, pill, id) {
		if (menuPopup && menuOpenId === id) {
			closeMenuPopup();
			return;
		}
		const sel = overlayTable ? ownSelectedCell(overlayTable) : null;
		openMenu([kind], {
			pill,
			kind
		}, id, sel);
	}
	function openMenu(sections, anchor, id, targetCell) {
		closeMenuPopup();
		menuTargetCell = targetCell;
		const ctx = buildMenuCtx(targetCell);
		const popup = document.createElement("div");
		popup.setAttribute("data-btable-menu", sections.join("+"));
		popup.setAttribute("data-table-overlay", "menu");
		popup.setAttribute("role", "menu");
		Object.assign(popup.style, {
			position: "fixed",
			zIndex: "2147483647",
			minWidth: "200px",
			background: "#fff",
			color: "#222",
			border: "1px solid rgba(0,0,0,0.15)",
			borderRadius: "8px",
			boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
			padding: "0 0 4px",
			fontSize: "13px",
			fontFamily: "system-ui, sans-serif",
			userSelect: "none",
			overflowY: "auto",
			overflowX: "hidden",
			boxSizing: "border-box"
		});
		popup.appendChild(makeMenuDragHandle(popup));
		sections.forEach((name, i) => {
			if (i > 0) popup.appendChild(makeDivider());
			for (const el of sectionBuilders[name](ctx)) popup.appendChild(el);
		});
		document.body.appendChild(popup);
		menuPopup = popup;
		menuOpenId = id;
		if ("pill" in anchor) positionMenuAtPill(popup, anchor.pill, anchor.kind);
		else positionMenuAtPoint(popup, anchor.x, anchor.y);
		document.addEventListener("mousedown", onDocMouseDownForMenu, true);
		document.addEventListener("keydown", onKeyDownForMenu, true);
	}
	function makeMenuDragHandle(popup) {
		const handle = document.createElement("div");
		handle.setAttribute("data-btable-menu-handle", "");
		handle.setAttribute("aria-hidden", "true");
		Object.assign(handle.style, {
			position: "sticky",
			top: "0",
			zIndex: "1",
			height: "14px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			cursor: "grab",
			background: "#fff",
			borderRadius: "8px 8px 0 0",
			touchAction: "none"
		});
		const grip = document.createElement("div");
		Object.assign(grip.style, {
			width: "32px",
			height: "4px",
			borderRadius: "2px",
			background: "rgba(0,0,0,0.2)"
		});
		handle.appendChild(grip);
		handle.addEventListener("pointerdown", (e) => {
			if (e.button !== 0) return;
			e.preventDefault();
			const startX = e.clientX;
			const startY = e.clientY;
			const r = popup.getBoundingClientRect();
			handle.setPointerCapture(e.pointerId);
			handle.style.cursor = "grabbing";
			const onMove = (ev) => {
				const left = r.left + ev.clientX - startX;
				const top = r.top + ev.clientY - startY;
				popup.style.left = `${Math.max(4, Math.min(left, window.innerWidth - popup.offsetWidth - 4))}px`;
				popup.style.top = `${Math.max(4, Math.min(top, window.innerHeight - popup.offsetHeight - 4))}px`;
			};
			const onUp = () => {
				handle.style.cursor = "grab";
				handle.removeEventListener("pointermove", onMove);
				handle.removeEventListener("pointerup", onUp);
				handle.removeEventListener("pointercancel", onUp);
			};
			handle.addEventListener("pointermove", onMove);
			handle.addEventListener("pointerup", onUp);
			handle.addEventListener("pointercancel", onUp);
		});
		return handle;
	}
	function positionMenuAtPill(popup, pill, kind) {
		const r = pill.getBoundingClientRect();
		positionMenuAtPoint(popup, kind === "row" ? r.right + 4 : r.left, kind === "row" ? r.top : r.bottom + 4);
	}
	function positionMenuAtPoint(popup, x, y) {
		popup.style.maxHeight = `${Math.max(120, window.innerHeight - 8)}px`;
		const pw = popup.offsetWidth || 200;
		const ph = popup.offsetHeight || 0;
		const left = Math.max(4, Math.min(x, window.innerWidth - pw - 4));
		const top = Math.max(4, Math.min(y, window.innerHeight - ph - 4));
		popup.style.left = `${left}px`;
		popup.style.top = `${top}px`;
	}
	function getMenuCell() {
		return menuTargetCell ?? (overlayTable ? ownSelectedCell(overlayTable) : null);
	}
	function getMenuTable() {
		const cell = getMenuCell();
		return (cell ? ownerTable(cell) : null) ?? overlayTable;
	}
	function menuAddColumn(offset) {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table) return;
		try {
			const controller = new BloomTable(table);
			if (cell) controller.addColumnAt(getRowAndColumn(table, cell).column + offset);
			else controller.addColumnAt(offset === 0 ? 0 : getTableInfo(table).columnCount);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuAddRow(offset) {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table) return;
		try {
			const controller = new BloomTable(table);
			if (cell) controller.addRowAt(getRowAndColumn(table, cell).row + offset);
			else controller.addRowAt(offset === 0 ? 0 : getTableInfo(table).rowCount);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuMoveRow(delta) {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table || !cell) return;
		try {
			const { row } = getRowAndColumn(table, cell);
			const to = row + delta;
			if (to < 0 || to >= getTableInfo(table).rowCount) return;
			new BloomTable(table).moveRowAt(row, to);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuMoveColumn(delta) {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table || !cell) return;
		try {
			const { column } = getRowAndColumn(table, cell);
			const to = column + delta;
			if (to < 0 || to >= getTableInfo(table).columnCount) return;
			new BloomTable(table).moveColumnAt(column, to);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuDuplicateRow() {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table || !cell) return;
		try {
			const { row } = getRowAndColumn(table, cell);
			new BloomTable(table).duplicateRowAt(row);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuDuplicateColumn() {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table || !cell) return;
		try {
			const { column } = getRowAndColumn(table, cell);
			new BloomTable(table).duplicateColumnAt(column);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuMergeCell(cellToActOn) {
		const cell = cellToActOn ?? getMenuCell();
		const table = (cell ? ownerTable(cell) : null) ?? getMenuTable();
		if (!table || !cell) return;
		try {
			const controller = new BloomTable(table);
			const s = controller.getSpan(cell);
			controller.setSpan(cell, (s.x || 1) + 1, s.y || 1);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuSplitCell(cellToActOn) {
		const cell = cellToActOn ?? getMenuCell();
		const table = (cell ? ownerTable(cell) : null) ?? getMenuTable();
		if (!table || !cell) return;
		try {
			const controller = new BloomTable(table);
			const s = controller.getSpan(cell);
			controller.setSpan(cell, Math.max(1, (s.x || 1) - 1), s.y || 1);
			scheduleOverlayReposition();
		} catch {}
	}
	function menuCopyTable() {
		const table = getMenuTable();
		if (!table) return;
		try {
			navigator.clipboard?.writeText(tableMarkupForClipboard(table));
		} catch {}
	}
	function menuCutTable() {
		const table = getMenuTable();
		if (!table) return;
		try {
			navigator.clipboard?.writeText(tableMarkupForClipboard(table));
		} catch {}
		removeTable(table);
	}
	function menuDeleteTable() {
		const table = getMenuTable();
		if (!table) return;
		removeTable(table);
	}
	function removeTable(table) {
		hideEdgeOverlays();
		const hostCell = isNestedTable(table) ? hostCellOf(table) : null;
		if (hostCell) {
			const outer = ownerTable(hostCell);
			if (!tableHistoryManager.addHistoryEntry(table, "Delete Table", () => {
				hostCell.removeAttribute("tabindex");
				setupContentsOfCell(hostCell, "text", false, false);
			})) return;
			dispatchCellContentChanged(hostCell, "text");
			if (outer) render(outer);
			selectCell(hostCell);
			scheduleOverlayReposition();
			return;
		}
		const parent = table.parentElement;
		const nextSibling = table.nextSibling;
		if (!parent) {
			table.remove();
			return;
		}
		tableHistoryManager.addHistoryEntry(table, "Delete Table", () => table.remove(), (deleted) => {
			parent.insertBefore(deleted, nextSibling);
			render(deleted);
		}, (deleted) => deleted.remove());
	}
	const kPointerNearClass = "bloom-pointer-near";
	function showEdgeOverlays(table) {
		if (isPaintFormatModeActive()) return;
		if (overlayTable && overlayTable !== table) overlayTable.classList.remove(kPointerNearClass);
		table.classList.add(kPointerNearClass);
		overlayTable = table;
		ensureEdgeOverlays();
		const structural = structuralChromeAllowed(table);
		const hasSelection = structural && !!ownSelectedCell(table);
		if (colCluster) colCluster.style.display = hasSelection ? "flex" : "none";
		if (rowCluster) rowCluster.style.display = hasSelection ? "flex" : "none";
		if (tablePillTL) tablePillTL.style.display = structural ? "flex" : "none";
		if (colAddBtn) colAddBtn.style.display = structural ? "flex" : "none";
		if (rowAddBtn) rowAddBtn.style.display = structural ? "flex" : "none";
		applyAnchorPositioning(table);
	}
	setPaintFormatOverlayHider(hideEdgeOverlays);
	function hideEdgeOverlays() {
		overlayTable?.classList.remove(kPointerNearClass);
		if (colCluster) colCluster.style.display = "none";
		if (rowCluster) rowCluster.style.display = "none";
		if (tablePillTL) tablePillTL.style.display = "none";
		if (colAddBtn) colAddBtn.style.display = "none";
		if (rowAddBtn) rowAddBtn.style.display = "none";
		closeMenuPopup();
		overlayTable = null;
		hideDeletePreview();
		hideAddPreview();
		hidePillTargetPreview();
	}
	function scheduleOverlayReposition() {
		if (repositionRaf) cancelAnimationFrame(repositionRaf);
		repositionRaf = requestAnimationFrame(() => {
			repositionEdgeOverlays();
		});
	}
	function repositionEdgeOverlays() {
		const targetTable = overlayTable;
		if (!targetTable) return;
		if (!document.body.contains(targetTable)) {
			hideEdgeOverlays();
			return;
		}
		applyAnchorPositioning(targetTable);
		if (deletePreviewVisible) updateDeletePreviewGeometry();
		if (addPreviewVisible) updateAddPreviewGeometry();
		if (pillTargetPreviewVisible) updatePillTargetPreviewGeometry();
	}
	const kActiveZonePadding = 70;
	let gateMouseX = 0;
	let gateMouseY = 0;
	let gateRaf = 0;
	let gateInstalled = false;
	function visibleCellBounds(table) {
		let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
		for (const child of Array.from(table.children)) {
			if (!(child instanceof HTMLElement) || !child.classList.contains("bloom-cell")) continue;
			const r = child.getBoundingClientRect();
			if (r.width <= 0 || r.height <= 0) continue;
			if (r.left < minL) minL = r.left;
			if (r.top < minT) minT = r.top;
			if (r.right > maxR) maxR = r.right;
			if (r.bottom > maxB) maxB = r.bottom;
		}
		if (!isFinite(minL) || !isFinite(maxR)) return null;
		return {
			minL,
			minT,
			maxR,
			maxB
		};
	}
	function pointerInActiveZone(table, x, y) {
		const b = visibleCellBounds(table);
		if (!b) return false;
		const pad = kActiveZonePadding;
		return x >= b.minL - pad && x <= b.maxR + pad && y >= b.minT - pad && y <= b.maxB + pad;
	}
	function updateProximityGate() {
		if (isPaintFormatModeActive()) {
			if (overlayTable) hideEdgeOverlays();
			return;
		}
		if (menuPopup) return;
		const current = currentTable();
		const matches = Array.from(document.querySelectorAll(".bloom-table")).filter((t) => pointerInActiveZone(t, gateMouseX, gateMouseY));
		let near = null;
		if (current && matches.includes(current)) near = current;
		else {
			const unrelated = matches.filter((t) => !isNestedTable(t) && (!current || !(t.contains(current) || current.contains(t))));
			near = unrelated.find((t) => {
				const b = visibleCellBounds(t);
				return !!b && gateMouseX >= b.minL && gateMouseX <= b.maxR && gateMouseY >= b.minT && gateMouseY <= b.maxB;
			}) ?? unrelated[0] ?? null;
		}
		if (near) {
			if (near !== overlayTable || !near.classList.contains(kPointerNearClass)) showEdgeOverlays(near);
		} else if (overlayTable) hideEdgeOverlays();
	}
	function onMouseMoveForProximityGate(e) {
		gateMouseX = e.clientX;
		gateMouseY = e.clientY;
		if (typeof requestAnimationFrame !== "function") {
			updateProximityGate();
			return;
		}
		if (gateRaf) return;
		gateRaf = requestAnimationFrame(() => {
			gateRaf = 0;
			updateProximityGate();
		});
	}
	function installProximityGate() {
		if (gateInstalled) return;
		gateInstalled = true;
		document.addEventListener("mousemove", onMouseMoveForProximityGate, { passive: true });
	}
	function scrubStaleAnchorNames(root) {
		const scrub = (el) => {
			const name = el.dataset.btableAnchorName;
			if (!name || mintedAnchorNames.has(name)) return;
			el.style.removeProperty("anchor-name");
			delete el.dataset.btableAnchorName;
		};
		scrub(root);
		root.querySelectorAll("[data-btable-anchor-name]").forEach(scrub);
	}
	function getElementAnchorName(el, key, prefix) {
		const existing = el.dataset[key];
		if (existing && mintedAnchorNames.has(existing)) return existing;
		const name = `--${prefix}-${++anchorCounter}`;
		mintedAnchorNames.add(name);
		el.style.anchorName = name;
		el.style.setProperty("anchor-name", name);
		el.dataset[key] = name;
		return name;
	}
	function getCellAt(table, targetRow, targetCol) {
		return buildGrid(table).cellAt(targetRow, targetCol) ?? null;
	}
	function applyAnchorPositioning(table) {
		if (isPaintFormatModeActive()) {
			hideEdgeOverlays();
			return;
		}
		const structural = structuralChromeAllowed(table);
		const gap = 8;
		let rows = 0, cols = 0;
		try {
			const info = getTableInfo(table);
			rows = info.rowCount;
			cols = info.columnCount;
		} catch {}
		const selected = ownSelectedCell(table);
		let selRow = 0, selCol = 0;
		if (selected) try {
			const pos = getRowAndColumn(table, selected);
			selRow = pos.row;
			selCol = pos.column;
		} catch {}
		const colAnchorCell = selected && rows && cols ? getCellAt(table, 0, selCol) : null;
		const rowAnchorCell = selected && rows && cols ? getCellAt(table, selRow, 0) : null;
		const anchorTo = (prox, cell, side) => {
			if (!prox || !cell) return;
			const el = prox.element;
			el.style.position = "fixed";
			const a = getElementAnchorName(cell, "btableAnchorName", "btable-cell");
			el.style.positionAnchor = a;
			el.style.setProperty("position-anchor", a);
			el.style.left = "";
			el.style.top = "";
			el.style.right = "";
			el.style.bottom = "";
			if (side === "top") {
				el.style.top = `calc(anchor(top) - ${gap}px)`;
				el.style.left = `anchor(center)`;
				el.style.transform = "translate(-50%, -100%)";
			} else {
				el.style.left = `calc(anchor(left) - ${gap}px)`;
				el.style.top = `anchor(center)`;
				el.style.transform = "translate(-100%, -50%)";
			}
		};
		if (colCluster) colCluster.style.display = structural && colAnchorCell ? "flex" : "none";
		if (rowCluster) rowCluster.style.display = structural && rowAnchorCell ? "flex" : "none";
		anchorTo(proxColCluster, colAnchorCell, "top");
		anchorTo(proxRowCluster, rowAnchorCell, "left");
		const b = visibleCellBounds(table);
		const haveBounds = b !== null;
		const placePill = (prox, left, top, transform) => {
			if (!prox) return;
			const el = prox.element;
			el.style.position = "fixed";
			el.style.removeProperty("position-anchor");
			el.style.positionAnchor = "";
			el.style.right = "";
			el.style.bottom = "";
			el.style.left = `${Math.round(left)}px`;
			el.style.top = `${Math.round(top)}px`;
			el.style.transform = transform;
		};
		const showTableLevel = structural && haveBounds;
		if (tablePillTL) tablePillTL.style.display = showTableLevel ? "flex" : "none";
		if (colAddBtn) colAddBtn.style.display = showTableLevel ? "flex" : "none";
		if (rowAddBtn) rowAddBtn.style.display = showTableLevel ? "flex" : "none";
		if (b) {
			const { minL, minT, maxR, maxB } = b;
			const midX = (minL + maxR) / 2;
			const midY = (minT + maxB) / 2;
			placePill(proxRowAdd, midX, maxB + gap, "translate(-50%, 0)");
			placePill(proxColAdd, maxR + gap, midY, "translate(0, -50%)");
			let tablePillX = midX;
			if (tablePillTL && rowAddBtn) {
				const tablePillW = tablePillTL.getBoundingClientRect().width || 50;
				const rowAddW = rowAddBtn.getBoundingClientRect().width || 30;
				const minClear = tablePillW / 2 + rowAddW / 2 + 8;
				const leftPos = midX - minClear;
				tablePillX = leftPos >= minL ? leftPos : midX + minClear;
				tablePillX = Math.max(minL, Math.min(maxR, tablePillX));
			}
			placePill(proxTablePillTL, tablePillX, maxB + gap, "translate(-50%, 0)");
		}
	}
	function tryInsertColumnRight() {
		const table = overlayTable;
		if (!table) return;
		try {
			const widths = getColumnWidths(table);
			new BloomTable(table).addColumnAt(widths.length, widths.length > 0 ? widths.length - 1 : void 0);
			scheduleOverlayReposition();
		} catch {}
	}
	function tryInsertRowBelow() {
		const table = overlayTable;
		if (!table) return;
		try {
			const heights = getRowHeights(table);
			new BloomTable(table).addRowAt(heights.length, heights.length > 0 ? heights.length - 1 : void 0);
			scheduleOverlayReposition();
		} catch {}
	}
	function tryRemoveColumn() {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table) return;
		try {
			const controller = new BloomTable(table);
			if (cell) {
				const { column } = getRowAndColumn(table, cell);
				controller.removeColumnAt(column);
			}
			scheduleOverlayReposition();
		} catch {}
	}
	function tryRemoveRow() {
		const cell = getMenuCell();
		const table = getMenuTable();
		if (!table) return;
		try {
			const controller = new BloomTable(table);
			if (cell) {
				const { row } = getRowAndColumn(table, cell);
				controller.removeRowAt(row);
			}
			scheduleOverlayReposition();
		} catch {}
	}
	function ensureDeletePreviewDiv() {
		if (deletePreviewDiv) return deletePreviewDiv;
		const div = document.createElement("div");
		Object.assign(div.style, {
			position: "absolute",
			left: "0px",
			top: "0px",
			width: "0px",
			height: "0px",
			pointerEvents: "none",
			zIndex: "2147483646",
			display: "none"
		});
		div.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="none">
      <line x1="0" y1="0" x2="100%" y2="100%" stroke="#e53935" stroke-width="2" stroke-linecap="round" />
      <line x1="100%" y1="0" x2="0" y2="100%" stroke="#e53935" stroke-width="2" stroke-linecap="round" />
    </svg>`;
		div.setAttribute("data-table-overlay", "delete-preview");
		document.body.appendChild(div);
		deletePreviewDiv = div;
		return div;
	}
	function deletePreviewCell() {
		const table = overlayTable;
		if (!table) return null;
		const cell = menuTargetCell ?? ownSelectedCell(table);
		if (!cell || cell.parentElement !== table) return null;
		return cell;
	}
	function showDeletePreview(kind) {
		if (!overlayTable) return;
		if (!deletePreviewCell()) return;
		currentPreviewKind = kind;
		const div = ensureDeletePreviewDiv();
		deletePreviewVisible = true;
		updateDeletePreviewGeometry();
		div.style.display = "block";
	}
	function hideDeletePreview() {
		deletePreviewVisible = false;
		currentPreviewKind = null;
		if (deletePreviewDiv) deletePreviewDiv.style.display = "none";
	}
	function updateDeletePreviewGeometry() {
		if (!deletePreviewVisible || !overlayTable || !deletePreviewDiv) return;
		const target = deletePreviewCell();
		if (!target) {
			hideDeletePreview();
			return;
		}
		const { row, column } = getRowAndColumn(overlayTable, target);
		const cells = Array.from(overlayTable.children).filter((el) => el instanceof HTMLElement && el.classList.contains("bloom-cell"));
		let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;
		for (const cell of cells) {
			const { row: r, column: c } = getRowAndColumn(overlayTable, cell);
			if (!(currentPreviewKind === "row" ? r === row : c === column)) continue;
			const rect = cell.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) continue;
			if (rect.left < minLeft) minLeft = rect.left;
			if (rect.right > maxRight) maxRight = rect.right;
			if (rect.top < minTop) minTop = rect.top;
			if (rect.bottom > maxBottom) maxBottom = rect.bottom;
		}
		if (!isFinite(minLeft) || !isFinite(maxRight) || !isFinite(minTop) || !isFinite(maxBottom)) {
			hideDeletePreview();
			return;
		}
		const left = Math.round(window.scrollX + minLeft);
		const top = Math.round(window.scrollY + minTop);
		const width = Math.round(maxRight - minLeft);
		const height = Math.round(maxBottom - minTop);
		Object.assign(deletePreviewDiv.style, {
			left: `${left}px`,
			top: `${top}px`,
			width: `${width}px`,
			height: `${height}px`,
			display: "block"
		});
	}
	let addPreviewDiv = null;
	let addPreviewVisible = false;
	let currentAddKind = null;
	let currentAddPosition = null;
	function ensureAddPreviewDiv() {
		if (addPreviewDiv) return addPreviewDiv;
		const div = document.createElement("div");
		Object.assign(div.style, {
			position: "absolute",
			left: "0px",
			top: "0px",
			width: "0px",
			height: "0px",
			pointerEvents: "none",
			zIndex: "2147483646",
			display: "none",
			backgroundColor: kBloomBlue,
			opacity: "0.6",
			animation: "btable-pulse 2.8s ease-in-out infinite",
			borderRadius: "3px"
		});
		div.setAttribute("data-table-overlay", "add-preview");
		document.body.appendChild(div);
		addPreviewDiv = div;
		return div;
	}
	function showAddPreview(kind, position) {
		if (!overlayTable) return;
		currentAddKind = kind;
		currentAddPosition = position;
		const div = ensureAddPreviewDiv();
		addPreviewVisible = true;
		updateAddPreviewGeometry();
		div.style.display = "block";
	}
	function hideAddPreview() {
		addPreviewVisible = false;
		currentAddKind = null;
		currentAddPosition = null;
		if (addPreviewDiv) addPreviewDiv.style.display = "none";
	}
	function updateAddPreviewGeometry() {
		if (!addPreviewVisible || !overlayTable || !addPreviewDiv) return;
		if (!currentAddKind || !currentAddPosition) return;
		const b = visibleCellBounds(overlayTable);
		if (!b) {
			hideAddPreview();
			return;
		}
		const { minL: minLeft, maxR: maxRight, minT: minTop, maxB: maxBottom } = b;
		if (currentAddKind === "row") {
			const boundary = currentAddPosition === "above" ? minTop : maxBottom;
			const left = Math.round(window.scrollX + minLeft);
			const width = Math.round(maxRight - minLeft);
			const top = Math.round(window.scrollY + boundary - kAddPreviewThickness / 2);
			const height = kAddPreviewThickness;
			Object.assign(addPreviewDiv.style, {
				left: `${left}px`,
				top: `${top}px`,
				width: `${width}px`,
				height: `${height}px`,
				display: "block"
			});
		} else {
			const boundary = currentAddPosition === "left" ? minLeft : maxRight;
			const top = Math.round(window.scrollY + minTop);
			const height = Math.round(maxBottom - minTop);
			const left = Math.round(window.scrollX + boundary - kAddPreviewThickness / 2);
			const width = kAddPreviewThickness;
			Object.assign(addPreviewDiv.style, {
				left: `${left}px`,
				top: `${top}px`,
				width: `${width}px`,
				height: `${height}px`,
				display: "block"
			});
		}
	}
	let pillTargetPreviewDiv = null;
	let pillTargetPreviewVisible = false;
	let currentPillTargetKind = null;
	const kPillTargetPreviewBorder = 3;
	function ensurePillTargetPreviewDiv() {
		if (pillTargetPreviewDiv) return pillTargetPreviewDiv;
		const div = document.createElement("div");
		Object.assign(div.style, {
			position: "absolute",
			left: "0px",
			top: "0px",
			width: "0px",
			height: "0px",
			pointerEvents: "none",
			zIndex: "2147483646",
			display: "none",
			border: `${kPillTargetPreviewBorder}px solid ${kBloomBlue}`,
			opacity: "0.6",
			borderRadius: "3px",
			boxSizing: "border-box"
		});
		div.setAttribute("data-table-overlay", "pill-target-preview");
		document.body.appendChild(div);
		pillTargetPreviewDiv = div;
		return div;
	}
	function showPillTargetPreview(kind) {
		if (!overlayTable) return;
		if (menuPopup) return;
		if (kind !== "table" && !ownSelectedCell(overlayTable)) return;
		currentPillTargetKind = kind;
		const div = ensurePillTargetPreviewDiv();
		pillTargetPreviewVisible = true;
		updatePillTargetPreviewGeometry();
		if (pillTargetPreviewVisible) div.style.display = "block";
	}
	function hidePillTargetPreview() {
		pillTargetPreviewVisible = false;
		currentPillTargetKind = null;
		if (pillTargetPreviewDiv) pillTargetPreviewDiv.style.display = "none";
	}
	function updatePillTargetPreviewGeometry() {
		if (!pillTargetPreviewVisible || !overlayTable || !pillTargetPreviewDiv) return;
		const kind = currentPillTargetKind;
		if (!kind) return;
		const table = overlayTable;
		const cells = getCellsInScope(table, kind, kind === "table" ? null : ownSelectedCell(table));
		let minLeft = Infinity, maxRight = -Infinity, minTop = Infinity, maxBottom = -Infinity;
		for (const c of cells) {
			const rect = c.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) continue;
			if (rect.left < minLeft) minLeft = rect.left;
			if (rect.right > maxRight) maxRight = rect.right;
			if (rect.top < minTop) minTop = rect.top;
			if (rect.bottom > maxBottom) maxBottom = rect.bottom;
		}
		const bounds = visibleCellBounds(table);
		if (bounds) {
			if (kind === "column") {
				minTop = Math.min(minTop, bounds.minT);
				maxBottom = Math.max(maxBottom, bounds.maxB);
			} else if (kind === "row") {
				minLeft = Math.min(minLeft, bounds.minL);
				maxRight = Math.max(maxRight, bounds.maxR);
			}
		}
		if (!isFinite(minLeft) || !isFinite(maxRight) || !isFinite(minTop) || !isFinite(maxBottom)) {
			hidePillTargetPreview();
			return;
		}
		Object.assign(pillTargetPreviewDiv.style, {
			left: `${Math.round(window.scrollX + minLeft)}px`,
			top: `${Math.round(window.scrollY + minTop)}px`,
			width: `${Math.round(maxRight - minLeft)}px`,
			height: `${Math.round(maxBottom - minTop)}px`,
			display: "block"
		});
	}
	function attachPillTargetPreview(pill, kind) {
		pill.addEventListener("mouseenter", () => showPillTargetPreview(kind));
		pill.addEventListener("mouseleave", hidePillTargetPreview);
	}
	//#endregion
	//#region src/attach.ts
	function attachTable(tableDiv) {
		if (!tableDiv) throw new Error("Table element is required");
		tableDiv.classList.add("bloom-table");
		ensureSelectionHighlighting();
		ensureTableSizeButtons();
		scrubStaleAnchorNames(tableDiv);
		tableDiv.classList.remove("table--selected", "bloom-pointer-near", "bloom-current-table");
		tableDiv.querySelectorAll(".bloom-cell.cell--selected").forEach((c) => c.classList.remove("cell--selected"));
		if (!tableDiv.hasAttribute("data-column-widths")) {
			tableDiv.setAttribute("data-column-widths", "");
			addColumn(tableDiv, true);
			addColumn(tableDiv, true);
		}
		if (!tableDiv.hasAttribute("data-row-heights")) {
			tableDiv.setAttribute("data-row-heights", "");
			addRow(tableDiv, true);
			addRow(tableDiv, true);
		}
		migrateTable(tableDiv);
		tableHistoryManager.attachTable(tableDiv);
		dragToResize.attach(tableDiv);
		attachTextEditing(tableDiv);
		render(tableDiv);
	}
	setRestoreReattacher(attachTable);
	function detachTable(tableDiv) {
		if (!tableDiv) throw new Error("Table element is required");
		tableHistoryManager.detachTable(tableDiv);
		dragToResize.detach(tableDiv);
		detachTextEditing(tableDiv);
	}
	//#endregion
	//#region src/cell-contents.ts
	function contentTypeOptions() {
		return defaultCellContentsForEachType.map((content) => ({
			id: content.id,
			englishName: content.englishName,
			icon: content.icon
		}));
	}
	const defaultCellContentsForEachType = [
		{
			id: "text",
			englishName: "Text",
			icon: cell_content_text_default,
			templateHtml: "<div contenteditable='true'></div>",
			regexToIdentify: /<div[^>]*contenteditable=['"]true['"][^>]*>/
		},
		{
			id: "table",
			englishName: "Table",
			icon: cell_content_table_default,
			templateHtml: `<div class='bloom-table' data-column-widths='fill,fill' data-row-heights='fill,fill'>
            <div class='bloom-cell' data-content-type='text'></div>
            <div class='bloom-cell' data-content-type='text'></div>
            <div class='bloom-cell' data-content-type='text'></div>
            <div class='bloom-cell' data-content-type='text'></div>
        </div>`,
			regexToIdentify: /<div[^>]*class=['"](?:[^'"]*\s)?bloom-table(?:\s[^'"]*)?['"][^>]*>/
		},
		{
			id: "image",
			englishName: "Image",
			icon: cell_content_image_default,
			templateHtml: `<img src='data:image/svg+xml,%3Csvg%20xmlns="http://www.w3.org/2000/svg"%20viewBox="0%200%20160%20120"%3E%3Crect%20width="160"%20height="120"%20fill="%23e2e2e2"/%3E%3Ccircle%20cx="55"%20cy="42"%20r="11"%20fill="%23aaaaaa"/%3E%3Cpath%20d="M30,95L70,55L95,80L113,62L134,95Z"%20fill="%23aaaaaa"/%3E%3C/svg%3E' alt='Placeholder Image' />`,
			regexToIdentify: /<img/
		},
		{
			id: "video",
			englishName: "Video",
			icon: cell_content_video_default,
			templateHtml: `<video controls preload='metadata' poster='data:image/svg+xml,%3Csvg%20xmlns="http://www.w3.org/2000/svg"%20viewBox="0%200%20160%20120"%3E%3Crect%20width="160"%20height="120"%20fill="%23e2e2e2"/%3E%3Cpath%20d="M65,40L105,60L65,80Z"%20fill="%23aaaaaa"/%3E%3C/svg%3E' style='max-width: 100%; max-height: 100%'>
  Your browser does not support the video tag.
</video>`,
			regexToIdentify: /<video/
		}
	];
	let defaultCellContentTypeId = "text";
	const kTableCellContentChangedEvent = "tableCellContentChanged";
	function registerCellContentType(type, options) {
		const existingIndex = defaultCellContentsForEachType.findIndex((c) => c.id === type.id);
		if (existingIndex >= 0) defaultCellContentsForEachType[existingIndex] = type;
		else defaultCellContentsForEachType.push(type);
		if (options?.makeDefault) defaultCellContentTypeId = type.id;
	}
	function unregisterCellContentType(id) {
		const index = defaultCellContentsForEachType.findIndex((c) => c.id === id);
		if (index >= 0) defaultCellContentsForEachType.splice(index, 1);
	}
	function setDefaultCellContentTypeId(id) {
		defaultCellContentTypeId = id;
	}
	function getDefaultCellContentTypeId() {
		return defaultCellContentTypeId;
	}
	/** Guess a cell's content type from its markup, for legacy content that carries
	*  no data-content-type. Tests the cell's own root element first, with its
	*  descendants stripped off: a cell holding a nested table used to be reported
	*  as "text", because the nested table's own cells contain contenteditable divs
	*  and the text regex is tried against the whole innerHTML before the table
	*  one, so asking for "table" on such a cell threw the user's nested table away
	*  and put a fresh empty 2x2 in its place. Only when the root element alone
	*  identifies nothing do we fall back to testing the whole innerHTML, which is
	*  what a host-registered type whose marker sits deeper in the content needs. */
	function identifyContentTypeFromMarkup(cell) {
		const root = cell.firstElementChild;
		if (root) {
			const rootWithoutContents = root.cloneNode(false);
			const rootMatch = defaultCellContentsForEachType.find((c) => c.regexToIdentify.test(rootWithoutContents.outerHTML));
			if (rootMatch) return rootMatch.id;
		}
		return defaultCellContentsForEachType.find((c) => c.regexToIdentify.test(cell.innerHTML))?.id;
	}
	function getCurrentContentTypeId(cell) {
		return cell.dataset.contentType || identifyContentTypeFromMarkup(cell) || defaultCellContentTypeId;
	}
	/** The content type a cell already carries: its data attribute, or the type its
	*  markup identifies, or undefined when there is nothing to go on. Unlike
	*  getCurrentContentTypeId this does NOT fall back to defaultCellContentTypeId,
	*  so an empty untyped cell reports undefined. This is the value
	*  setupContentsOfCell compares with targetType, so a caller that needs to know
	*  whether setupContentsOfCell will rebuild the cell (and therefore whether the
	*  host has to be told about the content it just created) must use this one: an
	*  empty untyped cell IS rebuilt when the default type is applied to it, even
	*  though getCurrentContentTypeId reports that type both before and after. */
	function getExistingContentTypeId(cell) {
		if (cell.dataset.contentType !== void 0) return cell.dataset.contentType;
		if (cell.children.length === 0) return void 0;
		return identifyContentTypeFromMarkup(cell);
	}
	function setupContentsOfCell(cell, targetType, putInHistory = false, notifyHost = true) {
		const table = cell.closest(".bloom-table");
		const existingContentType = getExistingContentTypeId(cell);
		if (!targetType && !existingContentType) targetType = defaultCellContentTypeId;
		if (!targetType) return cell.firstChild || null;
		if (existingContentType === targetType) return cell.firstChild || null;
		const content = defaultCellContentsForEachType.find((c) => c.id === targetType);
		if (!content) throw new Error(`Unknown content type: ${targetType}. Available types are: ${defaultCellContentsForEachType.map((c) => c.id).join(", ")}`);
		let rebuiltCell = false;
		const doIt = () => {
			cell.dataset.contentType = targetType;
			cell.innerHTML = content.templateHtml;
			if (targetType === "table") {
				const embeddedTable = cell.querySelector(".bloom-table");
				if (embeddedTable) {
					embeddedTable.querySelectorAll(".bloom-cell").forEach((tableCell) => {
						tableCell.dataset.contentType = defaultCellContentTypeId;
						tableCell.innerHTML = defaultCellContentsForEachType.find((c) => c.id === defaultCellContentTypeId)?.templateHtml || "!!!";
					});
					attachTable(embeddedTable);
				}
				cell.tabIndex = -1;
			}
			if (cell.children.length !== 1) throw new Error(`Cell contents must have exactly one root element, but found ${cell.children.length} elements.`);
			rebuiltCell = true;
		};
		if (putInHistory && table) tableHistoryManager.addHistoryEntry(table, {
			label: "Change Cell Content Type",
			detail: `${existingContentType ?? "untyped"} to ${targetType}`
		}, doIt);
		else doIt();
		if (notifyHost && rebuiltCell) dispatchCellContentChanged(cell, targetType);
		if (!rebuiltCell) return null;
		return cell.firstChild || null;
	}
	/** Fire the content-changed notification for a cell. Callers that passed
	*  notifyHost=false to setupContentsOfCell use this to dispatch once their
	*  history entry has closed. */
	function dispatchCellContentChanged(cell, contentType) {
		cell.dispatchEvent(new CustomEvent(kTableCellContentChangedEvent, {
			bubbles: true,
			composed: true,
			detail: {
				cell,
				contentType
			}
		}));
	}
	//#endregion
	//#region src/structure.ts
	/**
	* Table Operations Module
	*
	* This module provides functions for manipulating tables represented as HTML elements.
	*
	* ## Table Representation
	*
	* Tables are represented using this HTML structure:
	*
	* ### HTML Structure:
	* ```html
	* <div class="bloom-table" data-column-widths="100px,fit" data-row-heights="50px,60px">
	*   <div class="bloom-cell">Cell 0,0</div>
	*   <div class="bloom-cell">Cell 0,1</div>
	*   <div class="bloom-cell">Cell 1,0</div>
	*   <div class="bloom-cell">Cell 1,1</div>
	* </div>
	* ```
	*
	* ### Key Components:
	*
	* 1. **Table Container**: A div with class "table"
	*    - `data-column-widths`: Comma-separated list of column widths (e.g., "100px,200px,fit")
	*    - `data-row-heights`: Comma-separated list of row heights (e.g., "50px,60px,fit")
	*
	* 2. **Cell Elements**: Direct children divs with class "cell"
	*    - Ordered left-to-right, top-to-bottom in the DOM
	*    - Spans configured via data attributes on each cell:
	*      - `data-span-x`: Number of columns to span (default: 1)
	*      - `data-span-y`: Number of rows to span (default: 1)
	*
	* 3. **Borders (edge-based model)**: Borders are defined on the table as arrays, not per-cell attributes.
	*    - `data-edges-h`: JSON (R-1 x C) of objects with optional `north` / `south` BorderSpec.
	*    - `data-edges-v`: JSON (R x C-1) of objects with optional `west` / `east` BorderSpec.
	*    - Unified edges include perimeters: `data-edges-h` is (R+1)xC (top=0, bottom=R), `data-edges-v` is Rx(C+1) (left=0, right=C).
	*    - `data-border-default`: optional BorderSpec default used only when an interior edge entry is entirely unspecified (both sides absent) and there is zero gap. Not applied across gaps or to perimeters.
	*    - Gaps (optional): `data-gap-x` (C-1 entries) and `data-gap-y` (R-1 entries) enable independent sided painting.
	*
	* ### Cell Positioning:
	* - Cells are positioned in DOM order: [0,0], [0,1], [1,0], [1,1], etc.
	* - Cell spans affect logical positioning but not DOM order
	* - A cell spanning 2 columns will "cover" the cell to its right
	* - A cell spanning 2 rows will "cover" the cell below it
	*
	* ### Spanning Behavior:
	* - When a cell spans multiple columns/rows, the covered cells are preserved in the DOM,
	* but they get a "skip" class to indicate they are not active.
	* - A cell spanning multiple columns and rows covers a rectangular area.
	* - Example: cell[0,0] spanning 2x2 in a 2x2 table causes cell[0,1], cell[1,0], and cell[1,1] to be marked as skipped.
	*
	* ### Size Values:
	* - "hug": CSS Table minmax(max-content,max-content) - size to content
	* - "fill": CSS Table minmax(0,1fr) - expand to fill available space
	* - Standard CSS units: "100px", "2rem", "50%", etc.
	*
	* # Warning:
	* Be careful with querySelectorAll with advanced selectors like ":scope > .bloom-cell". because the unit tests
	* use happy-dom, which do not support this selector properly. There may be other selectors that also do not work.
	*/
	/**
	* Per-cell appearance settings that a newly inserted row/column should inherit
	* from the selected (source) row/column. These are the formatting attributes
	* (fill, alignment, padding, corners) — NOT span (which is positional) or
	* content-type/content (a new cell starts empty). Borders are handled
	* separately via the edge arrays.
	*/
	const CELL_SETTING_ATTRS = [
		"data-bg",
		"data-align",
		"data-pad",
		"data-corners"
	];
	function snapshotCellSettings(cell) {
		const snap = {};
		for (const attr of CELL_SETTING_ATTRS) snap[attr] = cell.getAttribute(attr);
		snap.contentType = getCurrentContentTypeId(cell);
		return snap;
	}
	function applyCellSettings(cell, snap) {
		for (const attr of CELL_SETTING_ATTRS) {
			const v = snap[attr];
			if (v != null) cell.setAttribute(attr, v);
			else cell.removeAttribute(attr);
		}
		if (snap.contentType) setupContentsOfCell(cell, snap.contentType, false, false);
	}
	function resolveSourceIndex(sourceIndex, count) {
		if (sourceIndex == null || count <= 0) return null;
		return Math.max(0, Math.min(sourceIndex, count - 1));
	}
	function cloneEdge(entry) {
		if (entry === void 0) return {};
		if (entry === null) return null;
		return JSON.parse(JSON.stringify(entry));
	}
	function blankEdges(n) {
		return Array.from({ length: n }, () => ({}));
	}
	function edgeSide(entry, side) {
		if (!entry || typeof entry !== "object") return null;
		if (isBorderSpec(entry)) return entry;
		return entry[side] ?? null;
	}
	function mergeBoundaryEntry(near, far, nearSide, farSide) {
		const a = edgeSide(near, nearSide);
		const b = edgeSide(far, farSide);
		const merged = {};
		if (a) merged[nearSide] = a;
		if (b) merged[farSide] = b;
		return merged;
	}
	function expandEdgeLine(line, full) {
		const interior = Math.max(0, full - 2);
		if (line.length === full) return line;
		if (interior > 0 && line.length === interior) return [
			{},
			...line,
			{}
		];
		if (interior >= 1 && line.length === 1) {
			const out = blankEdges(full);
			out[1] = line[0];
			return out;
		}
		return line;
	}
	/**
	* Rewrite the table's edge arrays in the unified full-size layout. The renderer
	* also reads the concise interior-only form, but only the full form can be
	* spliced boundary-by-boundary, so every structural operation normalizes first;
	* otherwise a concise array survives the operation unchanged, then matches none
	* of the renderer's accepted shapes and every authored border disappears.
	*/
	function normalizeEdgeArrays(table, rows, cols) {
		const v = getEdgesV(table);
		if (v && v.length === rows) setEdgesV(table, v.map((row) => Array.isArray(row) ? expandEdgeLine(row, cols + 1) : blankEdges(cols + 1)));
		const h = getEdgesH(table);
		if (h) {
			const boundaries = expandEdgeLine(h, rows + 1);
			if (boundaries.length === rows + 1) setEdgesH(table, boundaries.map((row) => {
				if (!Array.isArray(row)) return blankEdges(cols);
				const line = row.slice();
				while (line.length < cols) line.push({});
				return line;
			}));
		}
	}
	const fullV = (v, rows, cols) => !!v && v.length === rows && v.every((r) => Array.isArray(r) && r.length === cols + 1);
	const fullH = (h, rows, cols) => !!h && h.length === rows + 1 && h.every((r) => Array.isArray(r) && r.length === cols);
	/**
	* When a row is inserted, splice the table's edge arrays so existing borders
	* stay aligned and the new row inherits the source row's borders.
	*  - V edges (rows x cols+1): the new row copies the source row's vertical lines
	*    (a blank row gets unspecified ones).
	*  - H edges (rows+1 x cols): a new horizontal boundary is inserted at the
	*    insertion index, copied from the boundary it splits (which is the source
	*    row's adjacent top/bottom line), preserving neighbouring rows' borders.
	*    A blank row brings no borders, so its new boundary is unspecified and the
	*    table's own top/bottom perimeters stay where they are.
	* Only runs when the arrays exist and are full-sized for the current dimensions.
	*/
	function insertEdgesForNewRow(table, insertIndex, sourceRow, rows, cols) {
		const v = getEdgesV(table);
		if (fullV(v, rows, cols)) {
			const src = sourceRow != null ? v[sourceRow] : void 0;
			const newRow = src ? src.map((e) => cloneEdge(e)) : blankEdges(cols + 1);
			v.splice(insertIndex, 0, newRow);
			setEdgesV(table, v);
		}
		const h = getEdgesH(table);
		if (fullH(h, rows, cols)) {
			if (sourceRow != null) {
				const base = h[insertIndex] ? h[insertIndex].map((e) => cloneEdge(e)) : blankEdges(cols);
				h.splice(insertIndex, 0, base);
			} else h.splice(insertIndex === 0 ? 1 : insertIndex, 0, blankEdges(cols));
			setEdgesH(table, h);
		}
	}
	/**
	* Column counterpart of insertEdgesForNewRow.
	*  - H edges (rows+1 x cols): the new column copies the source column's
	*    horizontal lines (top/bottom of its cells) at each boundary row.
	*  - V edges (rows x cols+1): a new vertical boundary is inserted at the
	*    insertion index, copied from the boundary it splits, preserving neighbours.
	*/
	function insertEdgesForNewColumn(table, insertIndex, sourceColumn, rows, cols) {
		const h = getEdgesH(table);
		if (fullH(h, rows, cols)) {
			for (let b = 0; b <= rows; b++) {
				const entry = sourceColumn != null ? cloneEdge(h[b][sourceColumn]) : {};
				h[b].splice(insertIndex, 0, entry);
			}
			setEdgesH(table, h);
		}
		const v = getEdgesV(table);
		if (fullV(v, rows, cols)) {
			for (let r = 0; r < rows; r++) if (sourceColumn != null) v[r].splice(insertIndex, 0, cloneEdge(v[r][insertIndex]));
			else v[r].splice(insertIndex === 0 ? 1 : insertIndex, 0, {});
			setEdgesV(table, v);
		}
	}
	/**
	* When a row is removed, splice its edge data out so the surviving rows keep
	* the borders they were authored with.
	*  - V edges: the removed row's line of vertical entries goes away.
	*  - H edges: the row's two horizontal boundaries collapse into one. The
	*    table's top/bottom perimeters stay put (removing the first or last row
	*    drops the interior boundary next to it); for an interior row the two
	*    boundaries merge, each surviving neighbour keeping the face it showed.
	*/
	function removeEdgesForRemovedRow(table, index, rows, _cols) {
		const v = getEdgesV(table);
		if (v && v.length === rows) {
			v.splice(index, 1);
			setEdgesV(table, v);
		}
		const h = getEdgesH(table);
		if (h && h.length === rows + 1) {
			const interior = index > 0 && index < rows - 1;
			if (interior && Array.isArray(h[index]) && Array.isArray(h[index + 1])) {
				const above = h[index];
				const below = h[index + 1];
				h[index] = above.map((e, c) => mergeBoundaryEntry(e, below[c], "north", "south"));
			}
			h.splice(index === 0 ? 1 : interior ? index + 1 : index, 1);
			setEdgesH(table, h);
		}
	}
	/** Column counterpart of removeEdgesForRemovedRow. */
	function removeEdgesForRemovedColumn(table, index, rows, cols) {
		const h = getEdgesH(table);
		if (h && h.length === rows + 1) {
			for (const line of h) if (Array.isArray(line) && line.length === cols) line.splice(index, 1);
			setEdgesH(table, h);
		}
		const v = getEdgesV(table);
		if (v && v.length === rows) {
			const interior = index > 0 && index < cols - 1;
			const drop = index === 0 ? 1 : interior ? index + 1 : index;
			for (const line of v) {
				if (!Array.isArray(line) || line.length !== cols + 1) continue;
				if (interior) line[index] = mergeBoundaryEntry(line[index], line[index + 1], "west", "east");
				line.splice(drop, 1);
			}
			setEdgesV(table, v);
		}
	}
	function gapAccess(axis) {
		return axis === "row" ? {
			get: getGapY,
			set: setGapY
		} : {
			get: getGapX,
			set: setGapX
		};
	}
	function perBoundaryGaps(table, axis, lineCount) {
		const tokens = gapAccess(axis).get(table);
		if (tokens.length < 2 || tokens.length !== lineCount - 1) return null;
		return tokens;
	}
	function spliceGapForInsertedLine(table, axis, insertIndex, lineCount) {
		const tokens = perBoundaryGaps(table, axis, lineCount);
		if (!tokens) return;
		const at = Math.min(insertIndex, tokens.length);
		const source = tokens[Math.max(0, Math.min(insertIndex - 1, tokens.length - 1))] ?? "0";
		tokens.splice(at, 0, source);
		gapAccess(axis).set(table, tokens);
	}
	function spliceGapForRemovedLine(table, axis, index, lineCount) {
		const tokens = perBoundaryGaps(table, axis, lineCount);
		if (!tokens) return;
		tokens.splice(Math.min(index, tokens.length - 1), 1);
		gapAccess(axis).set(table, tokens);
	}
	function reorderGapForMovedLine(table, axis, from, to, lineCount) {
		const tokens = perBoundaryGaps(table, axis, lineCount);
		if (!tokens) return;
		const owned = ["0", ...tokens];
		const [moved] = owned.splice(from, 1);
		owned.splice(to, 0, moved);
		gapAccess(axis).set(table, owned.slice(1));
	}
	/**
	* Runtime assertion function that throws an error if the condition is false.
	* Used throughout table operations to validate parameters and state.
	* This helps catch programming errors early with clear error messages.
	*
	* @param condition The condition to check
	* @param message The error message to throw if the condition is false
	* @throws {Error} If the condition is false
	*/
	function assert(condition, message) {
		if (!condition) throw new Error(`Assertion failed: ${message}`);
	}
	/**
	* Gets all cell elements from a table, including those marked as "skip".
	* This is the canonical way to get cells from a table that handles the table structure properly.
	*
	* @param table The table container element
	* @returns Array of all cell elements in DOM order
	*/
	function getTableCells(table) {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const cells = [];
		Array.from(table.children).forEach((element) => {
			if (element.classList.contains("bloom-cell")) cells.push(element);
			else console.debug(`Element ${element.tagName} is not a cell, skipping.`);
		});
		return cells;
	}
	/**
	* Creates a new cell element with proper class and default contents.
	* Uses the cell-contents module to set up the default content type.
	*
	* @returns A new HTMLElement configured as a table cell
	*/
	function createCell() {
		const newCell = document.createElement("div");
		newCell.className = "bloom-cell";
		setupContentsOfCell(newCell);
		return newCell;
	}
	const getTargetTable = () => {
		let currentElement = document.activeElement;
		if (!currentElement) {
			console.warn("No active element found. Cannot determine target table.");
			return null;
		}
		return currentElement.closest(".bloom-table") || null;
	};
	const addRow = (table, skipHistory = false, sourceIndex) => {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const description = {
			label: "Add Row",
			detail: "at the bottom edge"
		};
		const performOperation = () => {
			const info = getTableInfo(table);
			const src = resolveSourceIndex(sourceIndex, info.rowCount);
			insertLineAt(table, "row", info.rowCount, src, src != null ? "skeleton" : "blank");
		};
		if (skipHistory) performOperation();
		else addInsertionHistoryEntry(table, description, performOperation);
	};
	const removeLastRow = (table) => {
		if (!table) return;
		const info = getTableInfo(table);
		if (info.rowCount === 0) {
			console.info("No rows to remove from the target table.");
			return;
		}
		const description = {
			label: "Remove Last Row",
			detail: `row ${info.rowCount}`
		};
		const performOperation = () => removeLineAt(table, "row", getTableInfo(table).rowCount - 1);
		tableHistoryManager.addHistoryEntry(table, description, performOperation);
	};
	const addColumn = (table, skipHistory = false, sourceIndex) => {
		if (!table) return;
		const description = {
			label: "Add Column",
			detail: "at the right edge"
		};
		const performOperation = () => {
			const info = getTableInfo(table);
			if (info.rowCount === 0) {
				table.setAttribute("data-column-widths", sizesAfterGrowth(table, [...info.columnWidths, defaultColumnWidth]).join(","));
				return;
			}
			const src = resolveSourceIndex(sourceIndex, info.columnCount);
			insertLineAt(table, "column", info.columnCount, src, src != null ? "skeleton" : "blank");
		};
		if (skipHistory) performOperation();
		else addInsertionHistoryEntry(table, description, performOperation);
	};
	const undoLastOperation = (table) => {
		if (!table) return false;
		return tableHistoryManager.undo(table);
	};
	const canUndo = () => {
		return tableHistoryManager.canUndo();
	};
	const getLastOperation = () => {
		return tableHistoryManager.getLastOperationLabel();
	};
	function removeLastColumn(table) {
		if (!table) return;
		const info = getTableInfo(table);
		if (info.columnCount <= 1) {
			console.info("Cannot remove the last column.");
			return;
		}
		const description = {
			label: "Remove Last Column",
			detail: `column ${info.columnCount}`
		};
		const performOperation = () => removeLineAt(table, "column", getTableInfo(table).columnCount - 1);
		tableHistoryManager.addHistoryEntry(table, description, performOperation);
	}
	/**
	* Extracts table information from a table element's data attributes and current state.
	* This is a key utility function used throughout the codebase for table operations.
	*
	* The table stores its structure in data attributes:
	* - data-column-widths: comma-separated list of column widths
	* - data-row-heights: comma-separated list of row heights
	*
	* The actual cell count is determined by counting DOM elements with class "cell".
	*
	* @param table The table container element
	* @returns Object containing table dimensions and cell information
	*/
	function getTableInfo(table) {
		const columnWidths = getColumnWidths(table);
		const rowHeights = getRowHeights(table);
		return {
			columnWidths,
			rowHeights,
			cellCount: getTableCells(table).length,
			columnCount: columnWidths.length,
			rowCount: rowHeights.length
		};
	}
	function changeCellSpan(cell, xChange, yChange) {
		const table = cell.closest(".bloom-table");
		assert(!!table, "Cell must be inside a table element");
		const currentSpanX = parseInt(cell.getAttribute("data-span-x") || "1") || 1;
		const currentSpanY = parseInt(cell.getAttribute("data-span-y") || "1") || 1;
		const newHorizontalSpan = Math.max(1, currentSpanX + xChange);
		const newVerticalSpan = Math.max(1, currentSpanY + yChange);
		if (newHorizontalSpan === currentSpanX && newVerticalSpan === currentSpanY) return;
		const description = {
			label: "Change Cell Span",
			detail: `${describeCellPosition(table, cell) ?? "cell"}, from ${currentSpanX}x${currentSpanY} to ${newHorizontalSpan}x${newVerticalSpan}`
		};
		const performOperation = () => {
			setCellSpan(cell, newHorizontalSpan, newVerticalSpan);
		};
		tableHistoryManager.addHistoryEntry(table, description, performOperation);
	}
	/**
	* Sets the horizontal and vertical span of a cell, which determines how many columns and rows it covers.
	* This function modifies the cell's CSS custom properties (--span-x, --span-y) and removes or adds
	* the "skip" class from covered cells as needed to maintain table structure.
	*
	* Important: When a cell spans, it covers a rectangular area. All cells within that area,
	* except for the spanning cell itself, get the "skip" class to indicate they are not active.
	*
	* Example: In a 2x2 table, setCellSpan(cell(0,0), 2, 2) will mark cell(0,1), cell(1,0), and cell(1,1) as skipped.
	*
	* @param cell The cell element to apply the span to
	* @param newHorizontalSpan Number of columns the cell should span (1 = no span)
	* @param newVerticalSpan Number of rows the cell should span (1 = no span)
	* @throws {Error} If the span would exceed table boundaries
	*/
	function setCellSpan(cell, newHorizontalSpan, newVerticalSpan) {
		const table = cell.closest(".bloom-table");
		assert(!!table, "Cell must be inside a table element");
		const currentSpanX = parseInt(cell.getAttribute("data-span-x") || "1") || 1;
		const currentSpanY = parseInt(cell.getAttribute("data-span-y") || "1") || 1;
		if (newHorizontalSpan === currentSpanX && newVerticalSpan === currentSpanY) return;
		const tableInfo = getTableInfo(table);
		const { row, column } = getRowAndColumn(table, cell);
		assert(column + newHorizontalSpan <= tableInfo.columnCount, `Horizontal span ${newHorizontalSpan} from column ${column} would exceed table bounds (${tableInfo.columnCount} columns)`);
		assert(row + newVerticalSpan <= tableInfo.rowCount, `Vertical span ${newVerticalSpan} from row ${row} would exceed table bounds (${tableInfo.rowCount} rows)`);
		for (let r = row; r < row + currentSpanY; r++) for (let c = column; c < column + currentSpanX; c++) {
			if (r === row && c === column) continue;
			getCell(table, r, c).classList.remove("bloom-skip");
		}
		cell.setAttribute("data-span-x", String(newHorizontalSpan));
		cell.setAttribute("data-span-y", String(newVerticalSpan));
		if (newHorizontalSpan > 1) cell.style.setProperty("--span-x", String(newHorizontalSpan));
		else cell.style.removeProperty("--span-x");
		if (newVerticalSpan > 1) cell.style.setProperty("--span-y", String(newVerticalSpan));
		else cell.style.removeProperty("--span-y");
		for (let r = row; r < row + newVerticalSpan; r++) for (let c = column; c < column + newHorizontalSpan; c++) {
			if (r === row && c === column) continue;
			getCell(table, r, c).classList.add("bloom-skip");
		}
	}
	/**
	* Calculates the logical row and column position of a cell within the table.
	*
	* @param table The table container element
	* @param cell The cell whose position we want to find
	* @returns Object with row and column (0-based indices)
	* @throws {Error} If the cell is not found in the table
	*/
	function getRowAndColumn(table, cell) {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		assert(cell.classList.contains("bloom-cell"), "cell parameter must have 'cell' class");
		const tableInfo = getTableInfo(table);
		const cellIndex = getTableCells(table).indexOf(cell);
		assert(cellIndex !== -1, "Cell not found in the table. Ensure it is a direct child of the table.");
		const columnCount = tableInfo.columnCount;
		const row = Math.floor(cellIndex / columnCount);
		const column = cellIndex % columnCount;
		assert(row >= 0 && row < tableInfo.rowCount, `Row index ${row} is out of bounds`);
		assert(column >= 0 && column < tableInfo.columnCount, `Column index ${column} is out of bounds`);
		return {
			row,
			column
		};
	}
	/**
	* Retrieves the cell element at the specified logical row and column position.
	* This is the inverse of getRowAndColumn - given a position, find the cell.
	*
	* Like getRowAndColumn, this must account for cell spans when traversing the table.
	* It uses the same algorithm but stops when it reaches the target position.
	*
	* @param table The table container element
	* @param row The target row (0-based)
	* @param column The target column (0-based)
	* @returns The HTMLElement at the specified position
	* @throws {Error} If the position is out of bounds or no cell is found
	*/
	function getCell(table, row, column) {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const tableInfo = getTableInfo(table);
		assert(row >= 0 && row < tableInfo.rowCount, `Row index ${row} would be out of bounds`);
		assert(column >= 0 && column < tableInfo.columnCount, `Column index ${column} would be out of bounds`);
		const cellIndex = row * tableInfo.columnCount + column;
		const cells = getTableCells(table);
		assert(cellIndex < cells.length, `Cell at row ${row}, column ${column} not found in DOM (cellIndex=${cellIndex}, cells.length=${cells.length}, tableInfo=${JSON.stringify(tableInfo)})`);
		return cells[cellIndex];
	}
	/**
	* Adds a column at the specified index position.
	* @param table The table container element
	* @param index The position to insert the column (0-based). If not provided, adds at the end.
	* @param skipHistory Whether to skip adding this operation to history
	*/
	const addColumnAt = (table, index, skipHistory = false, sourceIndex) => {
		if (!table) return;
		const tableInfo = getTableInfo(table);
		const actualIndex = index ?? tableInfo.columnCount;
		assert(actualIndex >= 0 && actualIndex <= tableInfo.columnCount, `Column index ${actualIndex} is out of bounds`);
		const description = {
			label: "Add Column",
			detail: actualIndex >= tableInfo.columnCount ? "at the right edge" : `left of column ${actualIndex + 1}`
		};
		const performOperation = () => {
			const src = resolveSourceIndex(sourceIndex, tableInfo.columnCount);
			insertLineAt(table, "column", actualIndex, src, src != null ? "skeleton" : "blank");
		};
		if (skipHistory) performOperation();
		else addInsertionHistoryEntry(table, description, performOperation);
	};
	/**
	* Adds a row at the specified index position.
	* @param table The table container element
	* @param index The position to insert the row (0-based). If not provided, adds at the end.
	* @param skipHistory Whether to skip adding this operation to history
	*/
	const addRowAt = (table, index, skipHistory = false, sourceIndex) => {
		if (!table) return;
		const tableInfo = getTableInfo(table);
		const actualIndex = index ?? tableInfo.rowCount;
		assert(actualIndex >= 0 && actualIndex <= tableInfo.rowCount, `Row index ${actualIndex} is out of bounds`);
		const description = {
			label: "Add Row",
			detail: actualIndex >= tableInfo.rowCount ? "at the bottom edge" : `above row ${actualIndex + 1}`
		};
		const performOperation = () => {
			const src = resolveSourceIndex(sourceIndex, tableInfo.rowCount);
			insertLineAt(table, "row", actualIndex, src, src != null ? "skeleton" : "blank");
		};
		if (skipHistory) performOperation();
		else addInsertionHistoryEntry(table, description, performOperation);
	};
	function cloneCellForDuplicate(cell) {
		const clone = cell.cloneNode(true);
		const strip = (el) => {
			el.classList.remove("cell--selected", "bloom-current-table");
			el.style.removeProperty("anchor-name");
			delete el.dataset.btableAnchorName;
		};
		strip(clone);
		clone.querySelectorAll("*").forEach(strip);
		return clone;
	}
	function resetCloneContents(clone) {
		delete clone.dataset.contentType;
		clone.innerHTML = "";
		clone.removeAttribute("tabindex");
		setupContentsOfCell(clone);
	}
	function writeSpan(cell, x, y) {
		if (x > 1) {
			cell.setAttribute("data-span-x", String(x));
			cell.style.setProperty("--span-x", String(x));
		} else {
			cell.removeAttribute("data-span-x");
			cell.style.removeProperty("--span-x");
		}
		if (y > 1) {
			cell.setAttribute("data-span-y", String(y));
			cell.style.setProperty("--span-y", String(y));
		} else {
			cell.removeAttribute("data-span-y");
			cell.style.removeProperty("--span-y");
		}
	}
	const lineAxisOps = {
		row: {
			sizeAttr: "data-row-heights",
			defaultSize: () => "hug",
			sizes: (info) => info.rowHeights,
			lineCount: (info) => info.rowCount,
			perpCount: (info) => info.columnCount,
			cellAt: (grid, line, perp) => grid.cellAt(line, perp),
			coverAt: (grid, line, perp) => grid.coverAt(line, perp),
			lineOf: (cover) => cover.row,
			spanAlong: (cover) => cover.spanY,
			growAnchor: (cover) => writeSpan(cover.anchor, cover.spanX, cover.spanY + 1),
			referenceNodes: (table, info, insertIndex) => {
				const ref = getTableCells(table)[insertIndex * info.columnCount] ?? null;
				return new Array(info.columnCount).fill(ref);
			},
			insertEdges: (table, insertIndex, source, info) => insertEdgesForNewRow(table, insertIndex, source, info.rowCount, info.columnCount),
			removeEdges: (table, index, info) => removeEdgesForRemovedRow(table, index, info.rowCount, info.columnCount),
			spanAlongOf: (cell) => parseInt(cell.getAttribute("data-span-y") || "1") || 1,
			spanAcrossOf: (cell) => parseInt(cell.getAttribute("data-span-x") || "1") || 1,
			lineOfPos: (pos) => pos.row,
			writeSpans: (cell, along, across) => writeSpan(cell, across, along),
			reorderCells: (cells, from, to, R, C) => {
				const grid = [];
				for (let r = 0; r < R; r++) grid.push(cells.slice(r * C, (r + 1) * C));
				const [movedRowCells] = grid.splice(from, 1);
				grid.splice(to, 0, movedRowCells);
				return grid;
			},
			travelingEdges: (table, from, to, R, _C) => {
				const v = getEdgesV(table);
				if (v && v.length === R) {
					const [mv] = v.splice(from, 1);
					v.splice(to, 0, mv);
					setEdgesV(table, v);
				}
			},
			boundaryEdges: (table, from, to, R, _C) => {
				const h = getEdgesH(table);
				if (h && h.length === R + 1) {
					const tops = h.slice(0, R);
					const bottom = h[R];
					const [mt] = tops.splice(from, 1);
					tops.splice(to, 0, mt);
					setEdgesH(table, [...tops, bottom]);
				}
			}
		},
		column: {
			sizeAttr: "data-column-widths",
			defaultSize: () => defaultColumnWidth,
			sizes: (info) => info.columnWidths,
			lineCount: (info) => info.columnCount,
			perpCount: (info) => info.rowCount,
			cellAt: (grid, line, perp) => grid.cellAt(perp, line),
			coverAt: (grid, line, perp) => grid.coverAt(perp, line),
			lineOf: (cover) => cover.column,
			spanAlong: (cover) => cover.spanX,
			growAnchor: (cover) => writeSpan(cover.anchor, cover.spanX + 1, cover.spanY),
			referenceNodes: (table, info, insertIndex) => {
				const cells = getTableCells(table);
				const refs = [];
				for (let r = 0; r < info.rowCount; r++) {
					const linear = insertIndex < info.columnCount ? r * info.columnCount + insertIndex : (r + 1) * info.columnCount;
					refs.push(cells[linear] ?? null);
				}
				return refs;
			},
			insertEdges: (table, insertIndex, source, info) => insertEdgesForNewColumn(table, insertIndex, source, info.rowCount, info.columnCount),
			removeEdges: (table, index, info) => removeEdgesForRemovedColumn(table, index, info.rowCount, info.columnCount),
			spanAlongOf: (cell) => parseInt(cell.getAttribute("data-span-x") || "1") || 1,
			spanAcrossOf: (cell) => parseInt(cell.getAttribute("data-span-y") || "1") || 1,
			lineOfPos: (pos) => pos.column,
			writeSpans: (cell, along, across) => writeSpan(cell, along, across),
			reorderCells: (cells, from, to, R, C) => {
				const grid = [];
				for (let r = 0; r < R; r++) {
					const rowCells = cells.slice(r * C, (r + 1) * C);
					const [mc] = rowCells.splice(from, 1);
					rowCells.splice(to, 0, mc);
					grid.push(rowCells);
				}
				return grid;
			},
			travelingEdges: (table, from, to, R, C) => {
				const h = getEdgesH(table);
				if (h && h.length === R + 1 && h.every((row) => Array.isArray(row) && row.length === C)) {
					for (const row of h) {
						const [m] = row.splice(from, 1);
						row.splice(to, 0, m);
					}
					setEdgesH(table, h);
				}
			},
			boundaryEdges: (table, from, to, R, C) => {
				const v = getEdgesV(table);
				if (v && v.length === R && v.every((row) => Array.isArray(row) && row.length === C + 1)) setEdgesV(table, v.map((row) => {
					const lefts = row.slice(0, C);
					const right = row[C];
					const [m] = lefts.splice(from, 1);
					lefts.splice(to, 0, m);
					return [...lefts, right];
				}));
			}
		}
	};
	/**
	* The sizes a table's axis gets after that axis gains a line.
	*
	* A nested table never grows: its host cell is a fixed box, and
	* bloom-table.css stretches the table to fill that box exactly
	* (`position: absolute; inset: 0`) while the cell hides the overflow. So a
	* nested table whose tracks are fixed sizes overflows its host cell as soon as
	* a track is added, and the host cell's flex centering clips the FIRST track
	* off screen. Converting every track on the grown axis to "fill" divides the
	* host cell between them instead, so the table still fits.
	*
	* Only the axis that grew converts, and only for a nested table. Removing a
	* line converts nothing, and a top-level table keeps the sizes it was authored
	* with.
	*/
	function sizesAfterGrowth(table, sizes) {
		return isNestedTable(table) ? sizes.map(() => "fill") : sizes;
	}
	let insertedCellsSink = null;
	/**
	* Take an insertion back out in place, leaving every cell it did not create
	* exactly as it stands: the same elements, holding whatever they now hold.
	*
	* The snapshot restore that undo otherwise uses rewrites the whole table's
	* innerHTML, so every cell comes back as a fresh element. A host that attaches
	* a text editor to the cells loses it that way, along with anything the editor
	* was keeping: Bloom attaches CKEditor, whose per-box undo stack holds the
	* typing a person did BEFORE the insertion, so rebuilding the boxes puts that
	* typing out of Undo's reach for good.
	*
	* Only the insertion's own cells go, so the previous state's cells and the ones
	* left standing line up one for one, and each of those takes back the
	* attributes it had (a merge the insertion grew shrinks again this way). Where
	* the two do not line up, the live table is not the one this insertion left
	* behind, and the snapshot is restored instead.
	*/
	function undoInsertionInPlace(table, prevState, insertedCells) {
		insertedCells.forEach((cell) => cell.remove());
		const previous = table.ownerDocument.createElement("div");
		previous.innerHTML = prevState.innerHTML;
		const previousCells = Array.from(previous.children).filter((element) => element.classList.contains("bloom-cell"));
		const liveCells = getTableCells(table);
		restoreAttributes(table, prevState.attributes);
		if (previousCells.length !== liveCells.length) {
			table.innerHTML = prevState.innerHTML;
			return;
		}
		liveCells.forEach((cell, index) => copyAttributes(previousCells[index], cell));
	}
	/** Give `target` exactly the attributes in `attributes`, and no others. */
	function restoreAttributes(target, attributes) {
		Array.from(target.attributes).map((attribute) => attribute.name).forEach((name) => target.removeAttribute(name));
		Object.entries(attributes ?? {}).forEach(([name, value]) => target.setAttribute(name, value));
	}
	/** Give `target` exactly the attributes `source` has, and no others. */
	function copyAttributes(source, target) {
		const attributes = {};
		Array.from(source.attributes).forEach((attribute) => {
			attributes[attribute.name] = attribute.value;
		});
		restoreAttributes(target, attributes);
	}
	/**
	* Add the history entry for an operation that inserts a row or column, with an
	* undo that takes the new cells back out rather than rebuilding the table. See
	* undoInsertionInPlace.
	*
	* A nested table gets the ordinary snapshot undo: the snapshot in the entry is
	* the top-level table's, so it says nothing about which of the nested table's
	* cells stood before the insertion.
	*/
	function addInsertionHistoryEntry(table, description, performOperation) {
		const insertedCells = [];
		tableHistoryManager.addHistoryEntry(table, description, () => {
			insertedCellsSink = insertedCells;
			try {
				performOperation();
			} finally {
				insertedCellsSink = null;
			}
		}, isNestedTable(table) ? void 0 : (undoTable, prevState) => undoInsertionInPlace(undoTable, prevState, insertedCells));
	}
	function insertLineAt(table, axis, insertIndex, sourceIndex, mode) {
		const ops = lineAxisOps[axis];
		const info = getTableInfo(table);
		const lineCount = ops.lineCount(info);
		const perpCount = ops.perpCount(info);
		if (perpCount === 0) return;
		assert(insertIndex >= 0 && insertIndex <= lineCount, `${axis} index ${insertIndex} is out of bounds`);
		assert(mode !== "clone" || sourceIndex === insertIndex - 1, "clone mode inserts the copy directly after its source line");
		normalizeEdgeArrays(table, info.rowCount, info.columnCount);
		const grid = buildGrid(table);
		const newCells = [];
		const covers = [];
		const boundaryLine = insertIndex - 1;
		for (let p = 0; p < perpCount; p++) {
			if (mode === "clone") newCells.push(cloneCellForDuplicate(ops.cellAt(grid, sourceIndex, p)));
			else {
				const cell = createCell();
				if (mode === "skeleton" && sourceIndex != null) applyCellSettings(cell, snapshotCellSettings(ops.cellAt(grid, sourceIndex, p)));
				newCells.push(cell);
			}
			covers.push(boundaryLine >= 0 && boundaryLine < lineCount ? ops.coverAt(grid, boundaryLine, p) : null);
		}
		const referenceNodes = ops.referenceNodes(table, info, insertIndex);
		const sizes = ops.sizes(info);
		const sourceSize = sourceIndex != null ? sizes[sourceIndex] : void 0;
		sizes.splice(insertIndex, 0, sourceSize ?? ops.defaultSize());
		table.setAttribute(ops.sizeAttr, sizesAfterGrowth(table, sizes).join(","));
		const grown = /* @__PURE__ */ new Set();
		newCells.forEach((cell, p) => {
			const cover = covers[p];
			if (!cover) return;
			if (ops.lineOf(cover) + ops.spanAlong(cover) - 1 >= insertIndex) {
				cell.classList.add("bloom-skip");
				writeSpan(cell, 1, 1);
				if (mode === "clone") resetCloneContents(cell);
				if (!grown.has(cover.anchor)) {
					grown.add(cover.anchor);
					ops.growAnchor(cover);
				}
			} else if (mode === "clone" && sourceIndex != null && ops.lineOf(cover) < sourceIndex) {
				cell.classList.remove("bloom-skip");
				writeSpan(cell, 1, 1);
				resetCloneContents(cell);
			}
		});
		newCells.forEach((cell, p) => table.insertBefore(cell, referenceNodes[p]));
		insertedCellsSink?.push(...newCells);
		ops.insertEdges(table, insertIndex, sourceIndex, info);
		spliceGapForInsertedLine(table, axis, insertIndex, lineCount);
	}
	function removeLineAt(table, axis, index) {
		const ops = lineAxisOps[axis];
		const info = getTableInfo(table);
		const lineCount = ops.lineCount(info);
		const perpCount = ops.perpCount(info);
		assert(index >= 0 && index < lineCount, `${axis} index ${index} is out of bounds`);
		normalizeEdgeArrays(table, info.rowCount, info.columnCount);
		const grid = buildGrid(table);
		for (let p = 0; p < perpCount; p++) {
			const cell = ops.cellAt(grid, index, p);
			if (cell.classList.contains("bloom-skip")) continue;
			const along = ops.spanAlongOf(cell);
			if (along <= 1 || index + 1 >= lineCount) continue;
			const across = ops.spanAcrossOf(cell);
			const heir = ops.cellAt(grid, index + 1, p);
			heir.classList.remove("bloom-skip");
			ops.writeSpans(heir, along - 1, across);
		}
		for (const cell of getTableCells(table)) {
			const line = ops.lineOfPos(getRowAndColumn(table, cell));
			const along = ops.spanAlongOf(cell);
			if (line < index && line + along > index) ops.writeSpans(cell, along - 1, ops.spanAcrossOf(cell));
		}
		const cellsToRemove = [];
		for (let p = 0; p < perpCount; p++) cellsToRemove.push(ops.cellAt(grid, index, p));
		const sizes = ops.sizes(info);
		sizes.splice(index, 1);
		table.setAttribute(ops.sizeAttr, sizes.join(","));
		ops.removeEdges(table, index, info);
		spliceGapForRemovedLine(table, axis, index, lineCount);
		cellsToRemove.forEach((cell) => table.removeChild(cell));
	}
	function moveLineAt(table, axis, from, to) {
		const ops = lineAxisOps[axis];
		const info = getTableInfo(table);
		const R = info.rowCount;
		const C = info.columnCount;
		normalizeEdgeArrays(table, R, C);
		reorderGapForMovedLine(table, axis, from, to, ops.lineCount(info));
		const sizes = (table.getAttribute(ops.sizeAttr) || "").split(",");
		const [movedSize] = sizes.splice(from, 1);
		sizes.splice(to, 0, movedSize);
		table.setAttribute(ops.sizeAttr, sizes.join(","));
		ops.reorderCells(getTableCells(table), from, to, R, C).flat().forEach((cell) => table.appendChild(cell));
		ops.travelingEdges(table, from, to, R, C);
		ops.boundaryEdges(table, from, to, R, C);
	}
	/**
	* Duplicates the row at `sourceRow`, inserting the copy directly below it.
	* Unlike addRowAt (whose new cells inherit only settings), this copies
	* everything: contents, content types, spans, and borders. A vertical span
	* that continues below the source row grows one row taller (the copy's cell
	* is covered by it); a vertical span that ENDS at the source row leaves an
	* ordinary unmerged cell in the copy.
	*/
	const duplicateRowAt = (table, sourceRow, skipHistory = false) => {
		if (!table) return;
		const tableInfo = getTableInfo(table);
		assert(sourceRow >= 0 && sourceRow < tableInfo.rowCount, `Row index ${sourceRow} is out of bounds`);
		const description = {
			label: "Duplicate Row",
			detail: `row ${sourceRow + 1} into a new row ${sourceRow + 2}`
		};
		const performOperation = () => insertLineAt(table, "row", sourceRow + 1, sourceRow, "clone");
		if (skipHistory) performOperation();
		else addInsertionHistoryEntry(table, description, performOperation);
	};
	/**
	* Duplicates the column at `sourceColumn`, inserting the copy directly to its
	* right. Copies everything: contents, content types, spans, and borders.
	* A horizontal span that continues right of the source column grows one column
	* wider (the copy's cell is covered by it); a horizontal span that ENDS at the
	* source column leaves an ordinary unmerged cell in the copy.
	*/
	const duplicateColumnAt = (table, sourceColumn, skipHistory = false) => {
		if (!table) return;
		const tableInfo = getTableInfo(table);
		assert(sourceColumn >= 0 && sourceColumn < tableInfo.columnCount, `Column index ${sourceColumn} is out of bounds`);
		const description = {
			label: "Duplicate Column",
			detail: `column ${sourceColumn + 1} into a new column ${sourceColumn + 2}`
		};
		const performOperation = () => insertLineAt(table, "column", sourceColumn + 1, sourceColumn, "clone");
		if (skipHistory) performOperation();
		else addInsertionHistoryEntry(table, description, performOperation);
	};
	/**
	* Removes a column at the specified index position, adjusting spans, edges and
	* gaps as needed.
	* @param table The table container element
	* @param index The column index to remove (0-based)
	*/
	const removeColumnAt = (table, index, skipHistory = false) => {
		if (!table) return;
		const tableInfo = getTableInfo(table);
		assert(tableInfo.columnCount > 1, "Cannot remove the only column");
		assert(index >= 0 && index < tableInfo.columnCount, `Column index ${index} is out of bounds`);
		const description = {
			label: "Remove Column",
			detail: `column ${index + 1}`
		};
		const performOperation = () => removeLineAt(table, "column", index);
		if (skipHistory) performOperation();
		else tableHistoryManager.addHistoryEntry(table, description, performOperation);
	};
	/**
	* Removes a row at the specified index position, adjusting spans, edges and
	* gaps as needed.
	* @param table The table container element
	* @param index The row index to remove (0-based)
	*/
	const removeRowAt = (table, index, skipHistory = false) => {
		if (!table) return;
		const tableInfo = getTableInfo(table);
		assert(tableInfo.rowCount > 1, "Cannot remove the only row");
		assert(index >= 0 && index < tableInfo.rowCount, `Row index ${index} is out of bounds`);
		const description = {
			label: "Remove Row",
			detail: `row ${index + 1}`
		};
		const performOperation = () => removeLineAt(table, "row", index);
		if (skipHistory) performOperation();
		else tableHistoryManager.addHistoryEntry(table, description, performOperation);
	};
	/**
	* Moves the row at `from` to position `to`, carrying its cells, height, and
	* borders. Borders model: each row "owns" its top horizontal boundary; the
	* table's final bottom boundary stays fixed. Vertical edges (per-row) travel
	* with the row. Spans that straddle the moved boundary are not specially
	* handled (best-effort for simple grids).
	* @param table The table container element
	* @param from Source row index (0-based)
	* @param to Destination row index (0-based)
	*/
	const moveRowAt = (table, from, to, skipHistory = false) => {
		if (!table) return;
		const R = getTableInfo(table).rowCount;
		if (from === to) return;
		assert(from >= 0 && from < R, `Row index ${from} is out of bounds`);
		assert(to >= 0 && to < R, `Row index ${to} is out of bounds`);
		const description = {
			label: "Move Row",
			detail: `row ${from + 1} to position ${to + 1}`
		};
		const performOperation = () => moveLineAt(table, "row", from, to);
		if (skipHistory) performOperation();
		else tableHistoryManager.addHistoryEntry(table, description, performOperation);
	};
	/**
	* Moves the column at `from` to position `to`, carrying its cells, width, and
	* borders. Borders model: each column "owns" its left vertical boundary; the
	* table's final right boundary stays fixed. Horizontal edges (per-column)
	* travel with the column.
	* @param table The table container element
	* @param from Source column index (0-based)
	* @param to Destination column index (0-based)
	*/
	const moveColumnAt = (table, from, to, skipHistory = false) => {
		if (!table) return;
		const C = getTableInfo(table).columnCount;
		if (from === to) return;
		assert(from >= 0 && from < C, `Column index ${from} is out of bounds`);
		assert(to >= 0 && to < C, `Column index ${to} is out of bounds`);
		const description = {
			label: "Move Column",
			detail: `column ${from + 1} to position ${to + 1}`
		};
		const performOperation = () => moveLineAt(table, "column", from, to);
		if (skipHistory) performOperation();
		else tableHistoryManager.addHistoryEntry(table, description, performOperation);
	};
	function getRowIndex(cell) {
		const table = cell.closest(".bloom-table");
		assert(!!table, "Cell must be inside a table element");
		const { row } = getRowAndColumn(table, cell);
		return row;
	}
	function setColumnWidth(table, columnIndex, width) {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const tableInfo = getTableInfo(table);
		assert(columnIndex >= 0 && columnIndex < tableInfo.columnCount, `Column index ${columnIndex} is out of bounds`);
		const widthArray = getColumnWidths(table);
		if (columnIndex >= 0 && columnIndex < widthArray.length) {
			widthArray[columnIndex] = width;
			table.setAttribute("data-column-widths", widthArray.join(","));
		}
	}
	function getColumnWidth(table, columnIndex) {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const tableInfo = getTableInfo(table);
		assert(columnIndex >= 0 && columnIndex < tableInfo.columnCount, `Column index ${columnIndex} is out of bounds`);
		return tableInfo.columnWidths[columnIndex] ?? null;
	}
	/** Gets the raw height spec for a given row (e.g., "hug", "fill", or "42px"). */
	function getRowHeight(table, rowIndex) {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const tableInfo = getTableInfo(table);
		assert(rowIndex >= 0 && rowIndex < tableInfo.rowCount, `Row index ${rowIndex} is out of bounds`);
		return tableInfo.rowHeights[rowIndex] ?? null;
	}
	/** Sets the height for a given row to a spec (e.g., "hug", "fill", or "42px"). */
	function setRowHeight(table, rowIndex, height) {
		assert(table.classList.contains("bloom-table"), "table parameter must have 'table' class");
		const tableInfo = getTableInfo(table);
		assert(rowIndex >= 0 && rowIndex < tableInfo.rowCount, `Row index ${rowIndex} is out of bounds`);
		const heightArray = getRowHeights(table);
		while (heightArray.length < tableInfo.rowCount) heightArray.push("hug");
		if (rowIndex >= 0 && rowIndex < heightArray.length) {
			heightArray[rowIndex] = height;
			table.setAttribute("data-row-heights", heightArray.join(","));
		}
	}
	//#endregion
	//#region src/components/BorderControl/logic/types.ts
	const kCornerRadii = [
		0,
		2,
		4,
		8,
		16
	];
	const OuterEdges = [
		"top",
		"right",
		"bottom",
		"left"
	];
	const InnerEdges = ["innerH", "innerV"];
	//#endregion
	//#region src/components/BorderControl/logic/selectionToggle.ts
	/**
	* Toggle one edge (or the inner pair) in the selector's selection.
	*
	* The inner plus is a single control standing for both inner axes, so it turns
	* them on or off together: if either axis is selected the click clears both,
	* otherwise it selects both. Flipping each axis independently would turn a
	* split selection — innerH selected but not innerV, which
	* computeInitialSelection can produce — into the *other* axis, so a click meant
	* to deselect the inner borders would silently move the edit to innerV.
	*/
	function toggleSelectedEdge(selected, e) {
		const next = new Set(selected);
		if (e === "inner") {
			const anySelected = InnerEdges.some((ie) => next.has(ie));
			for (const ie of InnerEdges) if (anySelected) next.delete(ie);
			else next.add(ie);
		} else if (next.has(e)) next.delete(e);
		else next.add(e);
		return next;
	}
	//#endregion
	//#region src/components/BorderControl/BorderSelector.tsx
	function BorderSelector(props) {
		const { showInner = true, selected, onChange } = props;
		const size = props.size ?? 112;
		const stroke = kBloomBlue;
		const look = props.look ?? "flat";
		const isSel = (e) => selected.has(e);
		const toggle = (e) => onChange(toggleSelectedEdge(selected, e));
		const w = size;
		const h = size;
		const pad = 10;
		const outerRect = {
			x: pad,
			y: pad,
			w: w - pad * 2,
			h: h - pad * 2
		};
		const BAR_THICKNESS = 10;
		const GAP = 2;
		const leftRect = {
			x: outerRect.x,
			y: outerRect.y,
			w: BAR_THICKNESS,
			h: outerRect.h
		};
		const rightRect = {
			x: outerRect.x + outerRect.w - BAR_THICKNESS,
			y: outerRect.y,
			w: BAR_THICKNESS,
			h: outerRect.h
		};
		const topRect = {
			x: outerRect.x + BAR_THICKNESS + GAP,
			y: outerRect.y,
			w: outerRect.w - 24,
			h: BAR_THICKNESS
		};
		const bottomRect = {
			x: topRect.x,
			y: outerRect.y + outerRect.h - BAR_THICKNESS,
			w: topRect.w,
			h: BAR_THICKNESS
		};
		const innerBounds = {
			x: outerRect.x + BAR_THICKNESS,
			y: outerRect.y + BAR_THICKNESS,
			w: outerRect.w - 2 * BAR_THICKNESS,
			h: outerRect.h - 2 * BAR_THICKNESS
		};
		const INNER_GAP = 2;
		const innerHRect = {
			x: innerBounds.x + INNER_GAP,
			y: innerBounds.y + innerBounds.h / 2 - BAR_THICKNESS / 2,
			w: innerBounds.w - 2 * INNER_GAP,
			h: BAR_THICKNESS
		};
		const innerVRect = {
			x: innerBounds.x + innerBounds.w / 2 - BAR_THICKNESS / 2,
			y: innerBounds.y + INNER_GAP,
			w: BAR_THICKNESS,
			h: innerBounds.h - 2 * INNER_GAP
		};
		const segOpacity = (edge) => isSel(edge) ? 1 : .6;
		const ACTIVE = stroke;
		const INACTIVE = "#9bbcc0";
		const fillFor = (edge) => isSel(edge) ? ACTIVE : INACTIVE;
		const useGradients = look === "gradients" || look === "card";
		const useBevel = look === "bevel" || look === "card";
		const useRounded = look === "rounded" || look === "card";
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: w,
			height: h,
			viewBox: `0 0 ${w} ${h}`,
			"aria-label": "Border selector",
			style: { filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" },
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("defs", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
						id: "gradTop",
						x1: "0",
						y1: "0",
						x2: "0",
						y2: "1",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "#3b8993"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "#1d4d53"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
						id: "gradBottom",
						x1: "0",
						y1: "1",
						x2: "0",
						y2: "0",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "#3b8993"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "#1d4d53"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
						id: "gradLeft",
						x1: "0",
						y1: "0",
						x2: "1",
						y2: "0",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "#3b8993"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "#1d4d53"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
						id: "gradRight",
						x1: "1",
						y1: "0",
						x2: "0",
						y2: "0",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "#3b8993"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "#1d4d53"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
						id: "gradInnerH",
						x1: "0",
						y1: "0",
						x2: "0",
						y2: "1",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "#3b8993"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "#1d4d53"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
						id: "gradInnerV",
						x1: "0",
						y1: "0",
						x2: "1",
						y2: "0",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: "#3b8993"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: "#1d4d53"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("filter", {
						id: "insetShadow",
						x: "-20%",
						y: "-20%",
						width: "140%",
						height: "140%",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("feOffset", {
								dx: "0",
								dy: "1"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("feGaussianBlur", {
								stdDeviation: "1.5",
								result: "blur"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("feComposite", {
								in: "SourceGraphic",
								in2: "blur",
								operator: "arithmetic",
								k2: "-1",
								k3: "1"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("feColorMatrix", {
								type: "matrix",
								values: "1 0 0 0 0\n                    0 1 0 0 0\n                    0 0 1 0 0\n                    0 0 0 0.25 0"
							})
						]
					})
				] }),
				look === "card" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: outerRect.x - 6,
					y: outerRect.y - 6,
					width: outerRect.w + 12,
					height: outerRect.h + 12,
					rx: 8,
					fill: "#f6fbfc",
					stroke: "#d3e3e6",
					filter: "url(#insetShadow)"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: leftRect.x,
					y: leftRect.y,
					width: leftRect.w,
					height: leftRect.h,
					ry: useRounded ? 3 : 0,
					fill: useGradients ? "url(#gradLeft)" : fillFor("left"),
					opacity: segOpacity("left"),
					onClick: () => toggle("left"),
					style: { cursor: "pointer" },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: "Toggle left border" })
				}),
				useBevel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: leftRect.x,
					y: leftRect.y,
					width: 1,
					height: leftRect.h,
					fill: "#ffffff66"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: leftRect.x + leftRect.w - 1,
					y: leftRect.y,
					width: 1,
					height: leftRect.h,
					fill: "#00000033"
				})] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: topRect.x,
					y: topRect.y,
					width: topRect.w,
					height: topRect.h,
					rx: useRounded ? 3 : 0,
					fill: useGradients ? "url(#gradTop)" : fillFor("top"),
					opacity: segOpacity("top"),
					onClick: () => toggle("top"),
					style: { cursor: "pointer" },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: "Toggle top border" })
				}),
				useBevel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: topRect.x,
					y: topRect.y,
					width: topRect.w,
					height: 1,
					fill: "#ffffff66"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: topRect.x,
					y: topRect.y + topRect.h - 1,
					width: topRect.w,
					height: 1,
					fill: "#00000033"
				})] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: rightRect.x,
					y: rightRect.y,
					width: rightRect.w,
					height: rightRect.h,
					ry: useRounded ? 3 : 0,
					fill: useGradients ? "url(#gradRight)" : fillFor("right"),
					opacity: segOpacity("right"),
					onClick: () => toggle("right"),
					style: { cursor: "pointer" },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: "Toggle right border" })
				}),
				useBevel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: rightRect.x,
					y: rightRect.y,
					width: 1,
					height: rightRect.h,
					fill: "#ffffff66"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: rightRect.x + rightRect.w - 1,
					y: rightRect.y,
					width: 1,
					height: rightRect.h,
					fill: "#00000033"
				})] }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: bottomRect.x,
					y: bottomRect.y,
					width: bottomRect.w,
					height: bottomRect.h,
					rx: useRounded ? 3 : 0,
					fill: useGradients ? "url(#gradBottom)" : fillFor("bottom"),
					opacity: segOpacity("bottom"),
					onClick: () => toggle("bottom"),
					style: { cursor: "pointer" },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: "Toggle bottom border" })
				}),
				useBevel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: bottomRect.x,
					y: bottomRect.y,
					width: bottomRect.w,
					height: 1,
					fill: "#ffffff66"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: bottomRect.x,
					y: bottomRect.y + bottomRect.h - 1,
					width: bottomRect.w,
					height: 1,
					fill: "#00000033"
				})] }),
				showInner && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
					opacity: selected.has("innerH") || selected.has("innerV") ? 1 : .5,
					onClick: () => toggle("inner"),
					style: { cursor: "pointer" },
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: "Toggle inner borders" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: innerHRect.x,
							y: innerHRect.y,
							width: innerHRect.w,
							height: innerHRect.h,
							rx: useRounded ? 3 : 0,
							fill: useGradients ? "url(#gradInnerH)" : fillFor("innerH")
						}),
						useBevel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: innerHRect.x,
							y: innerHRect.y,
							width: innerHRect.w,
							height: 1,
							fill: "#ffffff66"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: innerHRect.x,
							y: innerHRect.y + innerHRect.h - 1,
							width: innerHRect.w,
							height: 1,
							fill: "#00000033"
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: innerVRect.x,
							y: innerVRect.y,
							width: innerVRect.w,
							height: innerVRect.h,
							ry: useRounded ? 3 : 0,
							fill: useGradients ? "url(#gradInnerV)" : fillFor("innerV")
						}),
						useBevel && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: innerVRect.x,
							y: innerVRect.y,
							width: 1,
							height: innerVRect.h,
							fill: "#ffffff66"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: innerVRect.x + innerVRect.w - 1,
							y: innerVRect.y,
							width: 1,
							height: innerVRect.h,
							fill: "#00000033"
						})] })
					]
				})
			]
		});
	}
	//#endregion
	//#region src/components/BorderControl/BorderMenu.tsx
	const BorderMenu = (props) => {
		const { label, value, options, onChange, disabled, renderButtonImage, hideLabels } = props;
		const [open, setOpen] = (0, react.useState)(false);
		const btnRef = (0, react.useRef)(null);
		const popRef = (0, react.useRef)(null);
		const [pos, setPos] = (0, react.useState)({
			top: 0,
			left: 0
		});
		(0, react.useLayoutEffect)(() => {
			if (!open) return;
			const btn = btnRef.current;
			const pop = popRef.current;
			if (!btn || !pop) return;
			const b = btn.getBoundingClientRect();
			const popWidth = pop.offsetWidth;
			const popHeight = pop.offsetHeight;
			const margin = 8;
			let left = b.right - popWidth;
			const maxLeft = window.innerWidth - popWidth - margin;
			if (left > maxLeft) left = maxLeft;
			if (left < margin) left = margin;
			let top = b.bottom + 4;
			if (top + popHeight > window.innerHeight - margin) {
				const above = b.top - 4 - popHeight;
				top = above >= margin ? above : Math.max(margin, window.innerHeight - popHeight - margin);
			}
			setPos({
				top,
				left
			});
		}, [open]);
		(0, react.useEffect)(() => {
			function onDoc(e) {
				if (!open) return;
				const t = e.target;
				if (popRef.current && popRef.current.contains(t)) return;
				if (btnRef.current && btnRef.current.contains(t)) return;
				setOpen(false);
			}
			document.addEventListener("mousedown", onDoc);
			return () => document.removeEventListener("mousedown", onDoc);
		}, [open]);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: {
				position: "relative",
				display: "inline-block"
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				ref: btnRef,
				title: label + (value === "mixed" ? ": Mixed" : `: ${String(value)}`),
				"aria-label": label,
				disabled,
				onClick: () => setOpen((o) => !o),
				style: {
					background: "#2b6e77",
					color: "#fff",
					border: "none",
					borderRadius: 4,
					padding: "6px 8px",
					minWidth: 64,
					height: 24,
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					cursor: disabled ? "not-allowed" : "pointer",
					opacity: disabled ? .5 : 1
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center"
					},
					children: renderButtonImage ? renderButtonImage(value) : value === "mixed" ? "Mixed" : String(value)
				})
			}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: popRef,
				role: "menu",
				style: {
					position: "fixed",
					zIndex: 1e3,
					top: pos.top,
					left: pos.left,
					background: "#ffffff",
					color: "#1f3a40",
					border: "1px solid #ccc",
					borderRadius: 6,
					boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
					padding: 4,
					minWidth: 140
				},
				children: options.map((opt) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "menuitemradio",
					"aria-checked": value !== "mixed" && value === opt.value,
					onClick: () => {
						onChange(opt.value);
						setOpen(false);
					},
					title: opt.label,
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: hideLabels ? "center" : "flex-start",
						gap: 8,
						padding: "6px 10px",
						width: "100%",
						boxSizing: "border-box",
						cursor: "pointer",
						borderRadius: 4,
						background: value !== "mixed" && value === opt.value ? "#d6edf0" : "transparent"
					},
					children: [opt.icon ? opt.icon() : null, !hideLabels && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: { color: "#1f3a40" },
						children: opt.label
					})]
				}, String(opt.value)))
			})]
		});
	};
	//#endregion
	//#region src/components/BorderControl/icons/weightSampleLine.tsx
	function WeightSampleLine({ value, style, color = "#fff", fullWidth }) {
		if (value === "mixed") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: { fontSize: 11 },
			children: "Mixed"
		});
		if (value === 0) {
			const content = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				style: {
					fontSize: 13,
					fontWeight: 600,
					color
				},
				children: "Ø"
			});
			return fullWidth ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					width: "100%",
					display: "flex",
					justifyContent: "center"
				},
				children: content
			}) : content;
		}
		const strokeWidth = value;
		const visible = value > 0;
		const stroke = color;
		const svgWidth = fullWidth ? "100%" : 32;
		const viewBoxWidth = fullWidth ? 100 : 32;
		const xStart = fullWidth ? 0 : 4;
		const xEnd = fullWidth ? viewBoxWidth : 28;
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: svgWidth,
			height: 18,
			viewBox: `0 0 ${viewBoxWidth} 18`,
			"aria-hidden": true,
			children: visible ? style === "double" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
				x1: xStart,
				y1: "7",
				x2: xEnd,
				y2: "7",
				stroke,
				strokeWidth: Math.max(1, strokeWidth - 1)
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
				x1: xStart,
				y1: "11",
				x2: xEnd,
				y2: "11",
				stroke,
				strokeWidth: Math.max(1, strokeWidth - 1)
			})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
				x1: xStart,
				y1: "9",
				x2: xEnd,
				y2: "9",
				stroke,
				strokeWidth
			}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: xStart,
				y: "8",
				width: xEnd - xStart,
				height: "2",
				fill: "transparent"
			})
		});
	}
	//#endregion
	//#region src/components/BorderControl/menus/WeightMenu.tsx
	const options$2 = [
		{
			value: 0,
			label: "0 (None)"
		},
		{
			value: 1,
			label: "1"
		},
		{
			value: 2,
			label: "2"
		},
		{
			value: 4,
			label: "4"
		}
	];
	function WeightMenu(props) {
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BorderMenu, {
			label: "Weight",
			value: props.value,
			options: options$2.map((o) => ({
				value: o.value,
				label: o.label,
				icon: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: { width: "100%" },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WeightSampleLine, {
						value: o.value,
						style: props.currentStyle,
						color: "#1f3a40",
						fullWidth: true
					})
				})
			})),
			onChange: props.onChange,
			disabled: props.disabled,
			renderButtonImage: (v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WeightSampleLine, {
				value: v,
				style: props.currentStyle
			}),
			hideLabels: true
		});
	}
	//#endregion
	//#region src/components/BorderControl/icons/styleSampleLine.tsx
	function StyleSampleLine({ value, color = "#fff", fullWidth }) {
		if (value === "mixed") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: { fontSize: 11 },
			children: "Mixed"
		});
		if (value === "none") {
			const content = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				style: {
					fontSize: 13,
					fontWeight: 600,
					color
				},
				children: "Ø"
			});
			return fullWidth ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					width: "100%",
					display: "flex",
					justifyContent: "center"
				},
				children: content
			}) : content;
		}
		const svgWidth = fullWidth ? "100%" : 32;
		const viewBoxWidth = fullWidth ? 100 : 32;
		const xStart = fullWidth ? 0 : 4;
		const xEnd = fullWidth ? viewBoxWidth : 28;
		const dashMap = {
			solid: void 0,
			dashed: "6 4",
			dotted: "1 3",
			double: void 0
		};
		if (value === "double") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: svgWidth,
			height: 18,
			viewBox: `0 0 ${viewBoxWidth} 18`,
			"aria-hidden": true,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
				x1: xStart,
				y1: 7,
				x2: xEnd,
				y2: 7,
				stroke: color,
				strokeWidth: 1
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
				x1: xStart,
				y1: 11,
				x2: xEnd,
				y2: 11,
				stroke: color,
				strokeWidth: 1
			})]
		});
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: svgWidth,
			height: 18,
			viewBox: `0 0 ${viewBoxWidth} 18`,
			"aria-hidden": true,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
				x1: xStart,
				y1: 9,
				x2: xEnd,
				y2: 9,
				stroke: color,
				strokeWidth: 2,
				strokeDasharray: dashMap[value]
			})
		});
	}
	//#endregion
	//#region src/components/BorderControl/menus/StyleMenu.tsx
	const options$1 = [
		{
			value: "none",
			label: "None"
		},
		{
			value: "solid",
			label: "Solid"
		},
		{
			value: "dashed",
			label: "Dashed"
		},
		{
			value: "dotted",
			label: "Dotted"
		},
		{
			value: "double",
			label: "Double"
		}
	];
	function StyleMenu(props) {
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BorderMenu, {
			label: "Style",
			value: props.value,
			options: options$1.map((o) => ({
				value: o.value,
				label: o.label,
				icon: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: { width: "100%" },
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StyleSampleLine, {
						value: o.value,
						color: "#1f3a40",
						fullWidth: true
					})
				})
			})),
			onChange: props.onChange,
			disabled: props.disabled,
			renderButtonImage: (v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StyleSampleLine, { value: v }),
			hideLabels: true
		});
	}
	//#endregion
	//#region src/components/BorderControl/logic/selectionInit.ts
	function tupleForEdge(v) {
		return `${v.weight}|${v.style}|${v.radius}`;
	}
	/**
	* REVIEW: This wasn't a human decision: I (JH) am not clear
	* if it's better to try to be smart like this, or better to
	* always select everything? I think we'll only know after
	* working with it for a while.
	*
	* Compute initial selected edges by grouping edges whose values match exactly.
	* - Choose the largest group.
	* - Ties: prefer a group with any outer edge over inner-only.
	* - If still tied, prefer the group with more contiguous outer edges (crude heuristic).
	* - Else pick the first group deterministically by alphabetical edge order.
	*/
	function computeInitialSelection(valueMap, showInner) {
		const edges = [...OuterEdges, ...showInner ? InnerEdges : []];
		const groupsByKey = /* @__PURE__ */ new Map();
		for (const e of edges) {
			const v = valueMap[e];
			const key = tupleForEdge(v);
			const g = groupsByKey.get(key) ?? {
				key,
				edges: []
			};
			g.edges.push(e);
			groupsByKey.set(key, g);
		}
		const groups = Array.from(groupsByKey.values());
		groups.sort((a, b) => {
			if (b.edges.length !== a.edges.length) return b.edges.length - a.edges.length;
			const aHasOuter = a.edges.some((e) => OuterEdges.includes(e));
			if (aHasOuter !== b.edges.some((e) => OuterEdges.includes(e))) return aHasOuter ? -1 : 1;
			const contiguity = (edgesList) => {
				const order = [
					"top",
					"right",
					"bottom",
					"left"
				];
				const set = new Set(edgesList.filter((e) => OuterEdges.includes(e)));
				let score = 0;
				for (let i = 0; i < order.length; i++) {
					const a = order[i];
					const b = order[(i + 1) % order.length];
					if (set.has(a) && set.has(b)) score++;
				}
				return score;
			};
			const aScore = contiguity(a.edges);
			const bScore = contiguity(b.edges);
			if (bScore !== aScore) return bScore - aScore;
			return a.edges.join(",").localeCompare(b.edges.join(","));
		});
		const chosen = groups[0]?.edges ?? [];
		return new Set(chosen);
	}
	//#endregion
	//#region src/components/BorderControl/logic/mixedState.ts
	function unique(arr) {
		return Array.from(new Set(arr));
	}
	function computeMixedWeight(map, sel) {
		const values = unique(Array.from(sel).map((e) => map[e]?.weight)).filter((v) => v !== void 0);
		if (values.length === 0) return "mixed";
		return values.length === 1 ? values[0] : "mixed";
	}
	function computeMixedStyle(map, sel) {
		const values = unique(Array.from(sel).map((e) => map[e]?.style)).filter((v) => v !== void 0);
		if (values.length === 0) return "mixed";
		return values.length === 1 ? values[0] : "mixed";
	}
	function interdependencyDisabled(weight, style) {
		if (weight === "mixed" || style === "mixed") return {
			weightDisabled: false,
			styleDisabled: false
		};
		const weightIsNone = weight === 0;
		const styleIsNone = style === "none";
		if (weightIsNone && !styleIsNone) return {
			weightDisabled: false,
			styleDisabled: true
		};
		if (!weightIsNone && styleIsNone) return {
			weightDisabled: true,
			styleDisabled: false
		};
		return {
			weightDisabled: false,
			styleDisabled: false
		};
	}
	//#endregion
	//#region src/components/BorderControl/BorderControl.tsx
	function BorderControl(props) {
		const showInner = props.showInner ?? true;
		const [valueMap, setValueMap] = (0, react.useState)(props.valueMap);
		const [selected, setSelected] = (0, react.useState)(() => props.initialSelected ?? computeInitialSelection(props.valueMap, showInner));
		const identityRef = (0, react.useRef)(props.identity);
		(0, react.useEffect)(() => {
			setValueMap(props.valueMap);
			if (identityRef.current !== props.identity) {
				identityRef.current = props.identity;
				setSelected(props.initialSelected ?? computeInitialSelection(props.valueMap, showInner));
			}
		}, [props.valueMap, props.identity]);
		const weight = (0, react.useMemo)(() => computeMixedWeight(valueMap, selected), [valueMap, selected]);
		const style = (0, react.useMemo)(() => computeMixedStyle(valueMap, selected), [valueMap, selected]);
		const disabled = interdependencyDisabled(weight, style);
		const selectorLook = "rounded";
		const apply = (change) => {
			const edges = Array.from(selected);
			if (edges.length === 0) return;
			const next = { ...valueMap };
			for (const e of edges) {
				const { weight, style } = normalizeEdgeChange(next[e], change);
				next[e] = {
					...next[e],
					weight,
					style
				};
			}
			setValueMap(next);
			props.onChange(next);
		};
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			style: {
				display: "flex",
				alignItems: "center",
				gap: 12
			},
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BorderSelector, {
				valueMap,
				showInner,
				selected,
				onChange: setSelected,
				size: 80,
				look: selectorLook
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 8
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StyleMenu, {
					value: style,
					onChange: (v) => apply({ style: v }),
					disabled: disabled.styleDisabled
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WeightMenu, {
					value: weight,
					currentStyle: style,
					onChange: (v) => apply({ weight: v }),
					disabled: disabled.weightDisabled
				})]
			})]
		}) });
	}
	//#endregion
	//#region src/components/sectionStyles.ts
	const sectionStyle = "border-b border-gray-700 pb-3 flex flex-col gap-2";
	const sectionTitleStyle = "px-4 pt-1 text-2xl font-semibold";
	const subTitleStyle = "px-4 text-base opacity-90";
	//#endregion
	//#region src/components/Section.tsx
	const Section = ({ label, className, titleClassName, children, onMouseEnter, onMouseLeave }) => {
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: [sectionStyle, className].filter(Boolean).join(" "),
			onMouseEnter,
			onMouseLeave,
			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
				className: [sectionTitleStyle, titleClassName].filter(Boolean).join(" "),
				children: label
			}), children]
		});
	};
	//#endregion
	//#region src/components/BorderControl/icons/cornerSampleImage.tsx
	function CornerSampleImage({ value, color = "#fff" }) {
		if (value === "mixed") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
			style: { fontSize: 11 },
			children: "Mixed"
		});
		const size = 20;
		const borderWidth = 2;
		const r = Math.max(0, Math.min(value, size));
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			"aria-hidden": true,
			style: {
				width: size,
				height: size,
				display: "block",
				margin: "auto"
			},
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
				width: size,
				height: size,
				borderLeft: `${borderWidth}px solid ${color}`,
				borderTop: `${borderWidth}px solid ${color}`,
				boxSizing: "border-box",
				borderTopLeftRadius: r,
				borderTopRightRadius: 0,
				borderBottomLeftRadius: 0,
				borderBottomRightRadius: 0
			} })
		});
	}
	//#endregion
	//#region src/components/BorderControl/menus/CornerMenu.tsx
	const options = [
		{
			value: 0,
			label: "0"
		},
		{
			value: 4,
			label: "4"
		},
		{
			value: 8,
			label: "8"
		},
		{
			value: 16,
			label: "16"
		}
	];
	function CornerMenu(props) {
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BorderMenu, {
			label: "Corners",
			value: props.value,
			options: options.map((o) => ({
				value: o.value,
				label: o.label,
				icon: () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CornerSampleImage, {
					value: o.value,
					color: "#1f3a40"
				})
			})),
			onChange: props.onChange,
			disabled: props.disabled,
			renderButtonImage: (v) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CornerSampleImage, { value: v }),
			hideLabels: true
		});
	}
	//#endregion
	//#region src/components/TableApiContext.tsx
	/** The api built from this module's own functions; used when no api is injected. */
	const defaultTableApi = {
		BloomTable,
		getRowIndex,
		getRowAndColumn,
		canUndo,
		undoLastOperation,
		getTargetTable,
		setupContentsOfCell,
		contentTypeOptions,
		getCurrentContentTypeId,
		render,
		applyCellPerimeter,
		ensureEdgesArrays,
		applyUniformInner,
		setDefaultBorder,
		applyOuterBorders,
		getCellPerimeterValueMap,
		getTableOuterBorderValueMap,
		getCellAlign,
		setCellAlign,
		getCellCorners,
		setCellCorners,
		getCellPadding,
		setCellPadding,
		getCellBackground,
		setCellBackground,
		getTableBackground,
		setTableBackground,
		getGapX,
		setGapX,
		getGapY,
		setGapY
	};
	const TableApiContext = (0, react.createContext)(defaultTableApi);
	/** Read the injected table api (falls back to defaultTableApi via the context). */
	const useTableApi = () => (0, react.useContext)(TableApiContext);
	//#endregion
	//#region src/components/ColorPickerContext.tsx
	/** Minimal built-in picker so the demo / same-realm hosts work without injection. */
	const DefaultColorPicker = ({ value, onChange, label }) => {
		const hex = /^#([0-9a-f]{6})$/i.test(value) ? value : "#ffffff";
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className: "flex items-center gap-2 ml-2",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
				type: "color",
				"aria-label": label ?? "Background color",
				title: label,
				value: hex,
				onMouseDown: (e) => e.preventDefault(),
				onChange: (e) => onChange(e.target.value),
				style: {
					width: 32,
					height: 24,
					padding: 0,
					border: "none",
					background: "none",
					cursor: "pointer"
				}
			})
		});
	};
	const ColorPickerContext = (0, react.createContext)(DefaultColorPicker);
	/** Read the injected color picker (falls back to DefaultColorPicker). */
	const useColorPicker = () => (0, react.useContext)(ColorPickerContext);
	//#endregion
	//#region src/components/Slider.tsx
	const Slider = ({ label, value, min, max, step = 1, unit = "", disabled, onChange, className, identity, ...rest }) => {
		const [local, setLocal] = (0, react.useState)(value);
		const lastEmitted = (0, react.useRef)(value);
		(0, react.useEffect)(() => {
			if (value !== lastEmitted.current) {
				lastEmitted.current = value;
				setLocal(value);
			}
		}, [value, identity]);
		const handle = (v) => {
			lastEmitted.current = v;
			setLocal(v);
			onChange(v);
		};
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
			className: ["flex items-center gap-2", className].filter(Boolean).join(" "),
			children: [
				label && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "text-sm opacity-80",
					style: { minWidth: 12 },
					children: label
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "range",
					min,
					max,
					step,
					value: local,
					disabled,
					"aria-label": rest["aria-label"] ?? label,
					onChange: (e) => handle(parseFloat(e.target.value)),
					style: {
						flex: 1,
						accentColor: kBloomBlue,
						cursor: disabled ? "not-allowed" : "pointer"
					}
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "text-sm tabular-nums",
					style: {
						minWidth: 46,
						textAlign: "right"
					},
					children: [local, unit]
				})
			]
		});
	};
	//#endregion
	//#region src/components/useClearPulseOnUnmount.ts
	function useClearPulseOnUnmount(target) {
		const last = (0, react.useRef)(null);
		if (target) last.current = target;
		(0, react.useEffect)(() => {
			return () => clearPulse(last.current);
		}, []);
	}
	//#endregion
	//#region src/components/elementKey.ts
	const keys = /* @__PURE__ */ new WeakMap();
	let nextId = 0;
	function elementKey(el) {
		if (!el) return void 0;
		let k = keys.get(el);
		if (!k) {
			k = `el-${++nextId}`;
			keys.set(el, k);
		}
		return k;
	}
	//#endregion
	//#region src/components/TableSection.tsx
	const parsePx = (s) => {
		if (!s) return 0;
		const n = parseFloat(s);
		return isNaN(n) ? 0 : n;
	};
	const buildBorderMapFromTable = (api, g) => {
		const cs = getComputedStyle(g);
		const base = api.getTableOuterBorderValueMap(g);
		const radiusPx = parsePx(cs.borderTopLeftRadius);
		const radius = kCornerRadii.includes(radiusPx) ? radiusPx : 0;
		return {
			top: {
				...base.top,
				radius
			},
			right: {
				...base.right,
				radius
			},
			bottom: {
				...base.bottom,
				radius
			},
			left: {
				...base.left,
				radius
			},
			innerH: base.innerH,
			innerV: base.innerV
		};
	};
	const applyBorderMapToTable = (api, g, map, color) => {
		const cs = getComputedStyle(g);
		const firstCell = g.querySelector(".bloom-cell");
		const current = firstCell ? representativeBorderColorHex(firstCell) : (cs.color || "#000").trim();
		const outerColor = (color ?? current).trim();
		const innerColor = (color ?? current).trim();
		api.setDefaultBorder(g, {
			weight: map.innerH.weight,
			style: map.innerH.style,
			color: innerColor
		}, innerColor);
		api.applyOuterBorders(g, {
			top: {
				weight: map.top.weight,
				style: map.top.style,
				color: outerColor
			},
			right: {
				weight: map.right.weight,
				style: map.right.style,
				color: outerColor
			},
			bottom: {
				weight: map.bottom.weight,
				style: map.bottom.style,
				color: outerColor
			},
			left: {
				weight: map.left.weight,
				style: map.left.style,
				color: outerColor
			}
		}, outerColor);
		api.applyUniformInner(g, "innerH", {
			weight: map.innerH.weight,
			style: map.innerH.style,
			color: innerColor
		}, innerColor);
		api.applyUniformInner(g, "innerV", {
			weight: map.innerV.weight,
			style: map.innerV.style,
			color: innerColor
		}, innerColor);
		api.render(g);
	};
	const menuItemStyle$1 = "flex items-center gap-2 px-4 py-1 cursor-pointer w-full text-left";
	const tableCells = (g) => Array.from(g.children).filter((c) => c instanceof HTMLElement && c.classList.contains("bloom-cell"));
	const TableSection = ({ table }) => {
		const api = useTableApi();
		const ColorPicker = useColorPicker();
		const getCornerValue = (g) => {
			if (!g) return 0;
			const cs = getComputedStyle(g);
			const radii = [
				parsePx(cs.borderTopLeftRadius),
				parsePx(cs.borderTopRightRadius),
				parsePx(cs.borderBottomRightRadius),
				parsePx(cs.borderBottomLeftRadius)
			].map((n) => Math.round(n));
			const uniq = Array.from(new Set(radii));
			if (uniq.length !== 1) return "mixed";
			const r = uniq[0];
			return kCornerRadii.includes(r) ? r : "mixed";
		};
		const domCornerValue = getCornerValue(table);
		const [cornerValue, setCornerValue] = (0, react.useState)(domCornerValue);
		const lastEmitted = (0, react.useRef)(domCornerValue);
		(0, react.useEffect)(() => {
			if (domCornerValue !== lastEmitted.current) {
				lastEmitted.current = domCornerValue;
				setCornerValue(domCornerValue);
			}
		}, [domCornerValue]);
		useClearPulseOnUnmount(table);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Section, {
			label: "Table",
			onMouseEnter: () => pulseTableBorders(table),
			onMouseLeave: () => clearPulse(table),
			children: table && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: (() => {
				const valueMap = buildBorderMapFromTable(api, table);
				const cornerDisabled = valueMap.top.weight === 0 || valueMap.top.style === "none";
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: menuItemStyle$1,
						style: { cursor: "default" },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BorderControl, {
							identity: elementKey(table),
							valueMap,
							showInner: true,
							onChange: (next) => applyBorderMapToTable(api, table, next)
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: menuItemStyle$1,
						style: {
							cursor: "default",
							display: "block"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "text-sm opacity-80 mb-2",
							children: "Border color"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							onMouseEnter: () => clearPulse(table),
							onMouseLeave: () => pulseTableBorders(table),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColorPicker, {
								label: "Table border color",
								value: table.querySelector(".bloom-cell") ? representativeBorderColorHex(table.querySelector(".bloom-cell")) : "#000000",
								onChange: (color) => {
									if (!color) return;
									applyBorderMapToTable(api, table, buildBorderMapFromTable(api, table), color);
								}
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: menuItemStyle$1,
						style: { cursor: "default" },
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CornerMenu, {
							value: cornerValue,
							onChange: (v) => {
								if (!table) return;
								const ctrl = new api.BloomTable(table);
								lastEmitted.current = v;
								setCornerValue(v);
								ctrl.setTableCorners(v);
							},
							disabled: cornerDisabled
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: menuItemStyle$1,
						style: {
							cursor: "default",
							display: "block"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "text-sm opacity-80 mb-2",
							children: "Gap (X / Y)"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-2 ml-2",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
								"aria-label": "Gap X",
								identity: elementKey(table),
								label: "X",
								min: 0,
								max: 100,
								unit: "px",
								value: parsePx(api.getGapX(table)[0]),
								onChange: (v) => {
									api.setGapX(table, `${v}px`);
									api.render(table);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
								"aria-label": "Gap Y",
								identity: elementKey(table),
								label: "Y",
								min: 0,
								max: 100,
								unit: "px",
								value: parsePx(api.getGapY(table)[0]),
								onChange: (v) => {
									api.setGapY(table, `${v}px`);
									api.render(table);
								}
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: menuItemStyle$1,
						style: {
							cursor: "default",
							display: "block"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "text-sm opacity-80 mb-2",
							children: "Fill"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							onMouseEnter: () => clearPulse(table),
							onMouseLeave: () => pulseTableBorders(table),
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColorPicker, {
								label: "Table fill",
								value: (tableCells(table)[0] && api.getCellBackground(tableCells(table)[0])) ?? api.getTableBackground(table) ?? "",
								onChange: (color) => {
									const next = color || null;
									api.setTableBackground(table, null);
									tableCells(table).forEach((cell) => api.setCellBackground(cell, next));
									api.render(table);
								}
							})
						})]
					})
				] });
			})() })
		});
	};
	//#endregion
	//#region src/components/icons/row-add-before.svg
	var row_add_before_default = "data:image/svg+xml,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M9 5C9 5.28333 9.096 5.52067 9.288 5.712C9.48 5.90333 9.71733 5.99933 10 6H11V7C11 7.28333 11.096 7.52067 11.288 7.712C11.48 7.90333 11.7173 7.99933 12 8C12.2827 8.00067 12.52 7.90467 12.712 7.712C12.904 7.51933 13 7.282 13 7V6H14C14.2833 6 14.5207 5.904 14.712 5.712C14.9033 5.52 14.9993 5.28267 15 5C15.0007 4.71733 14.9047 4.47967 14.712 4.287C14.5193 4.09433 14.282 3.99867 14 4H13V3C13 2.71667 12.904 2.479 12.712 2.287C12.52 2.095 12.2827 1.99933 12 2C11.7173 2.00067 11.4797 2.09667 11.287 2.288C11.0943 2.47933 10.9987 2.71667 11 3V4H10C9.71667 4 9.479 4.096 9.287 4.288C9.095 4.48 8.99933 4.71733 9 5ZM3 20C3 20.55 3.19567 21.0207 3.587 21.412C3.97833 21.8033 4.44933 21.9993 5 22H19C19.55 22 20.0207 21.804 20.412 21.412C20.8033 21.02 20.9993 20.5493 21 20V14H3V20ZM3 12H21V6C21 5.45 20.804 4.979 20.412 4.587C20.02 4.195 19.5493 3.99933 19 4H17.9C17.6333 4 17.4123 4.1 17.237 4.3C17.0617 4.5 16.9827 4.73333 17 5C17 6.38333 16.5167 7.56233 15.55 8.537C14.5833 9.51167 13.4 9.99933 12 10C10.6 10.0007 9.41667 9.513 8.45 8.537C7.48333 7.561 7 6.382 7 5C7 4.73333 6.91667 4.5 6.75 4.3C6.58333 4.1 6.36667 4 6.1 4H5C4.45 4 3.979 4.19567 3.587 4.587C3.195 4.97833 2.99933 5.44933 3 6V12Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/row-add-after.svg
	var row_add_after_default = "data:image/svg+xml,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M9 19C9 18.7167 9.096 18.4793 9.288 18.288C9.48 18.0967 9.71733 18.0007 10 18H11V17C11 16.7167 11.096 16.4793 11.288 16.288C11.48 16.0967 11.7173 16.0007 12 16C12.2827 15.9993 12.52 16.0953 12.712 16.288C12.904 16.4807 13 16.718 13 17V18H14C14.2833 18 14.5207 18.096 14.712 18.288C14.9033 18.48 14.9993 18.7173 15 19C15.0007 19.2827 14.9047 19.5203 14.712 19.713C14.5193 19.9057 14.282 20.0013 14 20H13V21C13 21.2833 12.904 21.521 12.712 21.713C12.52 21.905 12.2827 22.0007 12 22C11.7173 21.9993 11.4797 21.9033 11.287 21.712C11.0943 21.5207 10.9987 21.2833 11 21V20H10C9.71667 20 9.479 19.904 9.287 19.712C9.095 19.52 8.99933 19.2827 9 19ZM3 4C3 3.45 3.19567 2.97933 3.587 2.588C3.97833 2.19667 4.44933 2.00067 5 2H19C19.55 2 20.0207 2.196 20.412 2.588C20.8033 2.98 20.9993 3.45067 21 4V10H3V4ZM3 12H21V18C21 18.55 20.804 19.021 20.412 19.413C20.02 19.805 19.5493 20.0007 19 20H17.9C17.6333 20 17.4123 19.9 17.237 19.7C17.0617 19.5 16.9827 19.2667 17 19C17 17.6167 16.5167 16.4377 15.55 15.463C14.5833 14.4883 13.4 14.0007 12 14C10.6 13.9993 9.41667 14.487 8.45 15.463C7.48333 16.439 7 17.618 7 19C7 19.2667 6.91667 19.5 6.75 19.7C6.58333 19.9 6.36667 20 6.1 20H5C4.45 20 3.979 19.8043 3.587 19.413C3.195 19.0217 2.99933 18.5507 3 18V12Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/row-delete.svg
	var row_delete_default = "data:image/svg+xml,<svg width=\"25\" height=\"22\" viewBox=\"0 0 25 22\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M1.74317 1.20828C1.74317 1.04029 1.96448 0.896535 2.40711 0.777008C2.84973 0.657481 3.38247 0.597616 4.00532 0.597412H19.8404C20.4625 0.597412 20.9948 0.657277 21.4375 0.777008C21.8801 0.896739 22.1018 1.0405 22.1025 1.20828V3.04089H1.74317V1.20828Z\" fill=\"white\"/>%0A<path d=\"M1.74317 20.7357C1.74317 20.9191 1.96448 21.076 2.40711 21.2065C2.84973 21.337 3.38247 21.4024 4.00532 21.4026H19.8404C20.4625 21.4026 20.9948 21.3372 21.4375 21.2065C21.8801 21.0758 22.1018 20.9188 22.1025 20.7357V18.7349H1.74317V20.7357Z\" fill=\"white\"/>%0A<path d=\"M16.8052 5.38813H14.35L13.6485 4.68665H10.1411L9.43958 5.38813H6.98438V6.7911H16.8052M7.68586 15.9104C7.68586 16.2825 7.83367 16.6394 8.09678 16.9025C8.35989 17.1656 8.71674 17.3134 9.08883 17.3134H14.7007C15.0728 17.3134 15.4297 17.1656 15.6928 16.9025C15.9559 16.6394 16.1037 16.2825 16.1037 15.9104V7.49259H7.68586V15.9104Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/IconButton.tsx
	const defaultButtonStyle = {
		backgroundColor: "#2D8294",
		width: 48,
		height: 48,
		borderRadius: 1,
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		cursor: "pointer",
		color: "rgba(255,255,255,0.95)",
		boxSizing: "border-box",
		padding: 0,
		"&:hover": { backgroundColor: "#256c7a" },
		"&.Mui-disabled": { opacity: .6 }
	};
	const IconButton = ({ icon, alt, onClick, title, className, style, iconSize = 24, children, selected, sx, ...rest }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_mui_material_IconButton.default, {
		onClick,
		onMouseDown: (e) => e.preventDefault(),
		className,
		"aria-label": alt,
		title: title ?? alt,
		"aria-pressed": selected,
		style,
		...rest,
		sx: [defaultButtonStyle, ...Array.isArray(sx) ? sx : [sx]],
		children: icon ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
			src: icon,
			alt: "",
			style: {
				width: iconSize,
				height: iconSize
			}
		}) : children
	});
	//#endregion
	//#region src/components/RadioGroup.tsx
	const RadioGroup = ({ options, value, onChange, className, disabled, label, ...rest }) => {
		const groupLabel = rest["aria-label"] ?? label;
		const selectedIndex = options.findIndex((o) => o.id === value);
		const tabStopIndex = selectedIndex >= 0 ? selectedIndex : 0;
		const moveFocus = (from, delta, container) => {
			if (options.length === 0) return;
			const to = (from + delta + options.length) % options.length;
			onChange(options[to].id);
			(container?.querySelectorAll("[role=\"radio\"]"))?.[to]?.focus();
		};
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
			className,
			role: "radiogroup",
			"aria-label": groupLabel,
			"aria-disabled": disabled || void 0,
			style: {
				position: "relative",
				display: "flex",
				alignItems: "center",
				flexWrap: "wrap",
				columnGap: 0,
				rowGap: 10
			},
			children: options.map((opt, idx) => {
				const selected = value === opt.id;
				const isLast = idx === options.length - 1;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.default.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
					icon: opt.icon,
					alt: opt.label || opt.id,
					title: opt.label || opt.id,
					onClick: () => onChange(opt.id),
					selected,
					disabled,
					role: "radio",
					"aria-checked": selected,
					"aria-pressed": void 0,
					tabIndex: idx === tabStopIndex ? 0 : -1,
					onKeyDown: (e) => {
						if (disabled) return;
						const container = e.currentTarget.parentElement?.closest("[role=\"radiogroup\"]");
						if (e.key === "ArrowRight" || e.key === "ArrowDown") {
							e.preventDefault();
							moveFocus(idx, 1, container);
						} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
							e.preventDefault();
							moveFocus(idx, -1, container);
						}
					},
					style: { border: selected ? "3px solid rgba(255,255,255,0.95)" : "3px solid transparent" },
					children: !opt.icon && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							whiteSpace: "pre-wrap",
							textAlign: "center",
							lineHeight: 1.1,
							padding: 6,
							...opt.labelStyle || {}
						},
						children: opt.label
					})
				}), !isLast && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					style: {
						width: 12,
						height: 2,
						background: "rgba(255,255,255,0.35)",
						display: "inline-block",
						alignSelf: "center",
						pointerEvents: "none"
					}
				})] }, opt.id);
			})
		});
	};
	//#endregion
	//#region src/components/RowSection.tsx
	const RowSection = ({ table, currentCell, onInsertAbove, onInsertBelow, onDelete, disabled }) => {
		const api = useTableApi();
		useClearPulseOnUnmount(table);
		const resolveRowIndex = () => {
			const activeAttr = table?.getAttribute("data-ui-active-row-index");
			const active = activeAttr ? parseInt(activeAttr, 10) : NaN;
			return Number.isFinite(active) ? active : api.getRowIndex(currentCell);
		};
		let selectedSize = "hug";
		let fixedLabel = "mm";
		try {
			if (table && currentCell) {
				const rowIndex = resolveRowIndex();
				const raw = new api.BloomTable(table).getRowHeight(rowIndex) || "hug";
				const h = typeof raw === "string" ? raw.trim() : raw;
				if (h === "hug") selectedSize = "hug";
				else if (h === "fill") selectedSize = "grow";
				else if (/(px|mm)$/i.test(h)) {
					selectedSize = "fixed";
					const mmMatch = h.match(/^(\d+(?:\.\d+)?)mm$/i);
					fixedLabel = mmMatch ? `${mmMatch[1]}\nmm` : h;
				}
			}
		} catch {}
		const sizeOptions = [
			{
				id: "grow",
				icon: row_grow_default,
				label: "Grow"
			},
			{
				id: "hug",
				icon: row_hug_default,
				label: "Hug"
			},
			{
				id: "fixed",
				label: fixedLabel,
				labelStyle: { fontSize: 12 }
			}
		];
		const onChangeSize = (id) => {
			if (!table || !currentCell) return;
			const rowIndex = resolveRowIndex();
			const controller = new api.BloomTable(table);
			if (id === "grow") controller.setRowHeight(rowIndex, "fill");
			else if (id === "hug") controller.setRowHeight(rowIndex, "hug");
			else if (id === "fixed") {
				const current = (controller.getRowHeight(rowIndex) || "").trim();
				const next = current && /(px|mm)$/i.test(current) ? current : "10mm";
				controller.setRowHeight(rowIndex, next);
			}
		};
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
			label: "Row",
			onMouseEnter: () => pulseRow(table, currentCell),
			onMouseLeave: () => clearPulse(table),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: subTitleStyle,
					children: "Add / Remove"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "px-4 pb-1 flex items-center justify-between gap-3",
					onMouseDown: (e) => e.preventDefault(),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
							icon: row_add_before_default,
							alt: "Insert Row Above",
							onClick: onInsertAbove,
							disabled
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
							icon: row_add_after_default,
							alt: "Insert Row Below",
							onClick: onInsertBelow,
							disabled
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
						icon: row_delete_default,
						alt: "Delete Row",
						onClick: onDelete,
						disabled
					})]
				}),
				" ",
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: subTitleStyle,
					children: "Size"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RadioGroup, {
					className: "px-4",
					label: "Row size",
					disabled,
					options: sizeOptions,
					value: selectedSize,
					onChange: onChangeSize
				})
			]
		});
	};
	//#endregion
	//#region src/components/icons/column-add-before.svg
	var column_add_before_default = "data:image/svg+xml,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M5 15C5.28333 15 5.52067 14.904 5.712 14.712C5.90333 14.52 5.99933 14.2827 6 14V13H7C7.28333 13 7.52067 12.904 7.712 12.712C7.90333 12.52 7.99933 12.2827 8 12C8.00067 11.7173 7.90467 11.48 7.712 11.288C7.51933 11.096 7.282 11 7 11H6V10C6 9.71667 5.904 9.47933 5.712 9.288C5.52 9.09667 5.28267 9.00067 5 9C4.71733 8.99933 4.47967 9.09533 4.287 9.288C4.09433 9.48067 3.99867 9.718 4 10V11H3C2.71667 11 2.479 11.096 2.287 11.288C2.095 11.48 1.99933 11.7173 2 12C2.00067 12.2827 2.09667 12.5203 2.288 12.713C2.47933 12.9057 2.71667 13.0013 3 13H4V14C4 14.2833 4.096 14.521 4.288 14.713C4.48 14.905 4.71733 15.0007 5 15ZM20 21C20.55 21 21.0207 20.8043 21.412 20.413C21.8033 20.0217 21.9993 19.5507 22 19V5C22 4.45 21.804 3.97933 21.412 3.588C21.02 3.19667 20.5493 3.00067 20 3H14V21H20ZM12 21V3H6C5.45 3 4.979 3.196 4.587 3.588C4.195 3.98 3.99933 4.45067 4 5V6.1C4 6.36667 4.1 6.58767 4.3 6.763C4.5 6.93833 4.73333 7.01733 5 7C6.38333 7 7.56233 7.48333 8.537 8.45C9.51167 9.41667 9.99933 10.6 10 12C10.0007 13.4 9.513 14.5833 8.537 15.55C7.561 16.5167 6.382 17 5 17C4.73333 17 4.5 17.0833 4.3 17.25C4.1 17.4167 4 17.6333 4 17.9V19C4 19.55 4.19567 20.021 4.587 20.413C4.97833 20.805 5.44933 21.0007 6 21H12Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/icons/column-add-after.svg
	var column_add_after_default = "data:image/svg+xml,<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">%0A<path d=\"M19 15C18.7167 15 18.4793 14.904 18.288 14.712C18.0967 14.52 18.0007 14.2827 18 14V13H17C16.7167 13 16.4793 12.904 16.288 12.712C16.0967 12.52 16.0007 12.2827 16 12C15.9993 11.7173 16.0953 11.48 16.288 11.288C16.4807 11.096 16.718 11 17 11H18V10C18 9.71667 18.096 9.47933 18.288 9.288C18.48 9.09667 18.7173 9.00067 19 9C19.2827 8.99933 19.5203 9.09533 19.713 9.288C19.9057 9.48067 20.0013 9.718 20 10V11H21C21.2833 11 21.521 11.096 21.713 11.288C21.905 11.48 22.0007 11.7173 22 12C21.9993 12.2827 21.9033 12.5203 21.712 12.713C21.5207 12.9057 21.2833 13.0013 21 13H20V14C20 14.2833 19.904 14.521 19.712 14.713C19.52 14.905 19.2827 15.0007 19 15ZM4 21C3.45 21 2.97933 20.8043 2.588 20.413C2.19667 20.0217 2.00067 19.5507 2 19V5C2 4.45 2.196 3.97933 2.588 3.588C2.98 3.19667 3.45067 3.00067 4 3H10V21H4ZM12 21V3H18C18.55 3 19.021 3.196 19.413 3.588C19.805 3.98 20.0007 4.45067 20 5V6.1C20 6.36667 19.9 6.58767 19.7 6.763C19.5 6.93833 19.2667 7.01733 19 7C17.6167 7 16.4377 7.48333 15.463 8.45C14.4883 9.41667 14.0007 10.6 14 12C13.9993 13.4 14.487 14.5833 15.463 15.55C16.439 16.5167 17.618 17 19 17C19.2667 17 19.5 17.0833 19.7 17.25C19.9 17.4167 20 17.6333 20 17.9V19C20 19.55 19.8043 20.021 19.413 20.413C19.0217 20.805 18.5507 21.0007 18 21H12Z\" fill=\"white\"/>%0A</svg>%0A";
	//#endregion
	//#region src/components/ColumnSection.tsx
	const ColumnSection = ({ table, currentCell, onInsertLeft, onInsertRight, onDelete, disabled }) => {
		const api = useTableApi();
		useClearPulseOnUnmount(table);
		let selectedSize = "hug";
		let fixedLabel = "mm";
		try {
			if (table && currentCell) {
				const { column: columnIndex } = api.getRowAndColumn(table, currentCell);
				const raw = new api.BloomTable(table).getColumnWidth(columnIndex) || "hug";
				const w = typeof raw === "string" ? raw.trim() : raw;
				if (w === "hug") selectedSize = "hug";
				else if (w === "fill") selectedSize = "grow";
				else if (/(px|mm)$/i.test(w)) {
					selectedSize = "fixed";
					const mmMatch = w.match(/^(\d+(?:\.\d+)?)mm$/i);
					fixedLabel = mmMatch ? `${mmMatch[1]}\nmm` : w;
				}
			}
		} catch {}
		const sizeOptions = [
			{
				id: "grow",
				icon: column_grow_default,
				label: "Grow"
			},
			{
				id: "hug",
				icon: column_hug_default,
				label: "Hug"
			},
			{
				id: "fixed",
				label: fixedLabel,
				labelStyle: { fontSize: 12 }
			}
		];
		const onChangeSize = (id) => {
			if (!table || !currentCell) return;
			const { column: columnIndex } = api.getRowAndColumn(table, currentCell);
			const controller = new api.BloomTable(table);
			if (id === "grow") controller.setColumnWidth(columnIndex, "fill");
			else if (id === "hug") controller.setColumnWidth(columnIndex, "hug");
			else if (id === "fixed") {
				const current = (controller.getColumnWidth(columnIndex) || "").trim();
				const next = current && /(px|mm)$/i.test(current) ? current : "10mm";
				controller.setColumnWidth(columnIndex, next);
			}
		};
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
			label: "Column",
			onMouseEnter: () => pulseColumn(table, currentCell),
			onMouseLeave: () => clearPulse(table),
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: subTitleStyle,
					children: "Add / Remove"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "px-4 pb-1 flex items-center justify-between gap-3",
					onMouseDown: (e) => e.preventDefault(),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
							icon: column_add_before_default,
							alt: "Insert Column Left",
							onClick: onInsertLeft,
							disabled
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
							icon: column_add_after_default,
							alt: "Insert Column Right",
							onClick: onInsertRight,
							disabled
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
						icon: column_delete_default,
						alt: "Delete Column",
						onClick: onDelete,
						disabled
					})]
				}),
				" ",
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: subTitleStyle,
					children: "Size"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RadioGroup, {
					className: "px-4",
					label: "Column size",
					disabled,
					options: sizeOptions,
					value: selectedSize,
					onChange: onChangeSize
				})
			]
		});
	};
	//#endregion
	//#region src/components/cellPadding.ts
	const firstPx = (s) => {
		const n = parseFloat((s ?? "").trim());
		return isNaN(n) ? 0 : n;
	};
	/**
	* The number the Padding slider should show for a cell.
	*
	* `explicit` is the cell's data-pad override, which is absent on a fresh cell.
	* The cell is still padded in that case — the stylesheet's --cell-padding
	* (8px 10px) applies — so reporting 0 made the first nudge *shrink* the padding
	* while the UI suggested it was growing. Fall back to what the cell actually
	* renders with.
	*/
	function paddingSliderValue(cell, explicit) {
		if (explicit) return firstPx(explicit);
		const win = cell.ownerDocument?.defaultView;
		if (!win) return 0;
		return firstPx(win.getComputedStyle(cell).paddingTop);
	}
	//#endregion
	//#region src/components/CellSection.tsx
	const menuItemStyle = "flex items-center gap-2 px-4 py-1 cursor-pointer w-full text-left";
	const buildBorderMapFromCell = (api, c) => {
		const table = c.closest(".bloom-table");
		if (table) api.ensureEdgesArrays(table);
		return api.getCellPerimeterValueMap(c);
	};
	const applyBorderMapToCell = (api, c, map, color) => {
		const table = c.closest(".bloom-table");
		if (!table) return;
		const cs = getComputedStyle(table);
		const outerColor = (color ?? representativeBorderColorHex(c) ?? cs.color ?? "#000").trim();
		const toUI = (w, s) => ({
			weight: w,
			style: s,
			color: outerColor
		});
		api.applyCellPerimeter(table, c, {
			top: toUI(map.top.weight, map.top.style),
			right: toUI(map.right.weight, map.right.style),
			bottom: toUI(map.bottom.weight, map.bottom.style),
			left: toUI(map.left.weight, map.left.style)
		});
		api.render(table);
	};
	const CellSection = ({ currentCell, onSetContentType, onExtend, onContract, disabled }) => {
		const api = useTableApi();
		const ColorPicker = useColorPicker();
		const currentType = currentCell ? api.getCurrentContentTypeId(currentCell) : void 0;
		const [, bumpRenderCount] = react.default.useState(0);
		const align = currentCell && api.getCellAlign(currentCell) || "center";
		const fillHover = {
			onMouseEnter: () => pulseCell(currentCell),
			onMouseLeave: () => clearPulse(currentCell)
		};
		const borderHover = {
			onMouseEnter: () => pulseCellBorders(currentCell),
			onMouseLeave: () => clearPulse(currentCell)
		};
		useClearPulseOnUnmount(currentCell);
		const borderValueMap = currentCell ? buildBorderMapFromCell(api, currentCell) : void 0;
		const span = (() => {
			const table = currentCell?.closest(".bloom-table");
			if (!currentCell || !table) return {
				x: 1,
				y: 1
			};
			try {
				const s = new api.BloomTable(table).getSpan(currentCell);
				return {
					x: Math.max(1, s.x || 1),
					y: Math.max(1, s.y || 1)
				};
			} catch {
				return {
					x: 1,
					y: 1
				};
			}
		})();
		const canSplit = span.x > 1 || span.y > 1;
		const canMerge = (() => {
			const table = currentCell?.closest(".bloom-table");
			if (!currentCell || !table) return false;
			try {
				const { column } = api.getRowAndColumn(table, currentCell);
				return column + span.x < getColumnWidths(table).length;
			} catch {
				return false;
			}
		})();
		return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Section, {
			label: "Cell",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: menuItemStyle,
					style: {
						cursor: "default",
						display: "block"
					},
					...fillHover,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "text-sm opacity-80 mb-2",
						children: "Content Type"
					}), currentCell && currentType && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RadioGroup, {
						className: "ml-2",
						label: "Content type",
						disabled,
						value: currentType,
						onChange: (id) => onSetContentType(id),
						options: api.contentTypeOptions().map((o) => ({
							id: o.id,
							label: o.englishName,
							icon: o.icon
						}))
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: menuItemStyle,
					style: {
						cursor: "default",
						display: "block"
					},
					...borderHover,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "text-sm opacity-80 mb-2",
							children: "Borders"
						}),
						currentCell && borderValueMap && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BorderControl, {
							identity: elementKey(currentCell),
							valueMap: borderValueMap,
							showInner: false,
							onChange: (next) => applyBorderMapToCell(api, currentCell, next)
						}),
						currentCell && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "mt-2",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "text-sm opacity-80 mb-2",
								children: "Border color"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								onMouseEnter: () => clearPulse(currentCell),
								onMouseLeave: () => pulseCellBorders(currentCell),
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColorPicker, {
									label: "Cell border color",
									value: representativeBorderColorHex(currentCell),
									onChange: (color) => {
										if (!color) return;
										applyBorderMapToCell(api, currentCell, buildBorderMapFromCell(api, currentCell), color);
									}
								})
							})]
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: menuItemStyle,
					style: {
						cursor: "default",
						display: "block"
					},
					...fillHover,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "text-sm opacity-80 mb-2",
						children: "Text alignment"
					}), currentCell && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RadioGroup, {
						className: "ml-2",
						label: "Text alignment",
						disabled,
						value: align,
						onChange: (id) => {
							api.setCellAlign(currentCell, id);
							const table = currentCell.closest(".bloom-table");
							if (table) api.render(table);
							bumpRenderCount((n) => n + 1);
						},
						options: [
							{
								id: "start",
								label: "Left",
								icon: align_left_default
							},
							{
								id: "center",
								label: "Center",
								icon: align_center_default
							},
							{
								id: "end",
								label: "Right",
								icon: align_right_default
							}
						]
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: menuItemStyle,
					style: {
						cursor: "default",
						display: "block"
					},
					...borderHover,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "text-sm opacity-80 mb-2",
						children: "Corners"
					}), currentCell && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CornerMenu, {
						disabled,
						value: api.getCellCorners(currentCell)?.radius ?? 0,
						onChange: (v) => {
							if (!currentCell) return;
							api.setCellCorners(currentCell, v ? { radius: v } : null);
							const table = currentCell.closest(".bloom-table");
							if (table) api.render(table);
						}
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: menuItemStyle,
					style: {
						cursor: "default",
						display: "block"
					},
					...fillHover,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "text-sm opacity-80 mb-2",
						children: "Padding"
					}), currentCell && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Slider, {
						className: "ml-2",
						"aria-label": "Cell padding",
						identity: elementKey(currentCell),
						disabled,
						min: 0,
						max: 40,
						unit: "px",
						value: paddingSliderValue(currentCell, api.getCellPadding(currentCell)),
						onChange: (v) => {
							api.setCellPadding(currentCell, `${v}px`);
							const table = currentCell.closest(".bloom-table");
							if (table) api.render(table);
						}
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: menuItemStyle,
					style: {
						cursor: "default",
						display: "block"
					},
					...fillHover,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "text-sm opacity-80 mb-2",
						children: "Fill"
					}), currentCell && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						onMouseEnter: () => clearPulse(currentCell),
						onMouseLeave: () => pulseCell(currentCell),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColorPicker, {
							label: "Cell fill",
							value: api.getCellBackground(currentCell) ?? "",
							onChange: (color) => {
								api.setCellBackground(currentCell, color || null);
								const table = currentCell.closest(".bloom-table");
								if (table) api.render(table);
							}
						})
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: menuItemStyle,
					style: {
						cursor: "default",
						display: "block"
					},
					...fillHover,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "text-sm opacity-80 mb-2",
						children: "Merge / Split"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-3 ml-2",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
							alt: "Merge",
							title: "Merge",
							icon: cell_merge_default,
							onClick: onExtend,
							disabled: disabled || !canMerge
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconButton, {
							alt: "Split",
							title: "Split",
							icon: cell_split_default,
							onClick: onContract,
							disabled: disabled || !canSplit
						})]
					})]
				})
			]
		});
	};
	//#endregion
	//#region src/components/spanCommands.ts
	/**
	* The span a cell should get when the Split button is pressed.
	*
	* Split undoes a merge in whichever direction the cell is actually merged.
	* Reducing x only left the button a silent no-op on a cell merged vertically
	* (x already 1, y > 1) — a state the model, the renderer, and the public
	* setSpan API all support even though the Merge button only ever grows x.
	* Returns null when there is nothing to split (a 1x1 cell).
	*/
	function nextSplitSpan(x, y) {
		const sx = Math.max(1, x || 1);
		const sy = Math.max(1, y || 1);
		if (sx > 1) return {
			x: sx - 1,
			y: sy
		};
		if (sy > 1) return {
			x: sx,
			y: sy - 1
		};
		return null;
	}
	//#endregion
	//#region src/components/TableMenu.tsx
	const kPanelViewportGap = 8;
	const kPanelMinHeight = 120;
	const TableMenu = (props) => {
		const api = props.tableApi ?? defaultTableApi;
		const [, forceUpdate] = (0, react.useState)(0);
		const currentCell = props.currentCell?.closest(".bloom-cell") ?? null;
		const lastCellLocation = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			if (!currentCell || !currentCell.isConnected) return;
			const t = currentCell.closest(".bloom-table");
			if (!t) return;
			try {
				const { row, column } = api.getRowAndColumn(t, currentCell);
				lastCellLocation.current = {
					table: t,
					row,
					column
				};
			} catch {}
		});
		const findCellAt = (table, row, column) => {
			const cells = Array.from(table.children).filter((c) => c instanceof HTMLElement && c.classList.contains("bloom-cell") && !c.classList.contains("bloom-skip"));
			for (const c of cells) try {
				const pos = api.getRowAndColumn(table, c);
				if (pos.row === row && pos.column === column) return c;
			} catch {}
			return cells[0] ?? null;
		};
		(0, react.useEffect)(() => {
			const handler = () => {
				if (currentCell && !currentCell.isConnected) {
					const loc = lastCellLocation.current;
					const replacement = loc && loc.table.isConnected ? findCellAt(loc.table, loc.row, loc.column) : null;
					if (replacement) replacement.focus();
				}
				forceUpdate((x) => x + 1);
			};
			const doc = currentCell?.ownerDocument ?? document;
			doc.addEventListener("tableHistoryUpdated", handler);
			return () => doc.removeEventListener("tableHistoryUpdated", handler);
		}, [currentCell]);
		(0, react.useEffect)(() => {
			if (!currentCell) return;
			const table = currentCell.closest(".bloom-table");
			if (!table) return;
			const observer = new MutationObserver(() => {
				forceUpdate((x) => x + 1);
			});
			observer.observe(table, {
				attributes: true,
				attributeFilter: [
					"data-column-widths",
					"data-row-heights",
					"data-ui-active-row-index",
					"style"
				]
			});
			return () => {
				observer.disconnect();
			};
		}, [currentCell]);
		const getTargetTableFromSelection = () => {
			return currentCell?.closest(".bloom-table") ?? null;
		};
		const getTargetTableFromCell = (cell) => {
			return cell.closest(".bloom-table") ?? null;
		};
		const handleSetCellContentType = (contentTypeId) => {
			if (!currentCell) return;
			api.setupContentsOfCell(currentCell, contentTypeId, true);
		};
		const handleExtendCell = () => {
			const table = currentCell ? getTargetTableFromCell(currentCell) : null;
			if (!currentCell || !table) return;
			const controller = new api.BloomTable(table);
			const current = controller.getSpan(currentCell);
			controller.setSpan(currentCell, (current.x || 1) + 1, current.y || 1);
		};
		const handleContractCell = () => {
			const table = currentCell ? getTargetTableFromCell(currentCell) : null;
			if (!currentCell || !table) return;
			const controller = new api.BloomTable(table);
			const current = controller.getSpan(currentCell);
			const next = nextSplitSpan(current.x, current.y);
			if (!next) return;
			controller.setSpan(currentCell, next.x, next.y);
		};
		const handleInsertRowAbove = () => {
			const table = getTargetTableFromSelection();
			if (!table || !currentCell) return;
			const rowIndex = api.getRowIndex(currentCell);
			new api.BloomTable(table).addRowAt(rowIndex);
		};
		const handleInsertRowBelow = () => {
			const table = getTargetTableFromSelection();
			if (!table || !currentCell) return;
			const rowIndex = api.getRowIndex(currentCell);
			new api.BloomTable(table).addRowAt(rowIndex + 1);
		};
		const handleDeleteRow = () => {
			const table = getTargetTableFromSelection();
			if (!table || !currentCell) return;
			const rowIndex = api.getRowIndex(currentCell);
			new api.BloomTable(table).removeRowAt(rowIndex);
		};
		const handleInsertColumnLeft = () => {
			const table = getTargetTableFromSelection();
			if (!table || !currentCell) return;
			const columnIndex = api.getRowAndColumn(table, currentCell).column;
			new api.BloomTable(table).addColumnAt(columnIndex);
		};
		const handleInsertColumnRight = () => {
			const table = getTargetTableFromSelection();
			if (!table || !currentCell) return;
			const columnIndex = api.getRowAndColumn(table, currentCell).column;
			new api.BloomTable(table).addColumnAt(columnIndex + 1);
		};
		const handleDeleteColumn = () => {
			const table = getTargetTableFromSelection();
			if (!table || !currentCell) return;
			const columnIndex = api.getRowAndColumn(table, currentCell).column;
			new api.BloomTable(table).removeColumnAt(columnIndex);
		};
		const handleSelectParentCell = () => {
			const parent = getTargetTableFromSelection()?.parentElement?.closest(".bloom-cell");
			if (parent) parent.focus();
		};
		const handleUndo = () => {
			const table = getTargetTableFromSelection();
			if (!table) return;
			api.undoLastOperation(table);
		};
		const handleRedo = () => {
			const table = getTargetTableFromSelection();
			if (!table) return;
			new api.BloomTable(table).redo();
		};
		const table = getTargetTableFromSelection() ?? void 0;
		const parentCell = table?.parentElement?.closest(".bloom-cell");
		const undoRedoController = table ? new api.BloomTable(table) : null;
		const undoEnabled = !!undoRedoController && undoRedoController.canUndo();
		const redoEnabled = !!undoRedoController && undoRedoController.canRedo();
		const hasContext = !!currentCell && !!currentCell.closest(".bloom-table");
		const ColorPicker = props.colorPicker ?? DefaultColorPicker;
		const inertWrapRef = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			const el = inertWrapRef.current;
			if (!el) return;
			el.inert = !hasContext;
		}, [hasContext]);
		const panelRef = (0, react.useRef)(null);
		(0, react.useEffect)(() => {
			const el = panelRef.current;
			if (!el) return;
			let frame = 0;
			const apply = () => {
				frame = 0;
				const room = window.innerHeight - el.getBoundingClientRect().top - kPanelViewportGap;
				const next = `${Math.max(kPanelMinHeight, Math.round(room))}px`;
				if (el.style.maxHeight !== next) el.style.maxHeight = next;
			};
			const schedule = () => {
				if (!frame) frame = requestAnimationFrame(apply);
			};
			apply();
			window.addEventListener("resize", schedule);
			window.addEventListener("scroll", schedule, true);
			return () => {
				if (frame) cancelAnimationFrame(frame);
				window.removeEventListener("resize", schedule);
				window.removeEventListener("scroll", schedule, true);
			};
		}, []);
		return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TableApiContext.Provider, {
			value: api,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColorPickerContext.Provider, {
				value: ColorPicker,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: "table-menu border border-gray-300 rounded-md shadow-lg w-64 z-10 p-2.5",
					style: {
						backgroundColor: "#2E2E2E",
						color: "rgba(255,255,255,0.95)",
						maxHeight: "100dvh",
						overflowY: "auto",
						overflowX: "hidden"
					},
					children: [
						!hasContext && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "px-2 pb-2 text-sm",
							style: { opacity: .85 },
							children: "Click in a table cell to edit it."
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							ref: inertWrapRef,
							"aria-disabled": !hasContext,
							style: {
								opacity: hasContext ? 1 : .4,
								pointerEvents: hasContext ? "auto" : "none",
								filter: hasContext ? "none" : "grayscale(40%)"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TableSection, { table }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RowSection, {
									table,
									currentCell,
									disabled: !hasContext,
									onInsertAbove: handleInsertRowAbove,
									onInsertBelow: handleInsertRowBelow,
									onDelete: handleDeleteRow
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ColumnSection, {
									table,
									currentCell,
									disabled: !hasContext,
									onInsertLeft: handleInsertColumnLeft,
									onInsertRight: handleInsertColumnRight,
									onDelete: handleDeleteColumn
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CellSection, {
									currentCell,
									disabled: !hasContext,
									onSetContentType: handleSetCellContentType,
									onExtend: handleExtendCell,
									onContract: handleContractCell
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 px-2 pb-2 border-gray-200 mb-2",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "px-2 py-1 rounded-md text-sm",
									style: {
										backgroundColor: undoEnabled ? "#2D8294" : "#555",
										color: "rgba(255,255,255,0.95)",
										cursor: undoEnabled ? "pointer" : "not-allowed",
										opacity: undoEnabled ? 1 : .6
									},
									disabled: !undoEnabled,
									onClick: handleUndo,
									children: "Undo"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "px-2 py-1 rounded-md text-sm",
									style: {
										backgroundColor: redoEnabled ? "#2D8294" : "#555",
										color: "rgba(255,255,255,0.95)",
										cursor: redoEnabled ? "pointer" : "not-allowed",
										opacity: redoEnabled ? 1 : .6
									},
									disabled: !redoEnabled,
									onClick: handleRedo,
									children: "Redo"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "px-2 py-1 rounded-md text-sm",
									style: {
										backgroundColor: parentCell ? "#2D8294" : "#555",
										color: "rgba(255,255,255,0.95)",
										cursor: parentCell ? "pointer" : "not-allowed",
										opacity: parentCell ? 1 : .6
									},
									disabled: !parentCell,
									onClick: parentCell ? handleSelectParentCell : void 0,
									onMouseDown: (e) => e.preventDefault(),
									children: "Select Parent Cell"
								})
							]
						})
					]
				})
			})
		});
	};
	//#endregion
	exports.BloomTable = BloomTable;
	exports.CellMenuItems = CellMenuItems;
	exports.ColorPickerContext = ColorPickerContext;
	exports.DefaultColorPicker = DefaultColorPicker;
	exports.TableApiContext = TableApiContext;
	exports.TableMenu = TableMenu;
	exports.addColumn = addColumn;
	exports.addColumnAt = addColumnAt;
	exports.addRow = addRow;
	exports.addRowAt = addRowAt;
	exports.applyCellSettings = applyCellSettings;
	exports.attachTable = attachTable;
	exports.canUndo = canUndo;
	exports.cellMenuItemIds = cellMenuItemIds;
	exports.changeCellSpan = changeCellSpan;
	exports.contentTypeOptions = contentTypeOptions;
	exports.defaultCellContentsForEachType = defaultCellContentsForEachType;
	exports.defaultColumnWidth = defaultColumnWidth;
	exports.defaultRowHeight = defaultRowHeight;
	exports.defaultTableApi = defaultTableApi;
	exports.detachTable = detachTable;
	exports.dragToResize = dragToResize;
	exports.duplicateColumnAt = duplicateColumnAt;
	exports.duplicateRowAt = duplicateRowAt;
	exports.getCell = getCell;
	exports.getColumnWidth = getColumnWidth;
	exports.getCurrentContentTypeId = getCurrentContentTypeId;
	exports.getDefaultCellContentTypeId = getDefaultCellContentTypeId;
	exports.getLastOperation = getLastOperation;
	exports.getRowAndColumn = getRowAndColumn;
	exports.getRowHeight = getRowHeight;
	exports.getRowIndex = getRowIndex;
	exports.getTableCells = getTableCells;
	exports.getTableInfo = getTableInfo;
	exports.getTargetTable = getTargetTable;
	exports.kTableCellContentChangedEvent = kTableCellContentChangedEvent;
	exports.moveColumnAt = moveColumnAt;
	exports.moveRowAt = moveRowAt;
	exports.openCellMenu = openCellMenu;
	exports.registerCellContentType = registerCellContentType;
	exports.removeColumnAt = removeColumnAt;
	exports.removeLastColumn = removeLastColumn;
	exports.removeLastRow = removeLastRow;
	exports.removeRowAt = removeRowAt;
	exports.removeTableEditingArtifacts = removeTableEditingArtifacts;
	exports.setCellMenuItemFilter = setCellMenuItemFilter;
	exports.setCellMenuOpenHandler = setCellMenuOpenHandler;
	exports.setCellSpan = setCellSpan;
	exports.setColumnWidth = setColumnWidth;
	exports.setDefaultCellContentTypeId = setDefaultCellContentTypeId;
	exports.setRowHeight = setRowHeight;
	exports.setStructuralChromeGate = setStructuralChromeGate;
	exports.setupContentsOfCell = setupContentsOfCell;
	exports.snapshotCellSettings = snapshotCellSettings;
	exports.tableHistoryManager = tableHistoryManager;
	exports.undoLastOperation = undoLastOperation;
	exports.unregisterCellContentType = unregisterCellContentType;
	exports.useColorPicker = useColorPicker;
	exports.useTableApi = useTableApi;
});
