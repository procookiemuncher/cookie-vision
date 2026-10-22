# cookie-vision
Universal Cheating (La Révolution)

## Bookmarklet (auto-updating)

Make a new bookmark and paste this as the URL. It pulls the latest `beta/src.js` from GitHub Pages every time you click it, so whatever is pushed to `main` is what runs (Pages takes ~1 min to update after a push).

```
javascript:(()=>{const s=document.createElement('script');s.src='https://procookiemuncher.github.io/cookie-vision/beta/src.js?t='+Date.now();document.body.appendChild(s);})()
```
