document.addEventListener("DOMContentLoaded", function(event) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const keyboardFrequencyMap = {
        '90': 261.625565300598634,  //Z - C
        '83': 277.182630976872096, //S - C#
        '88': 293.664767917407560,  //X - D
        '68': 311.126983722080910, //D - D#
        '67': 329.627556912869929,  //C - E
        '86': 349.228231433003884,  //V - F
        '71': 369.994422711634398, //G - F#
        '66': 391.995435981749294,  //B - G
        '72': 415.304697579945138, //H - G#
        '78': 440.000000000000000,  //N - A
        '74': 466.163761518089916, //J - A#
        '77': 493.883301256124111,  //M - B
        '81': 523.251130601197269,  //Q - C
        '50': 554.365261953744192, //2 - C#
        '87': 587.329535834815120,  //W - D
        '51': 622.253967444161821, //3 - D#
        '69': 659.255113825739859,  //E - E
        '82': 698.456462866007768,  //R - F
        '53': 739.988845423268797, //5 - F#
        '84': 783.990871963498588,  //T - G
        '54': 830.609395159890277, //6 - G#
        '89': 880.000000000000000,  //Y - A
        '55': 932.327523036179832, //7 - A#
        '85': 987.766602512248223,  //U - B
    }

    const notenames = {
        '90': 'C',
        '83': 'C#',
        '88': 'D',
        '68': 'D#',
        '67': 'E',
        '86': 'F',
        '71': 'F#',
        '66': 'G',
        '72': 'G#',
        '78': 'A',
        '74': 'A#',
        '77': 'B',
        '81': 'C',
        '50': 'C#',
        '87': 'D',
        '51': 'D#',
        '69': 'E',
        '82': 'F',
        '53': 'F#',
        '84': 'G',
        '54': 'G#',
        '89': 'A',
        '55': 'A#',
        '85': 'B'
    }

    const notecolors = {
        'C':  [255, 0, 0],
        'C#': [255, 60, 0],
        'D':  [255, 120, 0],
        'D#': [255, 180, 0],
        'E':  [255, 255, 0],
        'F':  [0, 200, 0],
        'F#': [0, 200, 150],
        'G':  [0, 150, 255],
        'G#': [0, 0, 255],
        'A':  [100, 0, 255],
        'A#': [180, 0, 255],
        'B':  [255, 0, 180],
    }

    const adsr = {
        attack: 0.08,
        decay: 0.2,
        sustain: 0.6,
        release: 0.3
    }

    const globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);

    let waveform = 'sine'

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    activeOscillators = {}

    const waveformControl = document.getElementById('waveform')
    waveformControl.addEventListener('change', function(event) {
        waveform = event.target.value
    })

    function updatedisplay() {
        const notes = [...new Set(Object.keys(activeOscillators).map(k => notenames[k]))];
        document.getElementById('note').textContent = notes.join(' ');

        if (notes.length === 0) {
            document.body.style.backgroundColor = ''
            return;
        }

        const mixed = notes.reduce(
            (acc, note) => {
                const [r, g, b] = notecolors[note];
                return [acc[0] + r, acc[1] + g, acc[2] + b];
            },
            [0, 0, 0]
        ).map(v => Math.min(255, Math.round(v / notes.length)));

        document.body.style.backgroundColor = `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
    }

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && !activeOscillators[key]) {
            playNote(key);
        }
        updatedisplay();
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFrequencyMap[key] && activeOscillators[key]) {
            const {osc, gainnode} = activeOscillators[key];
            if (keyboardFrequencyMap[key] && activeOscillators[key]) {
                const {osc, gainnode} = activeOscillators[key];
                gainnode.gain.cancelScheduledValues(audioCtx.currentTime);
                gainnode.gain.setValueAtTime(gainnode.gain.value, audioCtx.currentTime);
                gainnode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + adsr.release);
                osc.stop(audioCtx.currentTime + adsr.release)
                delete activeOscillators[key];
            }
        }
        updatedisplay();
    }

    function playNote(key) {
        const osc = audioCtx.createOscillator();
        const gainnode = audioCtx.createGain();

        osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime)
        osc.type = waveform
        osc.connect(gainnode)
        gainnode.connect(globalGain)

        gainnode.gain.setValueAtTime(0, audioCtx.currentTime)
        gainnode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + adsr.attack)
        gainnode.gain.exponentialRampToValueAtTime(
            adsr.sustain,
            audioCtx.currentTime + adsr.attack + adsr.decay
        )
        
        osc.start();
        activeOscillators[key] = {osc, gainnode}
    }
})
