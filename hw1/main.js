document.addEventListener("DOMContentLoaded", function(event) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime)
    globalGain.connect(audioCtx.destination);
    const adsr = {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.6,
        release: 0.15
    };

    let waveform = 'sine'

    const keyboardFreqMap = {
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

    const notenamekey = {
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

    const letters = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    const notedisplay = document.getElementById('notedisplay');
    const triaddisplay = document.getElementById('triaddisplay');

    const waveformControl = document.getElementById('waveform')
    waveformControl.addEventListener('change', function(event) {
        waveform = event.target.value
    })

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    const activeOsc = {}

    function majortriad(root) {
        const rindex = letters.indexOf(root);
        const third = letters[(rindex + 4) % 12];
        const fifth = letters[(rindex + 7) % 12];
        return [root, third, fifth];
    }

    function updateGain() {
        const voices = Object.values(activeOsc);
        const vcount = voices.length;
        if (vcount === 0) return;

        const targetGain = 1/vcount;
        const now = audioCtx.currentTime;

        voices.forEach(({gain}) => {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setTargetAtTime(targetGain, now, 0.01);
        });
    }

    function keyDown(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFreqMap[key] && !activeOsc[key]) {
            playNote(key);
        }
    }

    function keyUp(event) {
        const key = (event.detail || event.which).toString();
        if (keyboardFreqMap[key] && activeOsc[key]) {
            const {osc, gain} = activeOsc[key];
            const now = audioCtx.currentTime;

            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                now + adsr.release
            );

            notedisplay.textContent = '-';

            osc.stop(now + adsr.release);
            delete activeOsc[key];
            updateGain();
        }
    }

    function playNote(key) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;

        osc.frequency.setValueAtTime(keyboardFreqMap[key], now)
        osc.type = waveform

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(1, now + adsr.attack);
        gain.gain.exponentialRampToValueAtTime(adsr.sustain, now + adsr.attack + adsr.decay);
        
        osc.connect(gain);
        gain.connect(globalGain);
        osc.start();
        
        notedisplay.textContent = notenamekey[key];
        const triad = majortriad(notenamekey[key]);
        triaddisplay.textContent = triad.join(' - ');

        activeOsc[key] = {osc, gain};
        updateGain();
    }
})
