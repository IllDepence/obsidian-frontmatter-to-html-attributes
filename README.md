# Frontmatter to HTML Attributes

An Obsidian plugin that makes a note’s YAML frontmatter available in HTML as data-* attributes for CSS styling.

![](docs/demo.gif)

## Examples

With the plugin installed, you can use CSS snippets like below

1. Display an island icon with the title of every note tagged "travel".
    ```css
    div.workspace-leaf-content[data-tags*="travel"] div.inline-title:after {
      content: " \1F3DD\FE0F"; /** 🏝️ */
    }
    ```
2. Underline headings notes with the "sections" attribute attribute checked.
    ```css
    div.workspace-leaf-content[data-sections="true"] .HyperMD-header-1, /** editing mode */
    div.workspace-leaf-content[data-sections="true"] h1 { /** reading mode */
      border-bottom: dashed 2px var(--interactive-accent); 
    }
    ```

## Usage

[attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors)

```markdown
---
tags:
  - travel
  - asia
sections: true
---
```


