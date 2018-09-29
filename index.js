let canvas;
let ctx;
let start = null;
let width;
let height;
let radius;
let audioCtx;
const TWOPI = 2 * Math.PI;
const NUM_RINGS = 8;
const MIN_DISTANCE = 9;
const NOTES = [0, 2, 4, 7, 9];
const synths = [];
const MAX_NOTE = Math.max.apply(Math, NOTES);

const items = [];
const TRANSLATABLES = ['x', 'y', 'radius'];

const A4 = 69;
const A_FREQ = 440;
let keyOffset = 60;
const keyToFreq = key => A_FREQ * Math.pow(2, (key + keyOffset - A4) / 12.0);

function translate(item) {
  const ret = {};
  TRANSLATABLES.forEach(key => {
    if (item.hasOwnProperty(key)) {
      const smaller = Math.min(width, height);
      if (key === 'x') {
        ret[key] = item[key] * smaller + (width / 2.0);
      } else if (key === 'y') {
        ret[key] = item[key] * smaller + (height / 2.0);
      } else {
        ret[key] = item[key] * smaller;
      }
    }
  });
  return ret;
}

const rand = () => Math.random() * 360;
const sample = arr => arr[Math.floor(Math.random() * arr.length)];

function initItems() {
  radius = 0.4;
  keyOffset = Math.floor(50 + Math.random() * 20);
  while (items.length) {
    items.pop();
  }
  items.push({type: 'circle', x: 0, y: 0, radius: radius});
  const pool = [];
  let angle;
  for (let i = 0; i < NUM_RINGS; ++i) {
    let tooClose = true;
    do {
      angle = rand();
      tooClose = false;
      for (let j = 0; j < pool.length; ++j) {
        if (Math.abs(pool[j] - angle) < MIN_DISTANCE) {
          tooClose = true;
        }
      }
    } while (tooClose);
    pool.push(angle);
    items.push({
      index: i,
      type: 'ring',
      angle,
      note: sample(NOTES),
      octave: sample([-1, 0, 1]),
      speed: 0.2 + Math.random() * 0.6,
    });
  }
}

function onResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width  = width;
  canvas.height = height;
}

const offset = 10;
const noteColor = (val, max) => offset + val / MAX_NOTE * (max - offset)

function draw() {
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);

  const {x, y, radius: r} = translate({x: 0.8 * radius, y: 0, radius: radius * 0.1});
  ctx.fillStyle = 'deeppink';
  ctx.fillRect(x, y - 2, r, 4);

  items.forEach(item => {
    let stroke = item.stroke || 'deeppink';
    let data = item;
    let lineWidth = 3;
    if (item.type === 'ring') {
      const r = noteColor(item.note, 255);
      const b = noteColor(item.note, 147);
      stroke = `rgba(${r}, 20, ${b}, 0.8)`;
      const ang = item.angle / 360 * TWOPI;
      lineWidth = 2 + item.note / MAX_NOTE * 8;
      data = {
        x: Math.cos(ang) * radius,
        y: Math.sin(ang) * radius,
        radius: 0.02,
      };
    }
    const {x, y, radius: rad} = translate(data);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    ctx.arc(x, y, rad, 0, TWOPI);
    ctx.stroke();
  });
}

function playNote(item) {
  const index = item.index;
  synths[index].vco.frequency.value = keyToFreq(item.note + 12 * item.octave);
  synths[index].vca.gain.linearRampToValueAtTime(0.6, audioCtx.currentTime + 1);
  synths[index].vca.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 3);
  synths[index].filter.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 1);
  synths[index].filter.frequency.linearRampToValueAtTime(200, audioCtx.currentTime + 1.5);
  synths[index].filter.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 3);
}

function step(timestamp) {
  if (!start) {
    start = timestamp;
  }
  items.forEach(item => {
    if (item.type === 'ring') {
      item.angle = item.angle + item.speed;
      if (item.angle >= 360) {
        item.angle = 0;
        playNote(item);
      }
    }
  });
  draw();
  window.requestAnimationFrame(step);
}

function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', onResize);
  window.addEventListener('click', initItems);
  window.addEventListener('keydown', initItems);
  onResize();
  // ctx.globalCompositeOperation = 'lighten';
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  window.requestAnimationFrame(step);
}

function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const masterGainNode = audioCtx.createGain();
  masterGainNode.connect(audioCtx.destination);
  masterGainNode.gain.value = 0.7;

  const delay = audioCtx.createDelay();
  delay.delayTime.value = 0.6;
  const feedback = audioCtx.createGain();
  feedback.gain.value = 0.8;
  delay.connect(feedback);
  feedback.connect(delay);
  const delayGain = audioCtx.createGain();
  delayGain.gain.value = 0.3;

  const mixBus = audioCtx.createGain();
  mixBus.connect(delay);
  mixBus.connect(masterGainNode);
  delay.connect(delayGain);
  delayGain.connect(masterGainNode);

  for (let i = 0; i < NUM_RINGS; ++i) {
    const vco = audioCtx.createOscillator();
    vco.type = 'sawtooth';
    const vca = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency = 100;
    filter.Q = 0.8;
    vca.gain.value = 0;
    vco.connect(filter);
    filter.connect(vca);
    vca.connect(mixBus);
    vco.frequency.value = 440;
    vco.start();
    synths.push({vco, vca, filter});
  }
}

initAudio();
initItems();
init();
