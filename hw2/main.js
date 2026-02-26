document.addEventListener("DOMContentLoaded", function(event) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    const globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime)
    const globalAnalyser = audioCtx.createAnalyser();
    globalGain.connect(globalAnalyser);
    globalAnalyser.connect(audioCtx.destination);
    const adsr = {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.6,
        release: 0.15
    };

    let waveform = 'sine'
    let addmode = 'off'
    let ammode = false;
    let fmmode = false;
    let lfomode = false;

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

    const partials = [[1, 1.0], [2, 0.5], [3, 0.25], [4, 0.125], [5, 0.1]];

    let amfreq = 110;
    let fmfreq = 110;
    let fmindex = 100;

    document.getElementById('amfreq').addEventListener('input', function(event) {
        amfreq = parseFloat(event.target.value);
    });

    document.getElementById('fmfreq').addEventListener('input', function(event) {
        fmfreq = parseFloat(event.target.value);
    });

    document.getElementById('fmindex').addEventListener('input', function(event) {
        fmindex = parseFloat(event.target.value);
    });

    const notedisplay = document.getElementById('notedisplay');
    const triaddisplay = document.getElementById('triaddisplay');

    const waveformControl = document.getElementById('waveform')
    waveformControl.addEventListener('change', function(event) {
        waveform = event.target.value;
    });

    const additiveControl = document.getElementById('additive')
    additiveControl.addEventListener('change', function(event) {
        addmode = event.target.value;
    });

    const amcontrol = document.getElementById('am');
    amcontrol.addEventListener('change', function(event) {
        ammode = event.target.value === 'on';
    });

    const fmcontrol = document.getElementById('fm');
    fmcontrol.addEventListener('change', function(event) {
        fmmode = event.target.value === 'on';
    });

    const lfocontrol = document.getElementById('lfo');
    lfocontrol.addEventListener('change', function(event) {
        lfomode = event.target.value === 'on';
    });

    window.addEventListener('keydown', keyDown, false);
    window.addEventListener('keyup', keyUp, false);

    const activeOsc = {}

    draw();

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
            const {oscs, gain} = activeOsc[key];
            const now = audioCtx.currentTime;

            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + adsr.release);

            notedisplay.textContent = '-';

            oscs.forEach(osc => osc.stop(now + adsr.release));
            setTimeout(() => gain.disconnect(), (adsr.release + 0.1)*1000);
            delete activeOsc[key];
            updateGain();
        }
    }

    function playNote(key) {
        const now = audioCtx.currentTime;
        const basefreq = keyboardFreqMap[key]
        const envgain = audioCtx.createGain();

        envgain.gain.setValueAtTime(0.0001, now);
        envgain.gain.exponentialRampToValueAtTime(1, now + adsr.attack);
        envgain.gain.exponentialRampToValueAtTime(adsr.sustain, now + adsr.attack + adsr.decay);

        envgain.connect(globalGain);

        let oscs;

        if (addmode === 'on') {
            oscs = partials.map(([mult, amp]) => {
                const osc = audioCtx.createOscillator();
                const partgain = audioCtx.createGain();
                osc.frequency.setValueAtTime(basefreq*mult, now);
                osc.type = waveform;
                partgain.gain.setValueAtTime(amp, now);
                osc.connect(partgain);
                partgain.connect(envgain);
                osc.start();
                return osc;
            });
        } else {
            const osc = audioCtx.createOscillator();
            osc.frequency.setValueAtTime(basefreq, now);
            osc.type = waveform;
            osc.connect(envgain);
            osc.start();
            oscs = [osc];

            if (lfomode) {
                const lfo = audioCtx.createOscillator();
                const lfogain = audioCtx.createGain();
                lfo.frequency.setValueAtTime(5, now);
                lfo.type = waveform;
                lfogain.gain.setValueAtTime(8, now);
                lfo.connect(lfogain);
                lfogain.connect(osc.frequency);
                lfo.start();
                oscs.push(lfo);
            }
        }

        if (ammode) {
            const modulator = audioCtx.createOscillator();
            const modgain = audioCtx.createGain();
            modulator.frequency.setValueAtTime(amfreq, now);
            modulator.type = waveform;
            modgain.gain.setValueAtTime(1, now);
            modulator.connect(modgain);
            modgain.connect(envgain.gain);
            modulator.start();
            oscs.push(modulator);
        }

        if (fmmode) {
            const modulator = audioCtx.createOscillator();
            const modgain = audioCtx.createGain();
            modulator.frequency.setValueAtTime(fmfreq, now);
            modulator.type = 'sine';
            modgain.gain.setValueAtTime(fmindex, now);
            modulator.connect(modgain);

            if (addmode === 'on') {
                oscs.forEach(osc => modgain.connect(osc.frequency));
            } else {
                modgain.connect(oscs[0].frequency);
            }

            modulator.start();
            oscs.push(modulator);
        }

        notedisplay.textContent = notenamekey[key];

        activeOsc[key] = {oscs, gain:envgain};
        updateGain();
    }

    function draw() {
        requestAnimationFrame(draw);
        globalAnalyser.fftSize = 2048;
        var bufferlength = globalAnalyser.frequencyBinCount;
        var dataArray = new Uint8Array(bufferlength);
        globalAnalyser.getByteTimeDomainData(dataArray);
        
        var canvas = document.querySelector("#globalVisualizer");
        var canvasCtx = canvas.getContext("2d");

        canvasCtx.fillStyle = "white";
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(255, 27, 187)";

        canvasCtx.beginPath();

        var sliceWidth = canvas.width*1.0/bufferlength;
        var x = 0;

        for (var i = 0; i < bufferlength; i++) {
            var v = dataArray[i]/128.0;
            var y = v*canvas.height/2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
    }
})
