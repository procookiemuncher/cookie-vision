# cookie-vision
(La Révolution)

## Bookmarklet (auto-updating)

Make a new bookmark and paste this as the URL. It pulls the latest `v2/obs.js` from GitHub Pages every time you click it, so whatever is pushed to `main` is what runs (Pages takes ~1 min to update after a push).

```
javascript:(()=>{const s=document.createElement('script');s.src='https://procookiemuncher.github.io/cookie-vision/v2/obs.js?t='+Date.now();document.body.appendChild(s);})()
```

## Shortcuts

| Action | Windows | Mac |
| --- | --- | --- |
| Solve the page (plus any snapshots) | Alt+S | Option+S |
| Snapshot the page for multi-part questions | Alt+P | Option+P |
| Reveal steps / back to just the answer | Alt+H | Option+H |
| Next step | Alt+N or Ctrl+N | Option+N or Control+N |
| Previous step | Alt+B | Option+B |
| Show / hide | Alt+V | Option+V |
| Type the answer into the nearest box (FRQ) | Alt+T | Option+T |
