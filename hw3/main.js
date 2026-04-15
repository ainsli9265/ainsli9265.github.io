//part1
var audioCtx1;
var brownNoisepart1;
var analyser1;
const playButton1 = document.querySelector('#button1');

function initAudio1() {
    audioCtx1 = new (window.AudioContext || window.webkitAudioContext)
    analyser1 = audioCtx1.createAnalyser();
    analyser1.fftSize = 2048;

    var bufferSize = 10 * audioCtx1.sampleRate,
        noiseBuffer = audioCtx1.createBuffer(1, bufferSize, audioCtx1.sampleRate),
        output = noiseBuffer.getChannelData(0);

    var lastOut = 0;
    for (var i = 0; i < bufferSize; i++) {
        var brown = Math.random() * 2 - 1;
    
        output[i] = (lastOut + (0.02 * brown)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
    }

    var lpf = audioCtx1.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 400;

    brownNoisepart1 = audioCtx1.createBufferSource();
    brownNoisepart1.buffer = noiseBuffer;
    brownNoisepart1.loop = true;
    brownNoisepart1.connect(lpf);

    var noiseBuffer2 = audioCtx1.createBuffer(1, bufferSize, audioCtx1.sampleRate),
        output2 = noiseBuffer2.getChannelData(0);

    var lastOut2 = 0;
    for (var j = 0; j < bufferSize; j++) {
        var brown2 = Math.random() * 2 - 1;
        output2[j] = (lastOut2 + (0.02 * brown2)) / 1.02;
        lastOut2 = output2[j];
        output2[j] *= 3.5;
    }

    var lpf2 = audioCtx1.createBiquadFilter();
    lpf2.type = 'lowpass';
    lpf2.frequency.value = 14;

    brownNoise2 = audioCtx1.createBufferSource();
    brownNoise2.buffer = noiseBuffer2;
    brownNoise2.loop = true;
    brownNoise2.connect(lpf2);

    var scalenode = audioCtx1.createGain();
    scalenode.gain.value = 400;
    lpf2.connect(scalenode);

    var rhpf = audioCtx1.createBiquadFilter();
    rhpf.type = 'highpass';
    rhpf.Q.value = 1 / 0.03;
    rhpf.frequency.value = 500;
    scalenode.connect(rhpf.frequency);

    var mulnode = audioCtx1.createGain();
    mulnode.gain.value = 0.1;

    lpf.connect(rhpf);
    rhpf.connect(mulnode);
    mulnode.connect(analyser1);
    analyser1.connect(audioCtx1.destination);

    brownNoisepart1.start(0);
    brownNoise2.start(0);
}

playButton1.addEventListener('click', function () {
    if (!audioCtx1) {
        initAudio1();
        return;
    }
    else if (audioCtx1.state === 'suspended') {
        audioCtx1.resume();
    }
    else if (audioCtx1.state === 'running') {
        audioCtx1.suspend();
    }
}, false);

const canvas1 = document.querySelector("#wavevisualizer");
const canvasCtx1 = canvas1.getContext("2d");

function draw1() {
    requestAnimationFrame(draw1);
    if (!analyser1) return;
    
    const bufferLength = analyser1.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyser1.getByteTimeDomainData(dataArray);

    canvasCtx1.fillStyle = "white";
    canvasCtx1.fillRect(0, 0, canvas1.width, canvas1.height);
    canvasCtx1.lineWidth = 2;
    canvasCtx1.strokeStyle = 'blue';
    canvasCtx1.fillStyle = 'rgb(57, 119, 255)';
    canvasCtx1.beginPath();

    const sliceWidth = canvas1.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas1.height / 2;
        i === 0 ? canvasCtx1.moveTo(x, y) : canvasCtx1.lineTo(x, y);
        x += sliceWidth;
    }

    canvasCtx1.lineTo(canvas1.width, canvas1.height / 2);
    canvasCtx1.lineTo(canvas1.width, canvas1.height);
    canvasCtx1.lineTo(0, canvas1.height);
    canvasCtx1.closePath();
    canvasCtx1.fill();
    canvasCtx1.stroke();
}

draw1();

//part2
var audioCtx2;
var brownNoisepart2;
var analyser2;
var gainnode;
const playButton2 = document.querySelector('#button2');

