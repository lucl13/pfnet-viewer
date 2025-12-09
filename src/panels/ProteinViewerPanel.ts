import * as vscode from "vscode";
import * as fs from "fs";

export class ProteinViewerPanel {
  public static currentPanel: ProteinViewerPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, accession: string | undefined, clickedFiles: vscode.Uri[] | undefined) {
    this._panel = panel;
    this._panel.onDidDispose(this.dispose, null, this._disposables);
    if (accession != undefined) {
      this._panel.webview.html = this._getWebviewContent(panel.webview, extensionUri, accession);
    };

    if (clickedFiles != undefined) {
      this._panel.webview.html = this._getWebviewContentForFiles(panel.webview, extensionUri, clickedFiles);
    };

  }

  public static render(extensionUri: vscode.Uri, accession: string | undefined) {
    const windowName = "Protein Viewer - " + accession;
    const panel = vscode.window.createWebviewPanel("proteinviewer", windowName, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });
    if (accession?.length === 4) {
      var loadCommand = `viewer.loadPdb('${accession}');`
    } else {
      var loadCommand = `viewer.loadAlphaFoldDb('${accession}');`
    }
    ProteinViewerPanel.currentPanel = new ProteinViewerPanel(panel, extensionUri, loadCommand, undefined);
  }

  public static renderFromFiles(extensionUri: vscode.Uri, clickedFiles: vscode.Uri[]) {
    const fnames = clickedFiles.map((clickedFile) => clickedFile.path.split('/').pop());
    const windowName = "Protein Viewer - " + fnames.join(" - ");
    const panel = vscode.window.createWebviewPanel("proteinviewer", windowName, vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    ProteinViewerPanel.currentPanel = new ProteinViewerPanel(panel, extensionUri, undefined, clickedFiles);
  }

  public dispose() {
    ProteinViewerPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, accession: string | undefined) {

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.js'));
    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">
            <link rel="icon" href="./favicon.ico" type="image/x-icon">
            <title>Mol* Viewer</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                html, body {
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }
                hr {
                    margin: 10px;
                }
                h1, h2, h3, h4, h5 {
                    margin-top: 5px;
                    margin-bottom: 3px;
                }
                button {
                    padding: 2px;
                }
                #app {
                    position: absolute;
                    left: 100px;
                    top: 100px;
                    width: 800px;
                    height: 600px;
                }
            </style>
            <link rel="stylesheet" type="text/css" href="${cssUri}" />
        </head>
        <body>
            <div id="app"></div>
            <script type="text/javascript" src="${jsUri}"></script>
            <script type="text/javascript">
                function getParam(name, regex) {
                    var r = new RegExp(name + '=' + '(' + regex + ')[&]?', 'i');
                    return decodeURIComponent(((window.location.search || '').match(r) || [])[1] || '');
                }
                var debugMode = getParam('debug-mode', '[^&]+').trim() === '1';
                if (debugMode) molstar.setDebugMode(debugMode, debugMode);

                var hideControls = getParam('hide-controls', '[^&]+').trim() === '1';
                var pdbProvider = getParam('pdb-provider', '[^&]+').trim().toLowerCase();
                var emdbProvider = getParam('emdb-provider', '[^&]+').trim().toLowerCase();
                var mapProvider = getParam('map-provider', '[^&]+').trim().toLowerCase();
                var pixelScale = getParam('pixel-scale', '[^&]+').trim();
                var pickScale = getParam('pick-scale', '[^&]+').trim();
                var pickPadding = getParam('pick-padding', '[^&]+').trim();
                var disableWboit = getParam('disable-wboit', '[^&]+').trim() === '1';
                var preferWebgl1 = getParam('prefer-webgl1', '[^&]+').trim() === '1' || void 0;

                molstar.Viewer.create('app', {
                    layoutShowControls: !hideControls,
                    layoutShowLog: false,
                    viewportShowExpand: false,
                    collapseLeftPanel: true,
                    pdbProvider: pdbProvider || 'pdbe',
                    emdbProvider: emdbProvider || 'pdbe',
                    volumeStreamingServer: (mapProvider || 'pdbe') === 'rcsb'
                        ? 'https://maps.rcsb.org'
                        : 'https://www.ebi.ac.uk/pdbe/densities',
                    pixelScale: parseFloat(pixelScale) || 1,
                    pickScale: parseFloat(pickScale) || 0.25,
                    pickPadding: isNaN(parseFloat(pickPadding)) ? 1 : parseFloat(pickPadding),
                    enableWboit: disableWboit ? true : void 0,
                    preferWebgl1: preferWebgl1,
                }).then(viewer => {
                    var snapshotId = getParam('snapshot-id', '[^&]+').trim();
                    if (snapshotId) viewer.setRemoteSnapshot(snapshotId);
    
                    var snapshotUrl = getParam('snapshot-url', '[^&]+').trim();
                    var snapshotUrlType = getParam('snapshot-url-type', '[^&]+').toLowerCase().trim() || 'molj';
                    if (snapshotUrl && snapshotUrlType) viewer.loadSnapshotFromUrl(snapshotUrl, snapshotUrlType);
    
                    var structureUrl = getParam('structure-url', '[^&]+').trim();
                    var structureUrlFormat = getParam('structure-url-format', '[a-z]+').toLowerCase().trim();
                    var structureUrlIsBinary = getParam('structure-url-is-binary', '[^&]+').trim() === '1';
                    if (structureUrl) viewer.loadStructureFromUrl(structureUrl, structureUrlFormat, structureUrlIsBinary);
    
                    var pdb = getParam('pdb', '[^&]+').trim();
                    if (pdb) viewer.loadPdb(pdb);
    
                    var pdbDev = getParam('pdb-dev', '[^&]+').trim();
                    if (pdbDev) viewer.loadPdbDev(pdbDev);
    
                    var emdb = getParam('emdb', '[^&]+').trim();
                    if (emdb) viewer.loadEmdb(emdb);
    
                    // var afdb = getParam('afdb', '[^&]+').trim();
                    // if (afdb) 
                    // viewer.loadAlphaFoldDb('${accession}');
                    ${accession};
    
                    var modelArchive = getParam('model-archive', '[^&]+').trim();
                    if (modelArchive) viewer.loadModelArchive(modelArchive);
                });
            </script>
            <!-- __MOLSTAR_ANALYTICS__ -->
        </body>
    </html>
    `;
  }

  private _getWebviewContentForFiles(webview: vscode.Webview, extensionUri: vscode.Uri, clickedFiles: vscode.Uri[]) {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'node_modules', 'molstar', 'build/viewer', 'molstar.js'));
    const pdbUris = clickedFiles.map((clickedFile) => webview.asWebviewUri(clickedFile));
    const extensions = clickedFiles.map((clickedFile) => clickedFile.path.split('.').pop()?.toLocaleLowerCase());
    
    const pdbFileContents: string[] = clickedFiles.map(file => {
      try {
        return fs.readFileSync(file.fsPath, 'utf8');
      } catch {
        return '';
      }
    });
    const pdbContentsJson = JSON.stringify(pdbFileContents);
    
    let loadCommands: String[] = [];
    for (let i = 0; i < pdbUris.length; i++) {
      const pdbUri = pdbUris[i];
      let extension = extensions[i];
      if (extension === 'cif' || extension === 'mmcif' || extension === 'mcif') {
        extension = 'mmcif';
      }
      loadCommands.push(
        `await viewer.loadStructureFromUrl('${pdbUri}', format='${extension}');`
      );
    }
    
    const isDdG = clickedFiles.length === 1 && 
      (clickedFiles[0].path.toLowerCase().includes('ddg') || clickedFiles[0].path.toLowerCase().includes('diff'));
    
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, user-scalable=no, minimum-scale=1.0, maximum-scale=1.0">
            <link rel="icon" href="./favicon.ico" type="image/x-icon">
            <title>Mol* Viewer</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                html, body {
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }
                hr {
                    margin: 10px;
                }
                h1, h2, h3, h4, h5 {
                    margin-top: 5px;
                    margin-bottom: 3px;
                }
                button {
                    padding: 2px;
                }
                #app {
                    position: absolute;
                    left: 100px;
                    top: 100px;
                    width: 800px;
                    height: 600px;
                }
                .dg-legend {
                    position: absolute;
                    left: 35px;
                    bottom: 5px;
                    z-index: 1000;
                    background: rgba(255,255,255,0.95);
                    padding: 8px 10px;
                    border-radius: 6px;
                    box-shadow: 0 1px 6px rgba(0,0,0,0.15);
                    font-size: 10px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(0,0,0,0.1);
                    min-width: 140px;
                }
                .dg-legend-title {
                    font-weight: 600;
                    margin-bottom: 6px;
                    font-size: 11px;
                    color: #000;
                }
                .dg-colorbar {
                    width: 120px;
                    height: 10px;
                    border-radius: 3px;
                    border: 1px solid rgba(0,0,0,0.1);
                }
                .dg-legend-labels {
                    display: flex;
                    justify-content: space-between;
                    font-size: 9px;
                    margin-top: 3px;
                    color: #333;
                }
                .dg-legend-note {
                    margin-top: 5px;
                    font-size: 8px;
                    color: #666;
                }
                .dg-control-panel {
                    position: absolute;
                    left: 35px;
                    bottom: 88px;
                    z-index: 1000;
                    background: rgba(255,255,255,0.95);
                    padding: 8px 10px;
                    border-radius: 6px;
                    box-shadow: 0 1px 6px rgba(0,0,0,0.15);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 10px;
                    min-width: 140px;
                    backdrop-filter: blur(4px);
                    border: 1px solid rgba(0,0,0,0.1);
                }
                .dg-control-panel-title {
                    font-weight: 600;
                    margin-bottom: 8px;
                    font-size: 11px;
                    color: #000;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .dg-control-content {
                    /* no special styles needed */
                }
                .dg-control-row {
                    display: flex;
                    align-items: center;
                    margin-bottom: 6px;
                    gap: 6px;
                }
                .dg-control-row label {
                    min-width: 35px;
                    font-size: 10px;
                    color: #333;
                }
                .dg-control-row input[type="number"] {
                    width: 50px;
                    padding: 3px 5px;
                    border: 1px solid #ccc;
                    border-radius: 3px;
                    font-size: 10px;
                }
                .dg-control-btn {
                    padding: 4px 8px;
                    border: none;
                    border-radius: 3px;
                    font-size: 9px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .dg-control-btn-primary {
                    background: #F6851F;
                    color: white;
                }
                .dg-control-btn-primary:hover {
                    background: #e07518;
                }
                .dg-control-btn-secondary {
                    background: #e0e0e0;
                    color: #333;
                }
                .dg-control-btn-secondary:hover {
                    background: #d0d0d0;
                }
                .dg-control-toggle {
                    cursor: pointer;
                    font-size: 12px;
                    color: #000;
                    opacity: 0.6;
                }
                .dg-control-toggle:hover {
                    opacity: 1;
                }
            </style>
            <link rel="stylesheet" type="text/css" href="${cssUri}" />
        </head>
        <body>
            <div id="app"></div>
            <div id="dg-control-panel" class="dg-control-panel" style="display:none;">
                <div class="dg-control-panel-title">
                    <span>ΔG Color Settings</span>
                    <span class="dg-control-toggle" id="dg-panel-toggle" title="Expand">+</span>
                </div>
                <div id="dg-control-content" class="dg-control-content" style="display:none;">
                    <div class="dg-control-row">
                        <label>Min:</label>
                        <input type="number" id="input-vmin" step="5" />
                    </div>
                    <div class="dg-control-row">
                        <label>Max:</label>
                        <input type="number" id="input-vmax" step="5" />
                    </div>
                    <div class="dg-control-row" style="margin-top: 10px; gap: 6px;">
                        <button class="dg-control-btn dg-control-btn-primary" id="btn-apply-color">Apply</button>
                        <button class="dg-control-btn dg-control-btn-secondary" id="btn-reset-color">Reset</button>
                    </div>
                </div>
            </div>
            <div id="dg-legend" class="dg-legend" style="display:none;">
                <div class="dg-legend-title" id="legend-title">ΔG<sub>op</sub> (kJ/mol)</div>
                <div class="dg-colorbar" id="colorbar"></div>
                <div class="dg-legend-labels">
                    <span id="vmin">0</span>
                    <span id="vmax">50</span>
                </div>
                <div class="dg-legend-note">Gray: Proline / No data</div>
            </div>
            <script type="text/javascript" src="${jsUri}"></script>
            <script type="text/javascript">
                const pdbContents = ${pdbContentsJson};
                const isDdG = ${isDdG};
                
                function parseBFactors(pdbStr) {
                    const bfactors = {};
                    const lines = pdbStr.split('\\n');
                    for (const line of lines) {
                        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
                            const chainId = line.substring(21, 22).trim() || 'A';
                            const resName = line.substring(17, 20).trim();
                            const resSeq = parseInt(line.substring(22, 26).trim());
                            const bfactorStr = line.substring(60, 66).trim().toLowerCase();
                            const bfactor = (bfactorStr === 'nan' || bfactorStr === '') ? NaN : parseFloat(bfactorStr);
                            const key = chainId + '_' + resName + '_' + resSeq;
                            if (bfactors[key] === undefined) {
                                bfactors[key] = { value: bfactor, resName: resName };
                            }
                        }
                    }
                    return bfactors;
                }
                
                function interpolateColor(color1, color2, t) {
                    const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
                    const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
                    const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);
                    return [r, g, b];
                }
                
                function getColorMap(bfactors, vmin, vmax, isDdG) {
                    const colorMap = {};
                    const white = [255, 255, 255];
                    const orange = [246, 133, 31];   // #F6851F
                    const purple = [177, 98, 167];   // #B162A7
                    const green = [102, 187, 69];    // #66BB45
                    const gray = 0x969696;
                    
                    for (const [key, data] of Object.entries(bfactors)) {
                        const { value: bfactor, resName } = data;
                        if (resName === 'PRO' || isNaN(bfactor)) {
                            colorMap[key] = gray;
                        } else {
                            const norm = Math.max(0, Math.min(1, (bfactor - vmin) / (vmax - vmin)));
                            let rgb;
                            if (isDdG) {
                                if (norm < 0.5) {
                                    rgb = interpolateColor(green, white, norm * 2);
                                } else {
                                    rgb = interpolateColor(white, purple, (norm - 0.5) * 2);
                                }
                            } else {
                                rgb = interpolateColor(white, orange, norm);
                            }
                            colorMap[key] = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
                        }
                    }
                    return colorMap;
                }
                
                function getParam(name, regex) {
                    var r = new RegExp(name + '=' + '(' + regex + ')[&]?', 'i');
                    return decodeURIComponent(((window.location.search || '').match(r) || [])[1] || '');
                }
                
                var debugMode = getParam('debug-mode', '[^&]+').trim() === '1';
                if (debugMode) molstar.setDebugMode(debugMode, debugMode);

                var hideControls = getParam('hide-controls', '[^&]+').trim() === '1';
                var pdbProvider = getParam('pdb-provider', '[^&]+').trim().toLowerCase();
                var emdbProvider = getParam('emdb-provider', '[^&]+').trim().toLowerCase();
                var mapProvider = getParam('map-provider', '[^&]+').trim().toLowerCase();
                var pixelScale = getParam('pixel-scale', '[^&]+').trim();
                var pickScale = getParam('pick-scale', '[^&]+').trim();
                var pickPadding = getParam('pick-padding', '[^&]+').trim();
                var disableWboit = getParam('disable-wboit', '[^&]+').trim() === '1';
                var preferWebgl1 = getParam('prefer-webgl1', '[^&]+').trim() === '1' || void 0;

                molstar.Viewer.create('app', {
                    layoutShowControls: !hideControls,
                    layoutShowLog: false,
                    viewportShowExpand: false,
                    collapseLeftPanel: true,
                    pdbProvider: pdbProvider || 'pdbe',
                    emdbProvider: emdbProvider || 'pdbe',
                    volumeStreamingServer: (mapProvider || 'pdbe') === 'rcsb'
                        ? 'https://maps.rcsb.org'
                        : 'https://www.ebi.ac.uk/pdbe/densities',
                    pixelScale: parseFloat(pixelScale) || 1,
                    pickScale: parseFloat(pickScale) || 0.25,
                    pickPadding: isNaN(parseFloat(pickPadding)) ? 1 : parseFloat(pickPadding),
                    enableWboit: disableWboit ? true : void 0,
                    preferWebgl1: preferWebgl1,
                }).then(async viewer => {
                    const plugin = viewer.plugin;
                    
                    const bfactors = pdbContents.length > 0 ? parseBFactors(pdbContents[0]) : {};
                    const values = Object.values(bfactors)
                        .map(d => d.value)
                        .filter(v => !isNaN(v) && v !== 0);
                    
                    let vmin, vmax;
                    if (isDdG) {
                        const absMax = Math.max(...values.map(v => Math.abs(v)));
                        vmax = Math.ceil(absMax / 5) * 5 || 25;
                        vmin = -vmax;
                    } else {
                        vmin = 0;
                        vmax = Math.ceil(Math.max(...values) / 5) * 5 || 50;
                    }
                    
                    const colorMap = getColorMap(bfactors, vmin, vmax, isDdG);
                    
                    window.dgColorMap = colorMap;
                    window.dgBfactors = bfactors;
                    window.dgIsDdG = isDdG;
                    
                    plugin.representation.structure.themes.colorThemeRegistry.add({
                        name: 'dg_color',
                        label: isDdG ? 'ΔΔGop' : 'ΔGop',
                        category: 'Residue Property',
                        factory: (ctx, props) => ({
                            color: (location) => {
                                try {
                                    const unit = location.unit;
                                    const model = unit.model;
                                    const residueIndex = unit.residueIndex[location.element];
                                    const chainIndex = unit.chainIndex[location.element];
                                    const chainId = model.atomicHierarchy.chains.auth_asym_id.value(chainIndex) || 'A';
                                    const firstAtomIndex = model.atomicHierarchy.residueAtomSegments.offsets[residueIndex];
                                    const resName = model.atomicHierarchy.atoms.auth_comp_id.value(firstAtomIndex);
                                    const resId = model.atomicHierarchy.residues.auth_seq_id.value(residueIndex);
                                    const key = chainId + '_' + resName + '_' + resId;
                                    const color = window.dgColorMap[key];
                                    return color !== undefined ? color : 0xcccccc;
                                } catch (e) {
                                    return 0xcccccc;
                                }
                            },
                            granularity: 'group',
                            props: props,
                            description: isDdG ? 'Color by ΔΔG' : 'Color by ΔG'
                        }),
                        getParams: () => ({}),
                        defaultValues: () => ({}),
                        isApplicable: () => true
                    });
                    
                    ${loadCommands.join("")}
                    
                    const waitForStructure = () => {
                        const structures = plugin.managers.structure.hierarchy.current.structures;
                        const structureCell = structures[0];
                        if (!structureCell) {
                            setTimeout(waitForStructure, 100);
                            return;
                        }
                        if (structureCell) {
                            const structure = structureCell?.cell?.obj?.data;
                            
                            if (structure) {
                                const model = structure.model;
                                const deltaGopData = new Map();
                                const residues = new Set();
                                
                                for (let i = 0; i < model.atomicHierarchy.atoms._rowCount; i++) {
                                    const residueIndex = model.atomicHierarchy.residueAtomSegments.index[i];
                                    const chainIndex = model.atomicHierarchy.chainAtomSegments.index[i];
                                    const chainId = model.atomicHierarchy.chains.auth_asym_id.value(chainIndex) || 'A';
                                    const auth_seq_id = model.atomicHierarchy.residues.auth_seq_id.value(residueIndex);
                                    const atomName = model.atomicHierarchy.atoms.label_atom_id.value(i);
                                    
                                    if (atomName === 'CA') {
                                        const key = chainId + '_' + auth_seq_id;
                                        if (!residues.has(key)) {
                                            residues.add(key);
                                            const bfactor = model.atomicConformation.B_iso_or_equiv.value(i);
                                            deltaGopData.set(key, bfactor);
                                        }
                                    }
                                }
                                
                                model._staticPropertyData = model._staticPropertyData || {};
                                model._staticPropertyData['dGop'] = {
                                    value: deltaGopData,
                                    props: {}
                                };
                                
                                window.hoverLabelText = isDdG ? 'ΔΔGop' : 'ΔGop';
                                window.occupancyLabelText = 'confidence';
                                
                                console.log('dGop data stored. Sample keys:', Array.from(deltaGopData.keys()).slice(0, 5));
                                console.log('Sample values:', Array.from(deltaGopData.entries()).slice(0, 5));
                                console.log('Total residues:', deltaGopData.size);
                            }
                            
                            if (Object.keys(window.dgColorMap).length > 0) {
                                try {
                                    plugin.managers.structure.component.updateRepresentationsTheme(
                                        structureCell.components,
                                        { color: 'dg_color' }
                                    );
                                } catch (e) {}
                                
                                const legend = document.getElementById('dg-legend');
                                const colorbar = document.getElementById('colorbar');
                                const legendTitle = document.getElementById('legend-title');
                                
                                if (isDdG) {
                                    legendTitle.innerHTML = 'ΔΔG<sub>op</sub> (kJ/mol)';
                                } else {
                                    legendTitle.innerHTML = 'ΔG<sub>op</sub> (kJ/mol)';
                                }
                                
                                document.getElementById('vmin').textContent = vmin.toFixed(0);
                                document.getElementById('vmax').textContent = vmax.toFixed(0);
                                legend.style.display = 'block';
                                
                                // Control Panel Setup
                                const controlPanel = document.getElementById('dg-control-panel');
                                const inputVmin = document.getElementById('input-vmin');
                                const inputVmax = document.getElementById('input-vmax');
                                const btnApply = document.getElementById('btn-apply-color');
                                const btnReset = document.getElementById('btn-reset-color');
                                const panelToggle = document.getElementById('dg-panel-toggle');
                                const controlContent = document.getElementById('dg-control-content');
                                
                                window.dgOriginalVmin = vmin;
                                window.dgOriginalVmax = vmax;
                                inputVmin.value = vmin;
                                inputVmax.value = vmax;
                                controlPanel.style.display = 'block';
                                
                                if (isDdG) {
                                    colorbar.style.background = 'linear-gradient(to right, #66BB45, #FFFFFF, #B162A7)';
                                } else {
                                    colorbar.style.background = 'linear-gradient(to right, #FFFFFF, #F6851F)';
                                }
                                
                                panelToggle.addEventListener('click', () => {
                                    if (controlContent.style.display === 'none') {
                                        controlContent.style.display = 'block';
                                        panelToggle.textContent = '−';
                                    } else {
                                        controlContent.style.display = 'none';
                                        panelToggle.textContent = '+';
                                    }
                                });
                                
                                const applyColorTheme = async (newVmin, newVmax) => {
                                    console.log('Applying new color range:', newVmin, newVmax);
                                    window.dgColorMap = getColorMap(window.dgBfactors, newVmin, newVmax, isDdG);
                                    
                                    const currentStructures = plugin.managers.structure.hierarchy.current.structures;
                                    if (currentStructures.length > 0) {
                                        const sc = currentStructures[0];
                                        try {
                                            await plugin.managers.structure.component.updateRepresentationsTheme(
                                                sc.components,
                                                { color: 'element-symbol' }
                                            );
                                            await plugin.managers.structure.component.updateRepresentationsTheme(
                                                sc.components,
                                                { color: 'dg_color' }
                                            );
                                            console.log('Color theme updated');
                                        } catch (e) {
                                            console.error('Failed to update theme:', e);
                                        }
                                    }
                                    
                                    document.getElementById('vmin').textContent = newVmin.toFixed(0);
                                    document.getElementById('vmax').textContent = newVmax.toFixed(0);
                                };
                                
                                btnApply.addEventListener('click', () => {
                                    const newVmin = parseFloat(inputVmin.value);
                                    const newVmax = parseFloat(inputVmax.value);
                                    if (!isNaN(newVmin) && !isNaN(newVmax) && newVmin < newVmax) {
                                        applyColorTheme(newVmin, newVmax);
                                    } else {
                                        console.log('Invalid vmin/vmax values');
                                    }
                                });
                                
                                btnReset.addEventListener('click', () => {
                                    inputVmin.value = window.dgOriginalVmin;
                                    inputVmax.value = window.dgOriginalVmax;
                                    applyColorTheme(window.dgOriginalVmin, window.dgOriginalVmax);
                                });
                                
                            }
                        }
                    };
                    setTimeout(waitForStructure, 100);

                    var modelArchive = getParam('model-archive', '[^&]+').trim();
                    if (modelArchive) viewer.loadModelArchive(modelArchive);
                });
            </script>
            <!-- __MOLSTAR_ANALYTICS__ -->
        </body>
    </html>`;
  }
}
