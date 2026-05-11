var audioCtx;
var oscs = [];
var liveCodeState = [];
var isplaying = false;
var scheduleTimeout = null;
var loopStart = 0;
var gainNodes = [];
let masterGain = null;
const playButton = document.querySelector('button');

//table mapping note names to frequencies
const noteFreqMap = {
    'C3':  130.812782650299317,
    'C#3': 138.591315488436048,
    'D3':  146.832383958703780,
    'D#3': 155.563491861040455,
    'E3':  164.813778456434964,
    'F3':  174.614115716501942,
    'F#3': 184.997211355817199,
    'G3':  195.997717990874647,
    'G#3': 207.652348789972569,
    'A3':  220.000000000000000,
    'A#3': 233.081880759044958,
    'B3':  246.941650628062055,

    'C4': 261.625565300598634,
    'C#4': 277.182630976872096,
    'D4': 293.664767917407560,
    'D#4': 311.126983722080910,
    'E4': 329.627556912869929,
    'F4': 349.228231433003884,
    'F#4': 369.994422711634398,
    'G4': 391.995435981749294,
    'G#4': 415.304697579945138,
    'A4': 440.000000000000000,
    'A#4': 466.163761518089916,
    'B4': 493.883301256124111,

    'C5': 523.251130601197269,
    'C#5': 554.365261953744192,
    'D5': 587.329535834815120,
    'D#5': 622.253967444161821,
    'E5': 659.255113825739859,
    'F5': 698.456462866007768,
    'F#5': 739.988845423268797,
    'G5': 783.990871963498588,
    'G#5': 830.609395159890277,
    'A5': 880.000000000000000,
    'A#5': 932.327523036179832,
    'B5': 987.766602512248223,
}

//sort pitches highest to lowest for pianoroll visual
const allPitches = Object.entries(noteFreqMap).sort((a, b) => b[1] - a[1]);

//find which row on the pianoroll matches the frequency
function pitchToRow(freq) {
    let closest = 0;
    let minDist = Infinity;
    allPitches.forEach(([name, f], i) => {
        const dist = Math.abs(f - freq);
        if (dist < minDist) {
            minDist = dist;
            closest = i;
        }
    });
    return closest;
}

//look up note letter in table and return corresponding frequency
function notetoFreq(note, octave) {
    //console.log(`looking up: "${note}", charCodes:`, [...note].map(c => c.charCodeAt(0)));
    const key = note + octave;
    const freq = noteFreqMap[key];
    if (!freq) throw new Error(`Unknown note: "${note}"`);
    return freq;
}

//build oscillator for each line
function buildOsc(count) {
    //get rid of old oscillators
    oscs.forEach(o => o.disconnect());
    gainNodes.forEach(g => g.disconnect());
    oscs = [];
    gainNodes = [];

    //(re)build
    for (let i = 0; i < count; i++) {
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        const osc = audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.connect(gain).connect(masterGain);
        osc.start();
        oscs.push(osc);
        gainNodes.push(gain);
    }
}

//initialize or resume audio
function startAudio() {
    if (audioCtx) {
        audioCtx.resume();
    } else {
        initAudio();
    }
    //parse current inpute
    reevaluate();
    //rebuild oscillators
    buildOsc(liveCodeState.length);
    isplaying = true;
    //schedule future notes
    scheduleAudio();
    playButton.textContent = 'stop';
    //restart pianoroll
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(drawPianoRoll);
}

//stop audio
function stopAudio() {
    if (audioCtx) {
        audioCtx.suspend();
        gainNodes.forEach(gain => {
            gain.gain.cancelScheduledValues(audioCtx.currentTime);
            gain.gain.setValueAtTime(0, audioCtx.currentTime);
        });
    }
    clearTimeout(scheduleTimeout);
    scheduleTimeout = null;
    isplaying = false;
    loopStart = 0;
    playButton.textContent = 'start';
}

//initialize audio context
function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.25;

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    masterGain.connect(compressor);
    compressor.connect(audioCtx.destination);
}

//schedule the notes that were inputted
function scheduleAudio() {
    //quit if user stops audio
    if (!isplaying) return;

    //resync if playback falls behind
    if (loopStart < audioCtx.currentTime) {
        loopStart = audioCtx.currentTime + 0.05;
    }
    let maxLoopSpan = 0;

    //schedule each track
    liveCodeState.forEach((track, trackIndex) => {
        const osc = oscs[trackIndex];
        const gain = gainNodes[trackIndex];
        let t = loopStart;
        let loopSpan = 0;

        track.forEach(noteData => {
            //convert note length to seconds
            const span = noteData.length / 10;
            if (noteData.pitch !== null) {
                gain.gain.setTargetAtTime(1, t, 0.01);
                osc.frequency.setTargetAtTime(noteData.pitch, t, 0.01);
                gain.gain.setTargetAtTime(0, t + span, 0.01);
            }
            t += span;
            loopSpan += span;
        });
        maxLoopSpan = Math.max(maxLoopSpan, loopSpan);
    })

    loopStart += maxLoopSpan;
    const tilNext = (loopStart - audioCtx.currentTime - 0.1) * 1000;
    scheduleTimeout = setTimeout(scheduleAudio, Math.max(0, tilNext));
}

//interpret length modifiers
function parseLength(mods) {
    let length = 4;
    for (const ch of mods) {
        if (ch === '+') length *= 2;
        else if (ch === '-') length /= 2;
        else if (ch === '.') length = length + length/2;
        else throw new Error(`Unknown length modifier: "${ch}"`);
    }
    //console.log(length);
    return length;
}

