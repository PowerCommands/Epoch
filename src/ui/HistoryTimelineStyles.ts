/** Scoped presentation, borrowing the main menu's artwork, parchment and bronze palette. */
export const HISTORY_TIMELINE_STYLES = `
#epoch-history-viewer { position:fixed; inset:0; z-index:20000; padding:clamp(12px,2vw,28px); box-sizing:border-box; display:flex; flex-direction:column; gap:18px; color:#302316; font-family:Georgia,'Times New Roman',serif; background:linear-gradient(180deg,rgba(33,23,14,.52),rgba(33,23,14,.76)),url('/assets/background.webp') center/cover; }
#epoch-history-viewer * { box-sizing:border-box; }
#epoch-history-viewer .ht-heading { display:flex; align-items:center; gap:18px; flex-shrink:0; padding:0 8px; color:#f8ecd1; text-shadow:0 2px 12px #1b110b; }
#epoch-history-viewer .ht-brand { width:68px; height:68px; object-fit:cover; border-radius:50%; border:2px solid #d7b77c; box-shadow:0 0 0 5px #d7b77c22,0 8px 20px #0005; }
#epoch-history-viewer .ht-title { flex:1; }
#epoch-history-viewer .ht-kicker { display:block; font:11px system-ui,sans-serif; text-transform:uppercase; letter-spacing:.25em; color:#dbbe88; }
#epoch-history-viewer h1 { font-size:clamp(24px,2.7vw,42px); font-weight:normal; margin:5px 0; letter-spacing:.015em; }
#epoch-history-viewer .ht-subtitle { font-size:14px; font-style:italic; color:#dccbae; margin:0; }
#epoch-history-viewer button { padding:11px 19px; border:1px solid #c5a36b; border-radius:4px; color:#f9ecd0; background:linear-gradient(180deg,#614326,#382719); box-shadow:inset 0 1px #ffffff18,0 3px 8px #26160926; font:15px Georgia,serif; cursor:pointer; transition:background .15s,box-shadow .15s; }
#epoch-history-viewer button:hover:not(:disabled) { background:linear-gradient(180deg,#805933,#4c321d); box-shadow:0 0 0 2px #c99d5730; }
#epoch-history-viewer button:disabled { cursor:default; }
#epoch-history-viewer :is(button,input,select):focus-visible { outline:3px solid #de9b3d; outline-offset:3px; }
#epoch-history-viewer .ht-play { min-width:110px; background:linear-gradient(180deg,#ce882f,#985017); border-color:#ebc887; }
#epoch-history-viewer .ht-body { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:20px; min-height:0; flex:1; }
#epoch-history-viewer .ht-atlas { display:flex; flex-direction:column; min-height:0; padding:20px; border:1px solid #e0c698; border-radius:7px; background:linear-gradient(135deg,#fbf2dfed,#e6d8bced); box-shadow:0 14px 40px #150b0940,inset 0 0 0 4px #fff5; }
#epoch-history-viewer .ht-section-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; border-bottom:1px solid #ad8e5f70; padding-bottom:13px; margin-bottom:15px; }
#epoch-history-viewer .ht-section-heading strong { font-size:20px; font-weight:normal; }
#epoch-history-viewer .ht-section-heading small { font:10px system-ui; letter-spacing:.16em; text-transform:uppercase; color:#80643d; }
#epoch-history-viewer .ht-map-stage { position:relative; min-height:120px; flex:1; display:flex; align-items:center; justify-content:center; padding:14px; overflow:hidden; background:radial-gradient(ellipse,#29414a,#14272d); border:1px solid #a88951; box-shadow:inset 0 0 45px #0005,0 0 0 4px #86643818; }
#epoch-history-viewer .ht-map-stage::after { content:'✦'; position:absolute; right:14px; bottom:9px; font-size:34px; color:#e5ca8d80; pointer-events:none; }
#epoch-history-viewer canvas { display:block; width:100%; height:100%; min-height:0; object-fit:contain; image-rendering:pixelated; }
#epoch-history-viewer .ht-map-label { font:12px/1.5 system-ui; color:#735d3e; padding:13px 0 10px; }
#epoch-history-viewer .ht-legend { display:flex; gap:6px; flex-wrap:wrap; max-height:76px; overflow:auto; flex-shrink:0; font:12px system-ui; }
#epoch-history-viewer .ht-legend>span { padding:5px 8px; background:#fff8; border:1px solid #9e7e4833; border-radius:3px; }
#epoch-history-viewer .ht-feed { min-height:0; overflow:auto; padding:clamp(20px,2.6vw,38px); border:1px solid #dbbf8b; border-radius:6px; background:radial-gradient(ellipse at top,#fffbee,#efe3c9); box-shadow:0 14px 40px #150b0940,inset 0 0 0 5px #fff6,inset 0 0 0 6px #b7976150; scrollbar-color:#a88a56 #ece0c6; }
#epoch-history-viewer .ht-masthead { text-align:center; font-size:clamp(22px,2.1vw,33px); letter-spacing:.025em; border-bottom:4px double #81663f; padding:4px 0 18px; margin:0 0 20px; }
#epoch-history-viewer .ht-feed article { border-bottom:1px solid #ab906660; padding:4px 0 24px; margin-bottom:22px; }
#epoch-history-viewer .ht-feed small { display:block; color:#816539; font:10px/1.7 system-ui; text-transform:uppercase; letter-spacing:.12em; }
#epoch-history-viewer .ht-feed h3 { font-size:clamp(23px,2vw,32px); line-height:1.12; margin:12px 0 18px; }
#epoch-history-viewer .ht-feed img { display:block; width:100%; max-height:300px; object-fit:cover; filter:sepia(.25); border:1px solid #ac9265; padding:4px; background:#fffa; }
#epoch-history-viewer .ht-feed p { font-size:16px; line-height:1.7; }
#epoch-history-viewer .ht-feed em { display:block; color:#806b4b; font-size:14px; line-height:1.6; }
#epoch-history-viewer .ht-quiet { text-align:center; padding:22px 0; }
#epoch-history-viewer .ht-quiet img { opacity:.8; margin-bottom:26px; }
#epoch-history-viewer .ht-controls { flex-shrink:0; display:grid; grid-template-columns:auto minmax(120px,1fr) auto; gap:14px 24px; align-items:center; padding:17px 24px; border:1px solid #d4b578; border-radius:6px; background:linear-gradient(180deg,#f7efdfed,#e9dabfed); box-shadow:0 8px 25px #10090740; }
#epoch-history-viewer .ht-date { grid-column:1/3; font-size:18px; letter-spacing:.015em; }
#epoch-history-viewer .ht-progress { font:11px system-ui; color:#846b43; text-transform:uppercase; letter-spacing:.12em; text-align:right; }
#epoch-history-viewer .ht-scrub { grid-column:1/-1; display:flex; gap:16px; align-items:center; font:11px system-ui; color:#80643d; }
#epoch-history-viewer input[type=range] { flex:1; min-width:80px; accent-color:#a66c24; cursor:pointer; height:18px; }
#epoch-history-viewer .ht-transport { display:flex; gap:8px; align-items:center; }
#epoch-history-viewer .ht-speed { grid-column:-2/-1; display:flex; gap:10px; align-items:center; justify-self:end; font:11px system-ui; text-transform:uppercase; letter-spacing:.12em; color:#735a36; }
#epoch-history-viewer select { border:1px solid #bca076; border-radius:4px; padding:9px 12px; background:#fff8eb; color:#4c351d; font:14px Georgia,serif; cursor:pointer; }
@media(max-width:800px) { #epoch-history-viewer { gap:12px; padding:12px; } #epoch-history-viewer .ht-body { grid-template-columns:1fr; overflow:auto; } #epoch-history-viewer .ht-atlas { min-height:340px; } #epoch-history-viewer .ht-feed { min-height:300px; overflow:visible; } #epoch-history-viewer .ht-brand { width:46px;height:46px; } #epoch-history-viewer .ht-subtitle { display:none; } #epoch-history-viewer .ht-controls { padding:12px; gap:10px; } #epoch-history-viewer .ht-date { font-size:14px; } #epoch-history-viewer button { padding:9px 12px; } }
@media(max-width:520px) { #epoch-history-viewer .ht-heading { gap:10px;padding:0; } #epoch-history-viewer h1 { font-size:21px; } #epoch-history-viewer .ht-brand { display:none; } #epoch-history-viewer .ht-controls { grid-template-columns:1fr auto; } #epoch-history-viewer .ht-progress { grid-column:2; } #epoch-history-viewer .ht-date { grid-column:1; } #epoch-history-viewer .ht-transport { grid-column:1/-1; justify-content:center; } #epoch-history-viewer .ht-speed { grid-column:1/-1; justify-self:center; } #epoch-history-viewer .ht-speed>span { display:none; } }
`;
