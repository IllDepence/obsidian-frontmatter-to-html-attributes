import { Plugin, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";

interface FrontMatterToHtmlAttributesSettings {}

const DEFAULT_SETTINGS: FrontMatterToHtmlAttributesSettings = {};

export default class FrontMatterToHtmlAttributesPlugin extends Plugin {
    settings: FrontMatterToHtmlAttributesSettings;
    appliedAttributes: WeakMap<HTMLElement, string[]> = new WeakMap();

    async onload() {
        await this.loadSettings();
        // This event handles both opening a new file and switching to an already open file.
        this.registerEvent(
            this.app.workspace.on("file-open", this.handleFileOpen.bind(this))
        );

        // This event handles changes to the frontmatter of an already open file.
        this.registerEvent(
            this.app.metadataCache.on(
                "changed",
                this.handleMetadataChange.bind(this)
            )
        );

        // On initial load, process all currently open markdown files.
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
        console.log("Unloading Frontmatter to Attributes plugin");
        // Clean up any attributes we've set in all open leaves.
        this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
            const leafContentEl = leaf.view.containerEl.querySelector(
                ".workspace-leaf-content"
            );
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
        const activeLeaf = this.app.workspace.activeLeaf;
        if (file && activeLeaf) {
            this.applyAttributes(file, activeLeaf);
        }
    }

    /**
     * Event handler for when a file's metadata (including frontmatter) changes.
     * @param {TFile} file The file whose metadata changed.
     */
    handleMetadataChange(file: TFile) {
        // Find all open leaves with this file and update their attributes.
        this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
            if (!(leaf.view instanceof MarkdownView)) return;
            if (leaf.view.file && leaf.view.file.path === file.path) {
                this.applyAttributes(file, leaf);
            }
        });
    }

    /**
     * Clears previously set data attributes from a specific HTML element.
     * @param {HTMLElement} element The element to clear attributes from.
     */
    clearAttributes(element: HTMLElement) {
        const oldKeys = this.appliedAttributes.get(element);
        if (oldKeys) {
            oldKeys.forEach((key) => {
                element.removeAttribute(`data-${key}`);
            });
            this.appliedAttributes.delete(element);
        }
    }

    /**
     * Applies frontmatter as data attributes to a given leaf's content element.
     * @param {TFile} file The file to get frontmatter from.
     * @param {WorkspaceLeaf} leaf The leaf whose DOM element we're modifying.
     */
    applyAttributes(file: TFile, leaf: WorkspaceLeaf) {
        if (!file || !leaf) return;

        // The target element for our attributes.
        const leafContentEl = leaf.view.containerEl.querySelector(
            ".workspace-leaf-content"
        );
        if (!leafContentEl) return;

        // Always clear any attributes we set previously on this specific element.
        this.clearAttributes(leafContentEl);

        const frontmatter =
            this.app.metadataCache.getFileCache(file)?.frontmatter;

        if (!frontmatter) {
            return; // Nothing to do if there's no frontmatter.
        }

        // The 'position' key is often added by Obsidian internally and isn't useful
        // for styling, so we exclude it.
        const { position, ...restFrontmatter } = frontmatter;
        const newKeys = [];

        for (const key in restFrontmatter) {
            if (Object.prototype.hasOwnProperty.call(restFrontmatter, key)) {
                const value = restFrontmatter[key];
                let processedValue;

                // Process the value based on its type as per the request.
                if (
                    typeof value === "string" ||
                    typeof value === "number" ||
                    typeof value === "boolean"
                ) {
                    processedValue = value.toString();
                } else if (value !== null && typeof value === "object") {
                    // This handles both arrays and complex objects.
                    processedValue = JSON.stringify(value);
                } else {
                    // For null, undefined, etc., convert to a simple string.
                    processedValue = String(value);
                }

                // Sanitize the key to be a valid data-attribute name.
                const attributeKey = key
                    .replace(/[^a-zA-Z0-9\-]/g, "-")
                    .toLowerCase();
                leafContentEl.setAttribute(
                    `data-${attributeKey}`,
                    processedValue
                );
                newKeys.push(attributeKey);
            }
        }

        // Store the keys we just set so we can clean them up efficiently later.
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
