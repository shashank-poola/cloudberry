# Cloudberry docs

The MDX files and `docs.json` remain ready for Mintlify hosting. The root
`index.html` is a small dependency-free docs frontend for the reference layout:

- 360px dark sidebar with Cloudberry branding and search;
- compact grouped navigation with active purple state;
- article content loaded from the same MDX files;
- right-side “On this page” navigation; and
- responsive mobile navigation.

To preview the reference-matching frontend locally, serve this directory over
HTTP so the browser can load the MDX sources:

```powershell
python -m http.server 4173 --directory mintlify
```

Then open `http://localhost:4173/`. Mintlify’s hosted renderer continues to use
`docs.json`; its stock Luma shell cannot reproduce the custom reference layout.
