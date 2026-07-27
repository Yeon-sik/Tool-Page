# Vendored browser libraries

Tool Page keeps its runtime conversion libraries in this directory so file-processing pages do not depend on third-party CDN availability or execute mutable third-party responses at runtime.

| File | Version | Upstream distribution | SHA-256 |
| --- | --- | --- | --- |
| `gif-0.2.0.js` | gif.js 0.2.0 | `https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js` | `a8b111071bb3b123c302e6182c01d6b3550f93a4b627398b07c46875d84090bb` |
| `gif-0.2.0.worker.js` | gif.js 0.2.0 | `https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js` | `ca9e3048557ec05d619e18b83403cd3669c88939e5fa2d6034ce7625d445970d` |
| `jspdf-2.5.1.umd.min.js` | jsPDF 2.5.1 | `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` |
| `jszip-3.10.1.min.js` | JSZip 3.10.1 | `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js` | `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` |
| `lamejs-1.2.1.min.js` | lamejs 1.2.1 | `https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js` | `15d285e2587b3bdbfd18a68de6ce07cc074f7480a82c3815da2dc1c348ec6df4` |
| `pdf-3.11.174.min.js` | PDF.js 3.11.174 | `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js` | `5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946` |
| `pdf-3.11.174.worker.min.js` | PDF.js 3.11.174 | `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js` | `feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b` |
| `pptxgenjs-3.12.0.bundle.js` | PptxGenJS 3.12.0 | `https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js` | `cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff` |
| `utif-3.1.0.min.js` | UTIF.js 3.1.0 | `https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.min.js` | `e6a308793c390e685f227db29a795eced984fc5cf048e1510f878955d12709c2` |

Each library remains subject to its upstream license. Check the corresponding upstream project and release before replacing a file, then update both the versioned filename and checksum in this manifest.
