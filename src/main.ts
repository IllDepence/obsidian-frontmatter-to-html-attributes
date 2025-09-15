import { Plugin, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";

interface FrontMatterToHtmlAttributesSettings {}

const DEFAULT_SETTINGS: FrontMatterToHtmlAttributesSettings = {};

/**
 * Plugin to add YAML frontmatter key-value pairs as data-* attributes to HTML.
 *
 * Attributes are applied to leaf.view.containerEl
 * - div.workspace-leaf-content in HTML
 * - by default already has attributes like
 *     - data-type="markdown"
 *     - data-mode="reading"
 *
 * Attributes are applied as
 * - string/number/boolean: their simple string representation
 *     - "foo" -> "foo"
 *     - 27    -> "27"
 *     - true  -> "true"
 * - everything else: JSON
 *     - ["foo", "bar"] -> "[&quot;foo&quot;, &quot;bar&quot;]"
 */
export default class FrontMatterToHtmlAttributesPlugin extends Plugin {
    settings: FrontMatterToHtmlAttributesSettings;
    appliedAttributes: WeakMap<HTMLElement, string[]> = new WeakMap();

    /** attributes set by Obsidian itself; don't overwrite these  */
    readonly prohibitedAttributeNames = [
        "data-type", // file type (e.g. "markdown" or "image")
        "data-mode", // view mode ("preview" = reading, "source" = editing)
    ];

    async onload() {
        await this.loadSettings();

        // Handle opening new files and switching to already open files
        this.registerEvent(
            this.app.workspace.on("file-open", this.handleFileOpen.bind(this))
        );

        // Handle changes to the frontmatter of an already open file
        this.registerEvent(
            this.app.metadataCache.on(
                "changed",
                this.handleMetadataChange.bind(this)
            )
        );

        // On initial load, process all currently open markdown files
        this.app.workspace.onLayoutReady(() => {
            this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
                if (!(leaf.view instanceof MarkdownView)) return;
                if (leaf.view.file) {
                    this.applyAttributes(leaf.view.file, leaf);
                }
            });
        });
    }

    onunload() {
        // Clean up any attributes added to all open leaves
        this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
            const leafContentEl = leaf.view.containerEl;
            if (leafContentEl) {
                this.clearAttributes(leafContentEl);
            }
        });
    }

    /**
     * Event handler for when a file is opened.
     * @param {TFile} file The file that was opened.
     */
    handleFileOpen(file: TFile) {
        // When a file is opened, it becomes the active leaf's file.
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (file && activeView?.leaf) {
            this.applyAttributes(file, activeView.leaf);
        }
    }

    /**
     * Event handler for when a file's metadata (including frontmatter) changes.
     * @param {TFile} file The file whose metadata changed.
     */
    handleMetadataChange(file: TFile) {
        // Find all open leaves with this file and add data attributes
        this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
            if (!(leaf.view instanceof MarkdownView)) return;
            if (leaf.view.file && leaf.view.file.path === file.path) {
                this.applyAttributes(file, leaf);
            }
        });
    }

    /**
     * Clears previously added data attributes from a specific HTML element.
     * @param {HTMLElement} element The element to clear attributes from.
     */
    clearAttributes(element: HTMLElement) {
        const addedKeys = this.appliedAttributes.get(element);
        if (addedKeys) {
            for (const key of addedKeys) {
                const htmlAtrrib = `data-${key}`;
                if (this.prohibitedAttributeNames.contains(htmlAtrrib)) {
                    continue;
                }
                element.removeAttribute(htmlAtrrib);
            }
            this.appliedAttributes.delete(element);
        }
    }

    /**
     * Applies frontmatter as data attributes to a leaf's container element.
     * @param {TFile} file The file to get frontmatter from.
     * @param {WorkspaceLeaf} leaf The leaf whose container element to modify.
     */
    applyAttributes(file: TFile, leaf: WorkspaceLeaf) {
        if (!file || !leaf) return;

        // The target element for new attributes
        const leafContentEl = leaf.view.containerEl;
        if (!leafContentEl) return;

        // Clear attributes added previously
        this.clearAttributes(leafContentEl);

        const frontmatter =
            this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!frontmatter) return;

        const newKeys = [];
        for (const key in frontmatter) {
            if (!Object.prototype.hasOwnProperty.call(frontmatter, key)) {
                continue; // Skip inherited object properties
            }
            const value = frontmatter[key];
            let processedValue;

            // Process values based on type
            if (typeof value === "object") {
                // Arrays and objects
                processedValue = JSON.stringify(value);
            } else {
                // Everything else (strings, numbers, booleans, etc.)
                processedValue = String(value);
            }

            // Sanitize key to be a valid data-attribute name
            const attributeKey = key
                .replace(/[^a-zA-Z0-9\-]/g, "-")
                .toLowerCase();
            const htmlAtrrib = `data-${attributeKey}`;
            if (this.prohibitedAttributeNames.contains(htmlAtrrib)) {
                continue;
            }
            leafContentEl.setAttribute(htmlAtrrib, processedValue);
            newKeys.push(attributeKey);
        }

        // Remember keys added
        if (newKeys.length > 0) {
            this.appliedAttributes.set(leafContentEl, newKeys);
        }
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