//interpret user input
function parseCode(code) {
    //split input by spaces
    let symbols = code.trim().split(/\s+/);
    let rnoct = 4;
    //validate octave markers
    for (let i = 0; i < symbols.length; i++) {
        if (symbols[i].match(/^oct[345]$/i)) {
            const left = symbols.slice(i + 1);
            const hasNote = left.some(s => s.match(/^_[+\-\.]*$/) || s.match(/^[A-Ga-g]#?[+\-\.]*$/));
            if (!hasNote) {
                throw new Error(`"${symbols[i]}" has no notes or rests after`);
            }
        }
    }

    return symbols.map((sym, i) => {
        //look for octave
        if (sym.match(/^oct[345]$/i)) {
            rnoct = parseInt(sym.slice(3));
            return null;
        }

        //look for rests
        if (sym.match(/^_[+\-\.]*$/)) {
            const modifiers = sym.slice(1);
            return {
                length: parseLength(modifiers),
                pitch: null
            };
        }

        //look for notes
        const match = sym.match(/^([A-Ga-g]#?)([+\-\.]*)$/);

        if (!match) {
            throw new Error(`Note ${i + 1}: invalid symbol "${sym}"`);
        }

        const noteName = match[1].toUpperCase();
        const modifiers = match[2];

        return {
            length: parseLength(modifiers),
            pitch: notetoFreq(noteName, rnoct),
        };
    }).filter(n => n !== null);
}

//pass note data to liveCodeState
function genAudio(data) {
    liveCodeState = data;
}

//reevaluates code
function reevaluate() {
    //split user input by line
    var lines = document.getElementById('code').value.split('\n').filter(l => l.trim());
    try {
        liveCodeState = lines.map(line => parseCode(line));
        document.getElementById('error').textContent = '';
    } catch (e) {
        document.getElementById('error').textContent = e.message;
    }
}

//listens for when the start/stop button is clicked
playButton.addEventListener('click', function () {
    if (isplaying) {
        stopAudio();
    } else {
        startAudio();
    }
});

let rafId = null;
const keyWidth = 36;
const pixelsPerSec = 60;
const rowh = 10;
const trackColors = ['#4fc3f7','#81c784','#ffb74d','#f06292','#ce93d8','#80cbc4'];

//resize pianoroll to match screen width
function resizeCanvas() {
    const canvas = document.getElementById('roll');
    canvas.width = canvas.offsetWidth;
    canvas.height = allPitches.length * rowh;
    canvas.style.height = canvas.height + 'px';
}

window.addEventListener('resize', resizeCanvas);

//draw pianoroll visualization
function drawPianoRoll() {
    const canvas = document.getElementById('roll');
    resizeCanvas();
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    //clear previous frame
    ctx.clearRect(0, 0, w, h);
    //draw note grid background
    allPitches.forEach(([name], i) => {
        const isBlack = name.includes('#');
        ctx.fillStyle = isBlack ? '#1a1a1a' : '#252525';
        ctx.fillRect(keyWidth, i * rowh, w - keyWidth, rowh);
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(keyWidth, i * rowh);
        ctx.lineTo(w, i * rowh);
        ctx.stroke();
    });
    //draw piano keyboard labels
    allPitches.forEach(([name], i) => {
        const isBlack = name.includes('#');
        ctx.fillStyle = isBlack ? '#222' : '#ddd';
        ctx.fillRect(0, i * rowh + 0.5, keyWidth - 2, rowh - 1);
        if (!isBlack) {
            ctx.fillStyle = '#555';
            ctx.font = `${Math.max(8, rowh - 3)}px monospace`;
            ctx.fillText(name, 2, i * rowh + rowh - 3);
        }
    });

    let scrollOffset = 0;
    let loopSpan = 0;
    const playheadX = keyWidth + (w - keyWidth) * 0.25;
    
    //draw notes for each track
    liveCodeState.forEach(track => {
        const span = track.reduce((s, n) => s + n.length / 10, 0);
        loopSpan = Math.max(loopSpan, span);
    });

    //draw playhead line
    if (isplaying && audioCtx && loopSpan > 0) {
        const loopBegin = loopStart - loopSpan;
        const rawPassed = audioCtx.currentTime - loopBegin;
        const passed = ((rawPassed % loopSpan) + loopSpan) % loopSpan;
        scrollOffset = passed * pixelsPerSec - (playheadX - keyWidth);
    }

    if (liveCodeState.length > 0 && loopSpan > 0) {
        liveCodeState.forEach((track, ti) => {
            [-1, 0, 1].forEach(loopOffset => {
                let t = 0;
                track.forEach(noteData => {
                    const span = noteData.length / 10;
                    if (noteData.pitch !== null) {
                        const row = pitchToRow(noteData.pitch);
                        const x = keyWidth + (t + loopOffset * loopSpan) * pixelsPerSec - scrollOffset;
                        const nw = span * pixelsPerSec - 2;
                        const y = row * rowh + 1;
                        const nh = rowh - 2;
                        if (x + nw > keyWidth && x < w) {
                            ctx.fillStyle = trackColors[ti % trackColors.length];
                            ctx.beginPath();
                            ctx.roundRect(x, y, Math.max(nw, 2), nh, 2);
                            ctx.fill();
                        }
                    }
                    t += span;
                });
            });
        });
    }

    if (isplaying) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();
    }
    
    rafId = requestAnimationFrame(drawPianoRoll);
}

rafId = requestAnimationFrame(drawPianoRoll);
document.getElementById('code').addEventListener('input', reevaluate);
