import Mermaid from 'mermaid';
import { getInjectConfig } from './util.ts';

// TODO: replace skypack cdn mermaid with type from original source
declare const mermaid: typeof Mermaid;

function init() {
  const peek = getInjectConfig();

  mermaid.initialize({
    startOnLoad: false,
    theme: peek?.theme === 'light' ? 'neutral' : 'dark',
    flowchart: {
      htmlLabels: false,
    },
  });
}

async function render(id: string, definition: string, container: Element) {
  try {
    return (await mermaid.render(id, definition, container)).svg;
  } catch { /**/ }
}

export default { init, render };
