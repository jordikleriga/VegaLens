# Kibana Quirks & Troubleshooting

This guide covers known quirks and behaviors when using Vega specs in Kibana.

## "Leave site?" Popup on Complex Visualizations

### Problem

When loading certain Vega visualizations in Kibana (primarily Sankey diagrams), you may see a browser popup asking:

> **Leave site?**
> Changes you made may not be saved.

This can make it appear that the visualization has errored out.

### Solution

1. **Click "Cancel"** on the popup (not "Leave")
2. Wait for the visualization to fully render
3. Once rendered, you can save the visualization normally

### Why This Happens

Some complex Vega visualizations (like multi-stage Sankey diagrams) require more processing time to render. The browser may trigger an "unload" warning during this process, but the visualization will complete successfully if you cancel the popup.

### Affected Chart Types

- **Sankey** - Most common, especially with 3-4 stages
- Complex flow diagrams with many data points

### Tips

- Be patient when loading complex visualizations
- If the chart doesn't render after canceling, try refreshing the page
- Consider reducing the data size if the popup appears frequently