function initAudio2() {
    audioCtx2 = new (window.AudioContext || window.webkitAudioContext)
    analyser2 = audioCtx2.createAnalyser();
    analyser2.fftSize = 2048;

    var bufferSize = 10 * audioCtx2.sampleRate,
        noiseBuffer = audioCtx2.createBuffer(1, bufferSize, audioCtx2.sampleRate),
        output = noiseBuffer.getChannelData(0);

    var lastOut = 0;
    for (var i = 0; i < bufferSize; i++) {
        var brown = Math.random() * 2 - 1;
    
        output[i] = (lastOut + (0.02 * brown)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
    }

    brownNoisepart2 = audioCtx2.createBufferSource();
    brownNoisepart2.buffer = noiseBuffer;
    brownNoisepart2.loop = true;

    gainnode = audioCtx2.createGain();
    gainnode.gain.value = 0.015;

    brownNoisepart2.connect(gainnode);
    gainnode.connect(analyser2);
    analyser2.connect(audioCtx2.destination);
    brownNoisepart2.start(0);

    const controlbuffer = audioCtx2.createBuffer(1, bufferSize, audioCtx2.sampleRate);
    const controldata = controlbuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        controldata[i] = Math.random() * 2 - 1;
    }

    const controlnoise = audioCtx2.createBufferSource();
    controlnoise.buffer = controlbuffer;
    controlnoise.loop = true;

    const lpfcontrol = audioCtx2.createBiquadFilter();
    lpfcontrol.type = "lowpass";
    lpfcontrol.frequency.value = 7;

    const controlanalyser = audioCtx2.createAnalyser();
    controlanalyser.fftSize = 256;

    controlnoise.connect(lpfcontrol);
    lpfcontrol.connect(controlanalyser);
    controlnoise.start();
    window.controlanalyser = controlanalyser;
}

function env() {
    const now = audioCtx2.currentTime;
    const duration = 0.02 + Math.random() * 0.01;
    const curvelength = 128;
    const curve = new Float32Array(curvelength);

    for (let i = 0; i < curvelength; i++) {
        let t = i / (curvelength - 1);
        curve[i] = (0.008 + Math.random() * 5) * Math.pow(1 - t, 10);
    }

    const cracklegain = audioCtx2.createGain();
    cracklegain.gain.setValueCurveAtTime(curve, now, duration);

    const filter = audioCtx2.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800 + Math.random() * 500;
    filter.Q.value = 0.3 + Math.random() * 1.5;

    brownNoisepart2.disconnect();
    brownNoisepart2.connect(filter);
    filter.connect(cracklegain);
    cracklegain.connect(analyser2);
    analyser2.connect(audioCtx2.destination);

    setTimeout(() => {
        try {
            brownNoisepart2.disconnect();
            brownNoisepart2.connect(gainnode);
        } catch (e) {}
    }, duration * 1000);
}

let lastval = 0;
let lasttrigger = 0;

function check() {
    if (!window.controlanalyser) {
        requestAnimationFrame(check);
        return;
    }

    const buffer = new Float32Array(128);
    controlanalyser.getFloatTimeDomainData(buffer);
    const v = buffer[0];
    const mapped = (v + 1) * 50;
    const inwindow = mapped > 50 && mapped < 52;
    const now = audioCtx2.currentTime;

    if (lastval < 50 && inwindow) {
        if (now - lasttrigger > 0.01) {
            env();
            lasttrigger = now;
        }
    }

    lastval = mapped;
    requestAnimationFrame(check);
}

playButton2.addEventListener('click', function () {
    if (!audioCtx2) {
        initAudio2();
        check();
        return;
    }
    else if (audioCtx2.state === 'suspended') {
        audioCtx2.resume();
    }
    else if (audioCtx2.state === 'running') {
        audioCtx2.suspend();
    }
}, false);

const canvas2 = document.querySelector("#wavevisualizer2");
const canvasCtx2 = canvas2.getContext("2d");

function draw2() {
    requestAnimationFrame(draw2);
    if (!analyser2) return;
    
    const bufferLength = analyser2.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyser2.getByteTimeDomainData(dataArray);

    canvasCtx2.fillStyle = "white";
    canvasCtx2.fillRect(0, 0, canvas2.width, canvas2.height);
    canvasCtx2.lineWidth = 2;
    canvasCtx2.beginPath();

    const sliceWidth = canvas2.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * canvas2.height / 2;
        i === 0 ? canvasCtx2.moveTo(x, y) : canvasCtx2.lineTo(x, y);
        x += sliceWidth;
    }

    canvasCtx2.lineTo(canvas2.width, canvas2.height / 2);
    canvasCtx2.stroke();
}

draw2();
