const rows = 10, columns = 10;
const rowoctaves = [0.5, 0.5, 1, 1, 1, 2, 2, 2, 3, 3];
const colfreq = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25];
let grid = Array.from({length: rows}, () => new Array(columns).fill(0));
let generation = 0, isplaying = false; timer = null;
let audioCtx = null, mastergain = null;
let activenodes = {};

function key(r, c) { return r + ',' + c; }

function initAudio() {
    if (!audioCtx) {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();
        mastergain = audioCtx.createGain();
        mastergain.gain.setValueAtTime(0.25, audioCtx.currentTime);

        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 20;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        mastergain.connect(compressor);
        compressor.connect(audioCtx.destination);
    }
    return audioCtx;
}

function startnote(r, c) {
    const k = key(r, c);
    if (activenodes[k]) return;
    const ac = initAudio();
    const now = ac.currentTime;
    const freq = colfreq[c] * rowoctaves[r];
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.04);
    osc.connect(gain);
    gain.connect(mastergain);
    osc.start(now);
    activenodes[k] = {osc, gain};
}

function stopnote(r, c) {
    const k = key(r, c);
    const node = activenodes[k];
    if (!node) return;
    const ac = initAudio();
    const now = ac.currentTime;
    node.gain.gain.setValueAtTime(/*node.gain.gain.value*/0.03, now);
    node.gain.gain.linearRampToValueAtTime(0, now + 0.12);
    node.osc.stop(now + 0.15);
    delete activenodes[k];
}

function stopall() {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            stopnote(r, c);
        }
    }
}

function parserule(str) {
    const m=str.match(/B([0-8]*)\/S([0-8]*)/);
    if (!m) return{born: [3], survive: [2, 3]};
    return{born: m[1].split('').map(Number), survive: m[2].split('').map(Number)};
}

const gridelement = document.getElementById('grid');
function buildgrid() {
    gridelement.innerHTML = '';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.addEventListener('click', () => togglecell(r, c));
            gridelement.appendChild(cell);
        }
    }
}

function togglecell(r, c) {
    grid[r][c] = grid[r][c] ? 0:1;
    if (isplaying) {
        if (grid[r][c]) startnote(r, c);
        else stopnote(r, c);
    }
    rendergrid();
    updatestats();
}

function rendergrid(born = [], dying = []) {
    const cells = gridelement.querySelectorAll('.cell');
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            const cell = cells[r * columns + c];
            cell.className = 'cell';
            const isborn = born.some(([br, bc]) => br === r && bc === c);
            const isdying = dying.some(([dr, dc]) => dr === r && dc === c);
            if (isborn) cell.classList.add('born');
            else if (isdying) cell.classList.add('dying');
            else if (grid[r][c])cell.classList.add('alive');
        }
    }
}

function countneighbors(g, r, c) {
    let n = 0;
    for (let dr =- 1; dr <= 1; dr++) {
        for (let dc =- 1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            n += g[(r + dr + rows) % rows][(c + dc + columns) % columns];
        }
    }
    return n;
}

function getnext() {
    const rule = parserule(document.getElementById('rule').value);
    const next = Array.from({length:rows}, () => new Array(columns).fill(0));
    const born = [], dying = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            const n = countneighbors(grid, r, c);
            if (grid[r][c] === 1) {
                if (rule.survive.includes(n))next[r][c] = 1;
                else dying.push([r, c]);
            } else {
                if (rule.born.includes(n)) {
                    next[r][c] = 1
                    born.push([r, c]);
                }
            }
        }
    }
    return {next, born, dying};
}

function step() {
    const{next, born, dying} = getnext();
    rendergrid(born, dying);
    if (isplaying) {
        dying.forEach(([r, c]) => stopnote(r, c));
        born.forEach(([r, c]) => startnote(r, c));
    }
    setTimeout(() => {grid = next; generation++; rendergrid(); updatestats();}, 1200 * 0.5);
}

function updatestats() {
    document.getElementById('gen').textContent = generation;
    document.getElementById('alive').textContent = grid.flat().filter(Boolean).length;
}

const play = document.getElementById('play');
function startplay() {
    isplaying = true;
    play.textContent = 'pause';
    play.classList.add('playing');
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            if (grid[r][c]) startnote(r, c);
        }
    }
    function tick() {
        step();
        timer = setTimeout(tick, 1200);
    }
    tick();
}

function stopplay() {
    isplaying = false;
    clearTimeout(timer);
    timer = null;
    play.textContent = 'play';
    play.classList.remove('playing');
    stopall();
}

play.addEventListener('click', () => {if (isplaying) stopplay(); else startplay();});

document.getElementById('clear').addEventListener('click', () => {
    stopplay();
    grid = Array.from({length: rows}, () => new Array(columns).fill(0));
    generation = 0;
    rendergrid();
    updatestats();
});

document.getElementById('random').addEventListener('click', () => {
    stopplay();
    grid = Array.from({length: rows}, () => Array.from({length: columns}, () => Math.random() < 0.3 ? 1:0));
    generation = 0;
    rendergrid();
    updatestats();
});

document.getElementById('rule').addEventListener('change', updatestats);
buildgrid();
updatestats();
