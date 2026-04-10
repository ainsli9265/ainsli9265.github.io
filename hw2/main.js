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
        'C': [255, 0, 0],
        'C#': [255, 60, 0],
        'D': [255, 120, 0],
        'D#': [255, 180, 0],
        'E': [255, 255, 0],
        'F': [0, 200, 0],
        'F#': [0, 200, 150],
        'G': [0, 150, 255],
        'G#': [0, 0, 255],
        'A': [100, 0, 255],
        'A#': [180, 0, 255],
        'B': [255, 0, 180],
    }

    const adsr = {
        attack: 0.08,
        decay: 0.2,
        sustain: 0.2,
        release: 0.1
    }

    const partials = [
        {mult: 1, amp: 0.5},
        {mult: 2, amp: 0.25},
        {mult: 3, amp: 0.15 },
        {mult: 4, amp: 0.10},
    ]

    const globalGain = audioCtx.createGain();
    const compressor = audioCtx.createDynamicsCompressor();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    globalGain.connect(compressor);
    compressor.connect(audioCtx.destination);

    let addmode = 'off'
    let ammode = 'off'
    let amfreq = 110;
    let fmmode = 'off'
    let fmfreq = 110;
    let lfomode = 'off';
    let lfofreq = 5;
    let lfodepth = 10;

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    activeOscillators = {}

    const additiveControl = document.getElementById('additive');
    additiveControl.addEventListener('change', function(event) {
        addmode = event.target.value;
    })

    const amControl = document.getElementById('am');
    amControl.addEventListener('change', function(event) {
        ammode = event.target.value;
    })

    const amFrequencyControl = document.getElementById('amfreq');
    amFrequencyControl.addEventListener('input', function(event) {
        amfreq = parseFloat(event.target.value);
    })

    const fmControl = document.getElementById('fm');
    fmControl.addEventListener('change', function(event) {
        fmmode = event.target.value;
    })

    const fmFrequencyControl = document.getElementById('fmfreq');
    fmFrequencyControl.addEventListener('input', function(event) {
        fmfreq = parseFloat(event.target.value);
    })

    const lfoControl = document.getElementById('lfo');
    lfoControl.addEventListener('change', e => lfomode = e.target.value);

    const lfoFrequencyControl = document.getElementById('lfofreq');
    lfoFrequencyControl.addEventListener('input', e => lfofreq = parseFloat(e.target.value));

    const lfoDepthControl = document.getElementById('lfodepth');
    lfoDepthControl.addEventListener('input', e => lfodepth = parseFloat(e.target.value));

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
            const {oscillators, gainnode} = activeOscillators[key];
            gainnode.gain.cancelScheduledValues(audioCtx.currentTime);
            gainnode.gain.setValueAtTime(gainnode.gain.value, audioCtx.currentTime);
            gainnode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + adsr.release);
            oscillators.forEach(osc => osc.stop(audioCtx.currentTime + adsr.release));
            delete activeOscillators[key];
        }
        updatedisplay();
    }

    function playNote(key) {
        const gainnode = audioCtx.createGain();
        gainnode.connect(globalGain);
        gainnode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainnode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + adsr.attack);
        gainnode.gain.exponentialRampToValueAtTime(
            adsr.sustain,
            audioCtx.currentTime + adsr.attack + adsr.decay
        );

        const gaincarrier = audioCtx.createGain();
        gaincarrier.connect(gainnode);

        const oscillators = [];

        if (addmode === 'on') {
            partials.forEach(p => {
                const osc = audioCtx.createOscillator();
                const partialGain = audioCtx.createGain();

                osc.frequency.setValueAtTime(keyboardFrequencyMap[key] * p.mult, audioCtx.currentTime);
                osc.type = 'sine';
                partialGain.gain.setValueAtTime(p.amp, audioCtx.currentTime);

                osc.connect(partialGain);
                partialGain.connect(gaincarrier);
                osc.start();
                oscillators.push(osc);
            });
        } else {
            const osc = audioCtx.createOscillator();
            osc.frequency.setValueAtTime(keyboardFrequencyMap[key], audioCtx.currentTime);
            osc.type = 'sine';
            osc.connect(gaincarrier);
            osc.start();
            oscillators.push(osc);
        }

        if (ammode === 'on') {
            const depth = audioCtx.createGain();
            depth.gain.value = 0.5;
            gaincarrier.gain.value = 1 - depth.gain.value;

            const modulator = audioCtx.createOscillator();
            modulator.frequency.setValueAtTime(amfreq, audioCtx.currentTime);
            modulator.type = 'sine';

            modulator.connect(depth);
            depth.connect(gaincarrier.gain);
            modulator.start();
            oscillators.push(modulator);
        } else {
            gaincarrier.gain.value = 1;
        }

        if (fmmode === 'on') {
            const depth = audioCtx.createGain();
            depth.gain.value = 100;

            const modulator = audioCtx.createOscillator();
            modulator.frequency.setValueAtTime(fmfreq, audioCtx.currentTime);
            modulator.type = 'sine';

            modulator.connect(depth);
            
            oscillators.forEach(osc => {
                if (osc.frequency) {
                    depth.connect(osc.frequency);
                }
            });

            modulator.start();
            oscillators.push(modulator);
        }

        if (lfomode === 'on') {
            const lfo = audioCtx.createOscillator();
            const lfogain = audioCtx.createGain();

            lfo.frequency.setValueAtTime(lfofreq, audioCtx.currentTime);
            lfo.type = 'sine';
            lfogain.gain.value = lfodepth;

            lfo.connect(lfogain);

            oscillators.forEach(osc => {
                if (osc.frequency) {
                    lfogain.connect(osc.frequency);
                }
            });

            lfo.start();
            oscillators.push(lfo);
        }

        activeOscillators[key] = {oscillators, gainnode};
    }

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    globalGain.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(audioCtx.destination);

    const canvas = document.querySelector("#wavevisualizer");
    const canvasCtx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    }

    draw();
})
