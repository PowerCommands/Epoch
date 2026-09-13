/** Current Epoch menu palette: midnight blue, gold edges and warm light text. */
export const EMPIRE_OVERLAY_STYLE = `
  --empire-bg:#02070d;
  --empire-panel:#091520;
  --empire-panel-light:#0d1a27;
  --empire-panel-hover:#122130;
  --empire-gold:#b88a43;
  --empire-gold-bright:#efcd83;
  --empire-gold-muted:#80663c;
  --empire-text:#f2eadb;
  --empire-muted:#9ba9b5;
  --empire-border:rgba(190,145,70,.35);
  --empire-border-soft:rgba(190,145,70,.17);
  --empire-primary:linear-gradient(180deg,rgba(145,100,37,.97),rgba(77,48,16,.98));
  --empire-primary-hover:linear-gradient(180deg,#9f7132,#5e3b16);
  position:fixed;inset:0;z-index:10018;display:flex;align-items:center;justify-content:center;
  box-sizing:border-box;padding:18px;background:rgba(2,7,13,.82);color:var(--empire-text);
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  color-scheme:dark;
`;
export const EMPIRE_CARD_SURFACE = `
  border:1px solid var(--empire-border);border-radius:2px;
  background:linear-gradient(150deg,#0d1a27,#050d16);
  box-shadow:0 24px 70px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.025);
`;
export const EMPIRE_DIALOG_CSS = `
  :is(.wc-card,.wcs-card,.gon-card){color:var(--empire-text);scrollbar-color:var(--empire-gold-muted) var(--empire-bg);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  :is(.wc-card,.wcs-card,.gon-card) *{box-sizing:border-box}
  :is(.wc-card,.wcs-card,.gon-card) [hidden]{display:none!important}
  :is(.wc-card,.wcs-card,.gon-card) h1{font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:.01em;color:var(--empire-gold-bright)}
  :is(.wc-card,.wcs-card,.gon-card) h2{font-family:Georgia,'Times New Roman',serif;color:var(--empire-gold-bright);letter-spacing:.025em}
  :is(.wc-card,.wcs-card,.gon-card) button{font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:700;letter-spacing:.035em;transition:background .15s,border-color .15s}
  :is(.wc-card,.wcs-card,.gon-card) button:focus-visible,
  :is(.wc-card,.wcs-card,.gon-card) :is(input,select,summary):focus-visible{outline:2px solid var(--empire-gold-bright);outline-offset:3px}
  :is(.wc-header,.gon-panel-header){padding-bottom:16px;border-bottom:1px solid var(--empire-border);flex-shrink:0}
  .empire-kicker{font:700 11px system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--empire-gold-bright);margin-bottom:7px}
  :is(.wc-card,.gon-card) summary{cursor:pointer;color:var(--empire-gold-bright);font-size:14px;padding:10px 0}
  :is(.wc-card,.gon-card) input,:is(.wc-card,.gon-card) select{max-width:100%}
  .gon-card input[type=number],.gon-card select{color:var(--empire-text);background:var(--empire-panel)}
  .wc-table{overflow-x:auto}.wc-row{min-width:680px}
  .wc-status-grid{grid-template-columns:repeat(auto-fit,minmax(155px,1fr))}
  .wc-metric{border-top:2px solid var(--empire-gold-muted)}
  .wc-card button.wc-tab-active,.wcs-card button.wcs-primary{background:var(--empire-primary);border-color:var(--empire-gold);color:#fff9ea}
  .wc-card button.wc-tab:hover{background:var(--empire-panel-hover)}
  .wc-card button.wc-tab-active:hover{background:var(--empire-primary-hover)}
  .wcs-card button.wcs-yes.wcs-selected{background:#244731;color:#d8efd5}
  .wcs-card button.wcs-no.wcs-selected{background:#58272a;color:#ffe0da}
  .wc-card button.wc-leave{background:#58272a;color:#ffe0da;border-color:#a64c43}
  .wc-content{overscroll-behavior:contain}
  .gon-panel-card{height:min(780px,94dvh);display:flex;flex-direction:column;overflow:hidden!important;gap:10px}
  .gon-panel-header h1{font-size:clamp(25px,3vw,34px)}
  .gon-overview{flex-shrink:0;max-height:26vh;overflow:auto;border-bottom:1px solid var(--empire-border)}
  .gon-overview summary{padding:4px 0 10px}
  .gon-overview .gon-status-grid{margin:4px 0 12px}
  .gon-wizard{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
  .gon-stepper{display:flex;gap:8px;padding:4px 0 12px;flex-shrink:0}
  .gon-card button.gon-step{flex:1;padding:11px 8px;text-align:left;background:var(--empire-panel);color:var(--empire-muted);border-color:var(--empire-border)}
  .gon-card button.gon-step[aria-current=step]{background:var(--empire-primary);color:#fff9ea;border-color:var(--empire-gold)}
  .gon-step-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 5px 8px 0}
  .gon-step-body h2{margin:8px 0 12px;font-size:21px}
  .gon-step-page{min-width:0}
  .gon-step-body .gon-section-heading{display:block}
  .gon-step-body .gon-section-heading .gon-muted{margin-bottom:14px}
  .gon-panel-footer{flex-shrink:0;margin:0;padding-top:12px;border-top:1px solid var(--empire-border);gap:9px}
  .gon-step-status{margin-right:auto;color:var(--empire-gold);font:12px system-ui,sans-serif}
  .gon-panel-footer .gon-validation{font-size:12px;max-width:40ch;line-height:1.4}
  .gon-card button.gon-primary{background:var(--empire-primary);border-color:var(--empire-gold);color:#fff9ea}
  .gon-card button.gon-primary:hover:not(:disabled),.gon-card button.gon-primary:focus-visible{background:var(--empire-primary-hover);color:#fff9ea}
  .gon-locked-details{border-top:1px solid var(--empire-border-soft);margin-top:12px}
  .gon-gp-pool{margin:8px 0 16px;padding:12px 14px}
  .gon-gp-pool-value{font-size:24px}
  .gon-sport-grid{grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
  .gon-sport-image{height:90px}.gon-sport-committed{font-size:16px}
  .gon-commitment-card{border-top:2px solid var(--empire-gold-muted)}
  .gon-host-sports{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:18px}
  .gon-card button.gon-host-sport{display:grid;gap:9px;text-align:left;padding:9px;background:var(--empire-panel);border-color:var(--empire-border)}
  .gon-card button.gon-host-sport[aria-pressed=true]{border-color:var(--empire-gold);box-shadow:inset 0 0 0 2px var(--empire-gold);background:var(--empire-panel-hover)}
  .gon-host-sport img{width:100%;height:110px;object-fit:cover;border-radius:2px}
  .gon-results{overflow:auto;min-height:100px;max-height:32vh;flex-shrink:0}

  :is(.wc-card,.wcs-card,.gon-card) button{box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}
  :is(.wc-card,.wcs-card,.gon-card) button:hover:not(:disabled){border-color:var(--empire-gold-bright)}
  :is(.wc-subtitle,.wc-muted,.wc-outcome-text,.wc-empty,.gon-subtitle,.gon-muted,.gon-availability,.gon-cost-note,.gon-sport-effective,.gon-empty-result,.wcs-context,.wcs-muted,.wcs-proposer,.wcs-option-desc){color:var(--empire-muted)}
  :is(.wc-metric-label,.gon-metric-label,.gon-field-label,.gon-sport-name,.wcs-progress,.wcs-influence-label){color:var(--empire-gold);font-size:12px;letter-spacing:.08em;text-transform:uppercase}
  :is(.gon-gp-pool-value,.gon-sport-committed,.gon-unallocated,.gon-result-gold){color:var(--empire-gold-bright)}
  .wc-card button.wc-tab:not(.wc-tab-active){color:var(--empire-muted)}
  .wc-row-human{background:rgba(184,138,67,.08)}
  .wcs-card button.wcs-primary:hover{background:var(--empire-primary-hover);color:#fff4d5}
  .wcs-card button.wcs-option-selected{border-color:var(--empire-gold);box-shadow:inset 3px 0 0 var(--empire-gold)}
  .wcs-card button.wcs-yes:focus-visible,.wcs-card button.wcs-no:focus-visible{outline-color:var(--empire-gold-bright)}
  @media(max-width:680px){
    .gon-panel-card{height:94dvh;gap:7px}.gon-stepper{gap:5px}
    .gon-card button.gon-step{font-size:12px;padding:10px 6px}
    .gon-panel-header{position:static;background:transparent;padding-bottom:10px}
    .gon-panel-footer .gon-validation{order:-1;max-width:none;width:100%}
    .gon-step-status{font-size:11px}.gon-panel-footer button{padding:9px 11px}
    .gon-overview summary{font-size:12px}.gon-sport-grid{grid-template-columns:repeat(auto-fit,minmax(145px,1fr))}
  }
`;
